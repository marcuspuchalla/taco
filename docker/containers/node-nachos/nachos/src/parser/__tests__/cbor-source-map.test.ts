/**
 * CBOR Source Map Generation Tests
 * Tests the parseWithSourceMap function for bidirectional highlighting
 */

import { describe, it, expect } from 'vitest'
import { useCborParser } from '../composables/useCborParser'

describe('useCborParser - Source Map Generation', () => {
  describe('Simple Values', () => {
    it('should generate source map for integer', () => {
      const { parseWithSourceMap } = useCborParser()
      const result = parseWithSourceMap('1864') // 100

      expect(result.value).toBe(100)
      expect(result.bytesRead).toBe(2)
      expect(result.sourceMap).toHaveLength(1)
      expect(result.sourceMap[0]).toEqual({
        path: '',
        start: 0,
        end: 2,
        majorType: 0,
        type: 'Unsigned Integer'
      })
    })

    it('should generate source map for text string', () => {
      const { parseWithSourceMap } = useCborParser()
      const result = parseWithSourceMap('6449455446') // "IETF"

      expect(result.value).toBe('IETF')
      expect(result.sourceMap).toHaveLength(2) // header + content

      // Header
      expect(result.sourceMap[0]).toMatchObject({
        path: '',
        start: 0,
        majorType: 3,
        isHeader: true
      })

      // Content
      expect(result.sourceMap[1]).toMatchObject({
        path: '#content',
        majorType: 3,
        parent: ''
      })
    })

    it('should generate source map for boolean', () => {
      const { parseWithSourceMap } = useCborParser()
      const result = parseWithSourceMap('f5') // true

      expect(result.value).toBe(true)
      expect(result.sourceMap).toHaveLength(1)
      expect(result.sourceMap[0]).toEqual({
        path: '',
        start: 0,
        end: 1,
        majorType: 7,
        type: 'Simple: true'
      })
    })
  })

  describe('Arrays', () => {
    it('should generate source map for simple array', () => {
      const { parseWithSourceMap } = useCborParser()
      const result = parseWithSourceMap('83010203') // [1, 2, 3]

      expect(result.value).toEqual([1, 2, 3])
      expect(result.sourceMap).toHaveLength(4) // array + 3 elements

      // Array itself (header only)
      expect(result.sourceMap[0]).toMatchObject({
        path: '',
        start: 0,
        end: 1, // header only (83)
        majorType: 4,
        type: 'array(3)',
        children: ['[0]', '[1]', '[2]']
      })

      // First element
      expect(result.sourceMap[1]).toMatchObject({
        path: '[0]',
        start: 1,
        end: 2,
        majorType: 0,
        type: 'Unsigned Integer'
      })

      // Second element
      expect(result.sourceMap[2]).toMatchObject({
        path: '[1]',
        start: 2,
        end: 3,
        majorType: 0,
        type: 'Unsigned Integer'
      })

      // Third element
      expect(result.sourceMap[3]).toMatchObject({
        path: '[2]',
        start: 3,
        end: 4,
        majorType: 0,
        type: 'Unsigned Integer'
      })
    })

    it('should generate source map for nested array', () => {
      const { parseWithSourceMap } = useCborParser()
      const result = parseWithSourceMap('8201820203') // [1, [2, 3]]

      expect(result.value).toEqual([1, [2, 3]])
      expect(result.sourceMap.length).toBeGreaterThan(3)

      // Root array
      expect(result.sourceMap[0].path).toBe('')
      expect(result.sourceMap[0].majorType).toBe(4)

      // First element (integer 1)
      expect(result.sourceMap[1].path).toBe('[0]')
      expect(result.sourceMap[1].majorType).toBe(0)

      // Nested array
      expect(result.sourceMap[2].path).toBe('[1]')
      expect(result.sourceMap[2].majorType).toBe(4)

      // Elements in nested array
      expect(result.sourceMap[3].path).toBe('[1][0]')
      expect(result.sourceMap[4].path).toBe('[1][1]')
    })
  })

  describe('Maps', () => {
    it('should generate source map for simple map', () => {
      const { parseWithSourceMap } = useCborParser()
      const result = parseWithSourceMap('a16161 01'.replace(/\s/g, '')) // {a: 1}

      expect(result.value).toEqual(new Map([['a', 1]]))
      expect(result.sourceMap.length).toBeGreaterThan(0)

      // Map itself (header only)
      expect(result.sourceMap[0]).toMatchObject({
        path: '',
        start: 0,
        end: 1, // header only (a1)
        majorType: 5,
        type: 'map(1)',
        children: ['.a']
      })

      // Value for key "a"
      const valueEntry = result.sourceMap.find(e => e.path === '.a')
      expect(valueEntry).toBeDefined()
      expect(valueEntry?.majorType).toBe(0)
      expect(valueEntry?.type).toBe('Unsigned Integer')
    })

    it('should generate source map for Cardano amount example', () => {
      const { parseWithSourceMap } = useCborParser()
      // {"amount": 1000000}
      const result = parseWithSourceMap('a166616d6f756e741a000f4240')

      expect(result.value).toEqual(new Map([['amount', 1000000]]))
      expect(result.sourceMap.length).toBeGreaterThan(0)

      // Find the amount value in source map
      const amountEntry = result.sourceMap.find(e => e.path === '.amount')
      expect(amountEntry).toBeDefined()
      expect(amountEntry?.majorType).toBe(0) // unsigned integer
      expect(amountEntry?.type).toBe('Unsigned Integer')

      // The amount value should be at bytes 8-13 (1a 00 0f 42 40)
      // a1 (map) + 66 61 6d 6f 75 6e 74 ("amount") = 8 bytes, then value starts
      expect(amountEntry?.start).toBe(8)
      expect(amountEntry?.end).toBe(13)
    })

    it('should generate source map for nested map', () => {
      const { parseWithSourceMap } = useCborParser()
      // {a: {b: 2}}
      const result = parseWithSourceMap('a16161a16162 02'.replace(/\s/g, ''))

      expect(result.value).toEqual(new Map([['a', new Map([['b', 2]])]]))

      // Check nested path
      const nestedEntry = result.sourceMap.find(e => e.path === '.a.b')
      expect(nestedEntry).toBeDefined()
      expect(nestedEntry?.majorType).toBe(0)
    })
  })

  describe('Complex Structures', () => {
    it('should generate source map for array of maps', () => {
      const { parseWithSourceMap } = useCborParser()
      // [{x: 1}, {y: 2}]
      const result = parseWithSourceMap('82a16178 01a16179 02'.replace(/\s/g, ''))

      expect(result.value).toEqual([new Map([['x', 1]]), new Map([['y', 2]])])

      // Check paths
      const xEntry = result.sourceMap.find(e => e.path === '[0].x')
      const yEntry = result.sourceMap.find(e => e.path === '[1].y')

      expect(xEntry).toBeDefined()
      expect(yEntry).toBeDefined()
    })

    it('should generate source map for Cardano UTXO structure', () => {
      const { parseWithSourceMap } = useCborParser()
      // Simplified UTXO: [[txHash, index], [address, amount]]
      // Using short byte strings for simplicity
      const hex = '82' + // array of 2
                   '82' + // first element: array of 2
                   '4448bd01d5' + // 4-byte tx hash
                   '00' + // index 0
                   '82' + // second element: array of 2
                   '44000dae07' + // 4-byte address
                   '1a000f4240' // amount: 1000000

      const result = parseWithSourceMap(hex)

      expect(Array.isArray(result.value)).toBe(true)
      expect(result.sourceMap.length).toBeGreaterThan(5)

      // Root array
      expect(result.sourceMap[0].path).toBe('')
      expect(result.sourceMap[0].majorType).toBe(4)

      // First nested array [txHash, index]
      const firstArray = result.sourceMap.find(e => e.path === '[0]')
      expect(firstArray?.majorType).toBe(4)

      // Amount value
      const amountEntry = result.sourceMap.find(e => e.path === '[1][1]')
      expect(amountEntry?.majorType).toBe(0)
    })
  })

  describe('Byte Positions', () => {
    it('should have correct byte positions for all entries', () => {
      const { parseWithSourceMap } = useCborParser()
      const result = parseWithSourceMap('83010203')

      // Verify all entries have valid byte ranges
      result.sourceMap.forEach(entry => {
        expect(entry.start).toBeGreaterThanOrEqual(0)
        expect(entry.end).toBeGreaterThan(entry.start)
        expect(entry.end).toBeLessThanOrEqual(4) // total bytes
      })
    })

    it('should have non-overlapping byte ranges for siblings', () => {
      const { parseWithSourceMap } = useCborParser()
      const result = parseWithSourceMap('83010203')

      // Get sibling elements (array elements)
      const elements = result.sourceMap.filter(e => e.path.match(/^\[\d+\]$/))

      // Verify no overlaps between siblings
      for (let i = 0; i < elements.length - 1; i++) {
        expect(elements[i].end).toBeLessThanOrEqual(elements[i + 1].start)
      }
    })
  })

  describe('Byte String Content Highlighting', () => {
    it('should create separate header and content entries for byte strings', () => {
      const { parseWithSourceMap } = useCborParser()
      // 58 20 = bytes(32), followed by 32 bytes of data
      const result = parseWithSourceMap('582048bd01d51e580cde15afa6d28f63d89c9137b93a910e5941192e26b12906106700')

      // Should have 2 entries: header + content
      expect(result.sourceMap).toHaveLength(2)

      // Header entry
      const headerEntry = result.sourceMap[0]
      expect(headerEntry.path).toBe('')
      expect(headerEntry.start).toBe(0)
      expect(headerEntry.end).toBe(2) // 58 20
      expect(headerEntry.isHeader).toBe(true)
      expect(headerEntry.contentPath).toBe('#content')
      expect(headerEntry.children).toContain('#content')

      // Content entry
      const contentEntry = result.sourceMap[1]
      expect(contentEntry.path).toBe('#content')
      expect(contentEntry.start).toBe(2) // After header
      expect(contentEntry.end).toBe(34) // 32 bytes of data
      expect(contentEntry.isContent).toBe(true)
      expect(contentEntry.parent).toBe('')
    })

    it('should create separate header and content entries for nested byte strings', () => {
      const { parseWithSourceMap } = useCborParser()
      // Array containing a 32-byte byte string
      // 82 = array(2), 58 20 = bytes(32), followed by 32 bytes, then 00 = integer 0
      const result = parseWithSourceMap('82582048bd01d51e580cde15afa6d28f63d89c9137b93a910e5941192e26b12906106700 00'.replace(/\s/g, ''))

      // Find the byte string header and content entries
      const byteStringHeader = result.sourceMap.find(e => e.path === '[0]' && e.isHeader)
      const byteStringContent = result.sourceMap.find(e => e.path === '[0]#content' && e.isContent)

      expect(byteStringHeader).toBeDefined()
      expect(byteStringContent).toBeDefined()

      // Header should be at bytes 1-3 (82 58 20)
      expect(byteStringHeader?.start).toBe(1)
      expect(byteStringHeader?.end).toBe(3)
      expect(byteStringHeader?.contentPath).toBe('[0]#content')

      // Content should be at bytes 3-35 (32 bytes of data)
      expect(byteStringContent?.start).toBe(3)
      expect(byteStringContent?.end).toBe(35)
      expect(byteStringContent?.parent).toBe('[0]')
    })
  })
})
