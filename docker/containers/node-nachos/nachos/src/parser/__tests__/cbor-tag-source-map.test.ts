/**
 * Tag Source Map Generation Test Suite
 * Tests hierarchical source map generation for nested tagged values
 */

import { describe, it, expect } from 'vitest'
import { useCborParser } from '../composables/useCborParser'

describe('Tag Source Map Generation', () => {
  describe('Simple Tagged Values', () => {
    it('should create source map entry for tag and value', () => {
      const { parseWithSourceMap } = useCborParser()
      // Tag 121 containing integer 42: d8 79 18 2a
      const result = parseWithSourceMap('d879182a')

      console.log('Source map entries:', result.sourceMap.length)
      console.log(JSON.stringify(result.sourceMap, null, 2))

      // Should have 2 entries: tag and integer value
      expect(result.sourceMap).toHaveLength(2)

      // Tag entry (entire structure)
      expect(result.sourceMap[0]).toMatchObject({
        path: '',
        start: 0,
        end: 2,
        majorType: 6,
        type: 'tag(121)'
      })
      expect(result.sourceMap[0].children).toEqual(['.value'])

      // Value entry (the integer)
      expect(result.sourceMap[1]).toMatchObject({
        path: '.value',
        start: 2,
        end: 4,
        majorType: 0,
        type: 'Unsigned Integer',
        parent: ''
      })
    })

    it('should handle tag with string value', () => {
      const { parseWithSourceMap } = useCborParser()
      // Tag 0 (date/time) containing "2013-03-21T20:04:00Z"
      const result = parseWithSourceMap('c074323031332d30332d32315432303a30343a30305a')

      expect(result.sourceMap).toHaveLength(3)

      expect(result.sourceMap[0]).toMatchObject({
        path: '',
        majorType: 6,
        type: 'tag(0)'
      })

      // String header
      expect(result.sourceMap[1]).toMatchObject({
        path: '.value',
        majorType: 3,
        isHeader: true
      })

      // String content
      expect(result.sourceMap[2]).toMatchObject({
        path: '.value#content',
        parent: '.value'
      })
    })

    it('should handle tag with array value', () => {
      const { parseWithSourceMap } = useCborParser()
      // Tag 121 containing [1, 2, 3]
      const result = parseWithSourceMap('d87983010203')

      // Tag + array + 3 elements = 5 entries
      expect(result.sourceMap.length).toBeGreaterThanOrEqual(2)

      // Tag entry
      const tagEntry = result.sourceMap.find(e => e.path === '')
      expect(tagEntry).toBeDefined()
      expect(tagEntry?.majorType).toBe(6)
      expect(tagEntry?.children).toContain('.value')

      // Array entry
      const arrayEntry = result.sourceMap.find(e => e.path === '.value')
      expect(arrayEntry).toBeDefined()
      expect(arrayEntry?.majorType).toBe(4)
      expect(arrayEntry?.parent).toBe('')
    })
  })

  describe('Nested Tagged Values', () => {
    it('should create source map for tag in tag', () => {
      const { parseWithSourceMap } = useCborParser()
      // Tag 121 containing Tag 121 containing empty array
      // d8 79 81 d8 79 80
      const result = parseWithSourceMap('d87981d87980')

      expect(result.sourceMap.length).toBeGreaterThanOrEqual(4)

      // Outer tag
      const outerTag = result.sourceMap.find(e => e.path === '')
      expect(outerTag).toBeDefined()
      expect(outerTag?.majorType).toBe(6)
      expect(outerTag?.type).toBe('tag(121)')
      expect(outerTag?.children).toEqual(['.value'])

      // Array inside outer tag
      const array = result.sourceMap.find(e => e.path === '.value')
      expect(array).toBeDefined()
      expect(array?.majorType).toBe(4)
      expect(array?.parent).toBe('')
      expect(array?.children).toContain('.value[0]')

      // Inner tag
      const innerTag = result.sourceMap.find(e => e.path === '.value[0]')
      expect(innerTag).toBeDefined()
      expect(innerTag?.majorType).toBe(6)
      expect(innerTag?.type).toBe('tag(121)')
      expect(innerTag?.parent).toBe('.value')
      expect(innerTag?.children).toEqual(['.value[0].value'])

      // Empty array inside inner tag
      const emptyArray = result.sourceMap.find(e => e.path === '.value[0].value')
      expect(emptyArray).toBeDefined()
      expect(emptyArray?.majorType).toBe(4)
      expect(emptyArray?.parent).toBe('.value[0]')
    })

    it('should handle deeply nested tags (3 levels)', () => {
      const { parseWithSourceMap } = useCborParser()
      // Tag 121 -> [Tag 121 -> [Tag 121 -> []]]
      const result = parseWithSourceMap('d87981d87981d87980')

      // Should have entries for all levels
      expect(result.sourceMap.find(e => e.path === '')).toBeDefined()
      expect(result.sourceMap.find(e => e.path === '.value')).toBeDefined()
      expect(result.sourceMap.find(e => e.path === '.value[0]')).toBeDefined()
      expect(result.sourceMap.find(e => e.path === '.value[0].value')).toBeDefined()
      expect(result.sourceMap.find(e => e.path === '.value[0].value[0]')).toBeDefined()
      expect(result.sourceMap.find(e => e.path === '.value[0].value[0].value')).toBeDefined()
    })
  })

  describe('Real-World Cardano Example', () => {
    it('should create source map for tag in array in tag (user example)', () => {
      const { parseWithSourceMap } = useCborParser()
      // Real example: Tag 121 with array containing strings, integers, and nested tag
      const hex = 'd8799f' +  // Tag 121, indefinite array
        '5773747265616d5f6d677870763171645f356b65376e6b6a' +  // String
        '581c2fc2a082557dc6a74dfc42d204a6d3ff1a241c103c0bbdd2f3525ce6' +  // Byte string
        '581cd8b6a54c95aac8970bcfbf625bb694336c43baa40aa1fc50952563f4' +  // Byte string
        '1a03473bc0' +  // Integer
        '1a064528dc' +  // Integer
        '1a064544e8' +  // Integer
        '1a06467a5c' +  // Integer
        '00' +  // Integer 0
        'd87980' +  // Tag 121 with empty array (nested tag)
        'ff'  // Break

      const result = parseWithSourceMap(hex)

      // Find the nested tag entry at end of array
      const nestedTagPath = '.value[8]'
      const nestedTagEntry = result.sourceMap.find(e => e.path === nestedTagPath)

      expect(nestedTagEntry).toBeDefined()
      expect(nestedTagEntry?.majorType).toBe(6)
      expect(nestedTagEntry?.type).toBe('tag(121)')
      expect(nestedTagEntry?.parent).toBe('.value')  // Parent is the array
      expect(nestedTagEntry?.children).toContain('.value[8].value')

      // Find the empty array inside the nested tag
      const nestedArrayPath = '.value[8].value'
      const nestedArrayEntry = result.sourceMap.find(e => e.path === nestedArrayPath)

      expect(nestedArrayEntry).toBeDefined()
      expect(nestedArrayEntry?.majorType).toBe(4)
      expect(nestedArrayEntry?.type).toBe('array(0)')
      expect(nestedArrayEntry?.parent).toBe(nestedTagPath)
    })
  })

  describe('Plutus Constructor Tags', () => {
    it('should create source maps for compact constructors (121-127)', () => {
      const { parseWithSourceMap } = useCborParser()

      // Tag 122 (Constructor 1, 1 field)
      const result = parseWithSourceMap('d87a81182a')  // Just 42

      const tagEntry = result.sourceMap.find(e => e.path === '')
      expect(tagEntry?.type).toBe('tag(122)')
      expect(tagEntry?.children).toEqual(['.value'])

      const arrayEntry = result.sourceMap.find(e => e.path === '.value')
      expect(arrayEntry?.majorType).toBe(4)
      expect(arrayEntry?.parent).toBe('')
    })

    it('should create source maps for extended constructors (1280-1400)', () => {
      const { parseWithSourceMap } = useCborParser()

      // Tag 1283 (Constructor 10)
      const result = parseWithSourceMap('d9050383010203')

      const tagEntry = result.sourceMap.find(e => e.path === '')
      expect(tagEntry?.type).toBe('tag(1283)')
      expect(tagEntry?.children).toEqual(['.value'])

      const arrayEntry = result.sourceMap.find(e => e.path === '.value')
      expect(arrayEntry?.majorType).toBe(4)
      expect(arrayEntry?.parent).toBe('')
    })

    it('should create source maps for alternative constructor (tag 102)', () => {
      const { parseWithSourceMap } = useCborParser()

      // Tag 102 with [200, [99]]
      const result = parseWithSourceMap('d8668218c8811863')

      const tagEntry = result.sourceMap.find(e => e.path === '')
      expect(tagEntry?.type).toBe('tag(102)')
      expect(tagEntry?.children).toEqual(['.value'])

      // Value is array [200, [99]]
      const valueEntry = result.sourceMap.find(e => e.path === '.value')
      expect(valueEntry?.majorType).toBe(4)
      expect(valueEntry?.parent).toBe('')
    })
  })

  describe('Parent-Child Relationship Validation', () => {
    it('should maintain correct parent-child links', () => {
      const { parseWithSourceMap } = useCborParser()
      const result = parseWithSourceMap('d87981d87980')

      // Verify bidirectional relationships
      const outerTag = result.sourceMap.find(e => e.path === '')
      expect(outerTag?.children).toContain('.value')

      const array = result.sourceMap.find(e => e.path === '.value')
      expect(array?.parent).toBe('')
      expect(array?.children).toContain('.value[0]')

      const innerTag = result.sourceMap.find(e => e.path === '.value[0]')
      expect(innerTag?.parent).toBe('.value')
      expect(innerTag?.children).toContain('.value[0].value')

      const emptyArray = result.sourceMap.find(e => e.path === '.value[0].value')
      expect(emptyArray?.parent).toBe('.value[0]')
    })

    it('should have all children referenced by parents', () => {
      const { parseWithSourceMap } = useCborParser()
      const result = parseWithSourceMap('d87983010203')

      // Find all entries with children
      const entriesWithChildren = result.sourceMap.filter(e => e.children && e.children.length > 0)

      // Verify all children exist in source map
      for (const entry of entriesWithChildren) {
        for (const childPath of entry.children!) {
          const childEntry = result.sourceMap.find(e => e.path === childPath)
          expect(childEntry).toBeDefined()
          expect(childEntry?.parent).toBe(entry.path)
        }
      }
    })
  })

  describe('Byte Range Validation', () => {
    it('should have correct byte offsets for nested tags', () => {
      const { parseWithSourceMap } = useCborParser()
      // d8 79 81 d8 79 80
      // 0  1  2  3  4  5
      const result = parseWithSourceMap('d87981d87980')

      const outerTag = result.sourceMap.find(e => e.path === '')
      expect(outerTag?.start).toBe(0)
      expect(outerTag?.end).toBe(2)  // Header only (d8 79)

      const array = result.sourceMap.find(e => e.path === '.value')
      expect(array?.start).toBe(2)
      expect(array?.end).toBe(3)  // Header only (81)

      const innerTag = result.sourceMap.find(e => e.path === '.value[0]')
      expect(innerTag?.start).toBe(3)
      expect(innerTag?.end).toBe(5)  // Header only (d8 79)

      const emptyArray = result.sourceMap.find(e => e.path === '.value[0].value')
      expect(emptyArray?.start).toBe(5)
      expect(emptyArray?.end).toBe(6)  // Header only (80)
    })

    it('should have non-overlapping value ranges for siblings', () => {
      const { parseWithSourceMap } = useCborParser()
      // Tag 121 with [1, 2, 3]
      const result = parseWithSourceMap('d87983010203')

      const element0 = result.sourceMap.find(e => e.path === '.value[0]')
      const element1 = result.sourceMap.find(e => e.path === '.value[1]')
      const element2 = result.sourceMap.find(e => e.path === '.value[2]')

      expect(element0).toBeDefined()
      expect(element1).toBeDefined()
      expect(element2).toBeDefined()

      // Siblings should not overlap
      expect(element0!.end).toBeLessThanOrEqual(element1!.start)
      expect(element1!.end).toBeLessThanOrEqual(element2!.start)
    })
  })

  describe('Edge Cases', () => {
    it('should handle tag with empty array', () => {
      const { parseWithSourceMap } = useCborParser()
      const result = parseWithSourceMap('d87980')  // Tag 121, []

      expect(result.sourceMap.length).toBeGreaterThanOrEqual(2)

      const tagEntry = result.sourceMap.find(e => e.path === '')
      expect(tagEntry?.children).toEqual(['.value'])

      const arrayEntry = result.sourceMap.find(e => e.path === '.value')
      expect(arrayEntry?.parent).toBe('')
      expect(arrayEntry?.children).toBeUndefined()  // Empty array has no children
    })

    it('should handle tag in map value', () => {
      const { parseWithSourceMap } = useCborParser()
      // Map with {"key": Tag 121 [42]}
      const result = parseWithSourceMap('a1636b6579d87981182a')

      const mapEntry = result.sourceMap.find(e => e.path === '')
      expect(mapEntry?.majorType).toBe(5)

      const tagEntry = result.sourceMap.find(e => e.path === '.key')
      expect(tagEntry?.majorType).toBe(6)
      expect(tagEntry?.children).toEqual(['.key.value'])

      const arrayEntry = result.sourceMap.find(e => e.path === '.key.value')
      expect(arrayEntry?.majorType).toBe(4)
      expect(arrayEntry?.parent).toBe('.key')
    })

    it('should handle array of tags', () => {
      const { parseWithSourceMap } = useCborParser()
      // [Tag 121 [], Tag 121 []]
      const result = parseWithSourceMap('82d87980d87980')

      const tag0 = result.sourceMap.find(e => e.path === '[0]')
      expect(tag0?.majorType).toBe(6)
      expect(tag0?.children).toEqual(['[0].value'])

      const tag1 = result.sourceMap.find(e => e.path === '[1]')
      expect(tag1?.majorType).toBe(6)
      expect(tag1?.children).toEqual(['[1].value'])
    })
  })
})
