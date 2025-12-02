import { describe, it, expect } from 'vitest'
import { useCborParser } from '../composables/useCborParser'

/**
 * AST Tree Structure Tests
 *
 * These tests verify that the source map produces proper AST structure where:
 * - Each node shows only its header bytes (type + length encoding)
 * - Content is separated from headers
 * - Nested structures are properly represented
 */
describe('AST Tree Structure', () => {
  const { parseWithSourceMap } = useCborParser()

  describe('Byte String AST Structure', () => {
    it('should split byte string into header and content', () => {
      // 54 = bytes(20)
      // 736c6f6fc9942073e1b4892073e1b489c9a5ca87 = 20 bytes of data
      const hex = '54736c6f6fc9942073e1b4892073e1b489c9a5ca87'
      const result = parseWithSourceMap(hex)

      expect(result.sourceMap).toHaveLength(2)

      // Header entry (container)
      const headerEntry = result.sourceMap[0]
      expect(headerEntry.type).toBe('bytes(20)')
      expect(headerEntry.start).toBe(0)
      expect(headerEntry.end).toBe(1) // Only the "54" byte
      expect(headerEntry.isHeader).toBe(true)
      expect(headerEntry.headerEnd).toBe(1)
      expect(headerEntry.contentPath).toBe('#content')
      expect(headerEntry.children).toEqual(['#content']) // Header is a container

      // Content entry (child of header)
      const contentEntry = result.sourceMap[1]
      expect(contentEntry.type).toBe('→ 20 bytes')
      expect(contentEntry.start).toBe(1)
      expect(contentEntry.end).toBe(21) // The 20 data bytes
      expect(contentEntry.isContent).toBe(true)
      expect(contentEntry.parent).toBe('') // Parent is the header
    })

    it('should handle empty byte string', () => {
      // 40 = bytes(0)
      const hex = '40'
      const result = parseWithSourceMap(hex)

      expect(result.sourceMap).toHaveLength(1)

      // Only header, no content
      const headerEntry = result.sourceMap[0]
      expect(headerEntry.type).toBe('bytes(0)')
      expect(headerEntry.start).toBe(0)
      expect(headerEntry.end).toBe(1)
      expect(headerEntry.isHeader).toBe(true)
      expect(headerEntry.contentPath).toBeUndefined()
    })
  })

  describe('Text String AST Structure', () => {
    it('should split text string into header and content', () => {
      // 64 = text(4)
      // 49455446 = "IETF"
      const hex = '6449455446'
      const result = parseWithSourceMap(hex)

      expect(result.sourceMap).toHaveLength(2)

      // Header entry (container)
      const headerEntry = result.sourceMap[0]
      expect(headerEntry.type).toBe('text(4)')
      expect(headerEntry.start).toBe(0)
      expect(headerEntry.end).toBe(1) // Only the "64" byte
      expect(headerEntry.isHeader).toBe(true)
      expect(headerEntry.headerEnd).toBe(1)
      expect(headerEntry.children).toEqual(['#content']) // Header is a container

      // Content entry (child of header)
      const contentEntry = result.sourceMap[1]
      expect(contentEntry.type).toBe('→ "IETF"')
      expect(contentEntry.start).toBe(1)
      expect(contentEntry.end).toBe(5) // The 4 text bytes
      expect(contentEntry.isContent).toBe(true)
      expect(contentEntry.parent).toBe('') // Parent is the header
    })
  })

  describe('Array AST Structure', () => {
    it('should show array header separate from elements', () => {
      // 82 = array(2)
      // 01 = int 1
      // 02 = int 2
      const hex = '820102'
      const result = parseWithSourceMap(hex)

      // Should have: array header, element[0], element[1]
      expect(result.sourceMap).toHaveLength(3)

      // Array header
      const arrayEntry = result.sourceMap[0]
      expect(arrayEntry.type).toBe('array(2)')
      expect(arrayEntry.start).toBe(0)
      expect(arrayEntry.end).toBe(1) // Only the "82" byte
      expect(arrayEntry.isHeader).toBe(true)
      expect(arrayEntry.headerEnd).toBe(1)
      expect(arrayEntry.children).toEqual(['[0]', '[1]'])

      // First element
      const elem0 = result.sourceMap[1]
      expect(elem0.path).toBe('[0]')
      expect(elem0.start).toBe(1)
      expect(elem0.end).toBe(2) // The "01" byte
      expect(elem0.parent).toBe('')

      // Second element
      const elem1 = result.sourceMap[2]
      expect(elem1.path).toBe('[1]')
      expect(elem1.start).toBe(2)
      expect(elem1.end).toBe(3) // The "02" byte
      expect(elem1.parent).toBe('')
    })

    it('should handle nested arrays with proper AST structure', () => {
      // 82 = array(2)
      //   82 = array(2)
      //     58 20 = bytes(32)
      //     00 = int 0
      //   01 = int 1
      const hex = '8282582048bd01d51e580cde15afa6d28f63d89c9137b93a910e5941192e26b129061067000001'
      const result = parseWithSourceMap(hex)

      // Outer array header
      const outerArray = result.sourceMap[0]
      expect(outerArray.type).toBe('array(2)')
      expect(outerArray.start).toBe(0)
      expect(outerArray.end).toBe(1) // Only first "82"
      expect(outerArray.isHeader).toBe(true)

      // Inner array header (first element of outer array)
      const innerArray = result.sourceMap.find(e => e.path === '[0]' && e.type.startsWith('array'))
      expect(innerArray).toBeDefined()
      expect(innerArray!.type).toBe('array(2)')
      expect(innerArray!.start).toBe(1)
      expect(innerArray!.end).toBe(2) // Only second "82"
      expect(innerArray!.isHeader).toBe(true)
      expect(innerArray!.children).toEqual(['[0][0]', '[0][1]'])

      // Byte string header inside inner array
      const bytesHeader = result.sourceMap.find(e => e.path === '[0][0]' && e.isHeader === true)
      expect(bytesHeader).toBeDefined()
      expect(bytesHeader!.type).toBe('bytes(32)')
      expect(bytesHeader!.start).toBe(2)
      expect(bytesHeader!.end).toBe(4) // "58 20"
      expect(bytesHeader!.isHeader).toBe(true)

      // Byte string content
      const bytesContent = result.sourceMap.find(e => e.path === '[0][0]#content')
      expect(bytesContent).toBeDefined()
      expect(bytesContent!.start).toBe(4)
      expect(bytesContent!.end).toBe(36) // 32 bytes of data
      expect(bytesContent!.isContent).toBe(true)

      // Integer inside inner array
      const intEntry = result.sourceMap.find(e => e.path === '[0][1]')
      expect(intEntry).toBeDefined()
      expect(intEntry!.start).toBe(36)
      expect(intEntry!.end).toBe(37) // The "00" byte

      // Second element of outer array
      const secondElem = result.sourceMap.find(e => e.path === '[1]' && !e.type.startsWith('array'))
      expect(secondElem).toBeDefined()
      expect(secondElem!.start).toBe(37)
      expect(secondElem!.end).toBe(38) // The "01" byte
    })
  })

  describe('Map AST Structure', () => {
    it('should show map header separate from key-value pairs', () => {
      // a1 = map(1)
      // 61 61 = text(1) "a"
      // 01 = int 1
      const hex = 'a16161 01'
      const result = parseWithSourceMap(hex.replace(/\s/g, ''))

      // Map header
      const mapEntry = result.sourceMap[0]
      expect(mapEntry.type).toBe('map(1)')
      expect(mapEntry.start).toBe(0)
      expect(mapEntry.end).toBe(1) // Only the "a1" byte
      expect(mapEntry.isHeader).toBe(true)
      expect(mapEntry.headerEnd).toBe(1)

      // Should have children pointing to values (not keys)
      expect(mapEntry.children).toBeDefined()
      expect(mapEntry.children!.length).toBe(1)
    })
  })

  describe('Tag AST Structure', () => {
    it('should show tag header separate from tagged value', () => {
      // c2 = tag(2) - bignum
      // 41 ff = bytes(1) with value 0xff
      const hex = 'c241ff'
      const result = parseWithSourceMap(hex)

      // Tag header
      const tagEntry = result.sourceMap[0]
      expect(tagEntry.type).toBe('tag(2)')
      expect(tagEntry.start).toBe(0)
      expect(tagEntry.end).toBe(1) // Only the "c2" byte
      expect(tagEntry.isHeader).toBe(true)
      expect(tagEntry.headerEnd).toBe(1)
      expect(tagEntry.children).toEqual(['.value'])

      // Tagged value - bytes header
      const bytesHeader = result.sourceMap.find(e => e.path === '.value' && e.isHeader === true)
      expect(bytesHeader).toBeDefined()
      expect(bytesHeader!.type).toBe('bytes(1)')
      expect(bytesHeader!.start).toBe(1)
      expect(bytesHeader!.end).toBe(2) // The "41" byte
      expect(bytesHeader!.parent).toBe('')

      // Bytes content
      const bytesContent = result.sourceMap.find(e => e.path === '.value#content')
      expect(bytesContent).toBeDefined()
      expect(bytesContent!.start).toBe(2)
      expect(bytesContent!.end).toBe(3) // The "ff" byte
    })

    it('should handle tag 258 (Cardano set) with proper AST', () => {
      // d9 0102 = tag(258)
      // 81 = array(1)
      // 01 = int 1
      const hex = 'd901028101'
      const result = parseWithSourceMap(hex)

      // Tag header
      const tagEntry = result.sourceMap[0]
      expect(tagEntry.type).toBe('tag(258)')
      expect(tagEntry.start).toBe(0)
      expect(tagEntry.end).toBe(3) // "d9 01 02"
      expect(tagEntry.isHeader).toBe(true)
      expect(tagEntry.headerEnd).toBe(3)

      // Array header (tagged value)
      const arrayEntry = result.sourceMap.find(e => e.path === '.value' && e.type === 'array(1)')
      expect(arrayEntry).toBeDefined()
      expect(arrayEntry!.start).toBe(3)
      expect(arrayEntry!.end).toBe(4) // Only the "81" byte
      expect(arrayEntry!.isHeader).toBe(true)
      expect(arrayEntry!.parent).toBe('')
    })
  })

  describe('Complex Cardano Transaction Example', () => {
    it('should produce proper AST for real Cardano UTXO', () => {
      // This is the user's example from the conversation:
      // 82 82 58 20 48bd... 00 82 58 39 00dae... 1a 000f4240
      const hex = '8282582048bd01d51e580cde15afa6d28f63d89c9137b93a910e5941192e26b12906106700825839000dae074cac48222800da644971a35b68832abb40b619643efde77dc9db8ec58f9fa297093e286f81d37bea7154209064956254d5d4e2108d1a000f4240'
      const result = parseWithSourceMap(hex)

      // Outer array: 82 at offset 0
      const outerArray = result.sourceMap[0]
      expect(outerArray.type).toBe('array(2)')
      expect(outerArray.start).toBe(0)
      expect(outerArray.end).toBe(1) // Only first "82"
      expect(outerArray.isHeader).toBe(true)

      // First inner array: 82 at offset 1
      const firstInnerArray = result.sourceMap.find(e => e.path === '[0]' && e.type === 'array(2)')
      expect(firstInnerArray).toBeDefined()
      expect(firstInnerArray!.start).toBe(1)
      expect(firstInnerArray!.end).toBe(2) // Only second "82"
      expect(firstInnerArray!.isHeader).toBe(true)

      // Byte string header: 58 20 at offset 2-3
      const bytesHeader = result.sourceMap.find(e => e.path === '[0][0]' && e.isHeader === true)
      expect(bytesHeader).toBeDefined()
      expect(bytesHeader!.type).toBe('bytes(32)')
      expect(bytesHeader!.start).toBe(2)
      expect(bytesHeader!.end).toBe(4) // "58 20"
      expect(bytesHeader!.isHeader).toBe(true)

      // Byte string content: 32 bytes starting at offset 4
      const bytesContent = result.sourceMap.find(e => e.path === '[0][0]#content')
      expect(bytesContent).toBeDefined()
      expect(bytesContent!.start).toBe(4)
      expect(bytesContent!.end).toBe(36) // 32 bytes
      expect(bytesContent!.isContent).toBe(true)

      // Integer: 00 at offset 36
      const intEntry = result.sourceMap.find(e => e.path === '[0][1]')
      expect(intEntry).toBeDefined()
      expect(intEntry!.start).toBe(36)
      expect(intEntry!.end).toBe(37)

      // Second inner array: 82 at offset 37
      const secondInnerArray = result.sourceMap.find(e => e.path === '[1]' && e.type === 'array(2)')
      expect(secondInnerArray).toBeDefined()
      expect(secondInnerArray!.start).toBe(37)
      expect(secondInnerArray!.end).toBe(38) // Only the "82" byte
      expect(secondInnerArray!.isHeader).toBe(true)

      // Verify proper parent-child relationships
      expect(firstInnerArray!.parent).toBe('')
      expect(secondInnerArray!.parent).toBe('')
      expect(bytesHeader!.parent).toBe('[0]')
      expect(bytesContent!.parent).toBe('[0][0]')
    })
  })
})
