/**
 * CBOR Collection Parser Error Handling Tests
 * Tests all error cases and edge cases for 100% code coverage
 */

import { describe, it, expect } from 'vitest'
import { useCborCollection } from '../composables/useCborCollection'

describe('useCborCollection - Error Handling', () => {
  describe('parseItem - Unexpected End of Buffer', () => {
    it('should throw error when offset is at end of buffer', () => {
      const { parseArray } = useCborCollection()

      // Array with 2 elements, but only 1 element provided
      // 82 (array of 2) + 01 (element 1) - missing element 2
      expect(() => parseArray('8201')).toThrow('Unexpected end of buffer')
    })

    it('should throw error when buffer ends mid-element', () => {
      const { parseArray } = useCborCollection()

      // Array with nested array that's incomplete
      // 82 (array of 2) + 01 (element 1) + 82 (nested array of 2, incomplete)
      expect(() => parseArray('820182')).toThrow('Unexpected end of buffer')
    })
  })

  describe('parseItem - Tag Parsing Support', () => {
    it('should successfully parse array containing a tag', () => {
      const { parseArray } = useCborCollection()

      // Array containing a tag (now properly supported)
      // 81 (array of 1) + c0 (tag 0) + 00 (value)
      const result = parseArray('81c000')
      expect(result.value).toBeInstanceOf(Array)
      expect(result.value).toHaveLength(1)
      expect(result.value[0].tag).toBe(0)
      expect(result.value[0].value).toBe(0)
    })

    it('should successfully parse map with tag as value', () => {
      const { parseMap } = useCborCollection()

      // Map with tag as value (now properly supported)
      // a1 (map of 1) + 01 (key) + c0 (tag 0) + 00 (value)
      const result = parseMap('a101c000')
      expect(result.value.get(1)).toBeDefined()
      expect(result.value.get(1).tag).toBe(0)
      expect(result.value.get(1).value).toBe(0)
    })
  })

  describe('parseLength - All Encoding Sizes for Collections', () => {
    it('should parse array with 4-byte length (AI 26)', () => {
      const { parseArray } = useCborCollection()

      // Array with 1000 elements (using 4-byte length)
      // 9a (MT 4, AI 26) + 000003e8 (1000 in 4 bytes) + 1000x 00 (zeros)
      const elements = '00'.repeat(1000)
      const result = parseArray('9a000003e8' + elements)
      expect(result.value.length).toBe(1000)
    })

    it('should parse array with 8-byte length (AI 27)', () => {
      const { parseArray } = useCborCollection()

      // Array with 100 elements (using 8-byte length)
      // 9b (MT 4, AI 27) + 0000000000000064 (100 in 8 bytes) + 100x 00
      const elements = '00'.repeat(100)
      const result = parseArray('9b0000000000000064' + elements)
      expect(result.value.length).toBe(100)
    })

    it('should parse map with 4-byte length (AI 26)', () => {
      const { parseMap } = useCborCollection()

      // Map with 100 entries (using 4-byte length)
      // ba (MT 5, AI 26) + 00000064 (100 in 4 bytes) + 100x unique key-value pairs
      // Use 1-byte encoding for keys to avoid reserved AI values (28-31)
      const entries = Array.from({ length: 100 }, (_, i) => {
        const keyHex = '18' + (24 + i).toString(16).padStart(2, '0')
        const valueHex = '18' + (124 + i).toString(16).padStart(2, '0')
        return keyHex + valueHex
      }).join('')
      const result = parseMap('ba00000064' + entries)
      expect(result.value.size).toBe(100)
    })

    it('should parse map with 8-byte length (AI 27)', () => {
      const { parseMap } = useCborCollection()

      // Map with 50 entries (using 8-byte length)
      // bb (MT 5, AI 27) + 0000000000000032 (50 in 8 bytes) + 50x unique key-value pairs
      const entries = Array.from({ length: 50 }, (_, i) => {
        const keyHex = '18' + (30 + i).toString(16).padStart(2, '0')
        const valueHex = '18' + (80 + i).toString(16).padStart(2, '0')
        return keyHex + valueHex
      }).join('')
      const result = parseMap('bb0000000000000032' + entries)
      expect(result.value.size).toBe(50)
    })
  })

  describe('parseLength - Invalid Additional Info', () => {
    it('should throw error for array with reserved AI 28', () => {
      const { parseArray } = useCborCollection()

      // MT 4, AI 28 - reserved
      expect(() => parseArray('9c')).toThrow('Invalid additional info: 28')
    })

    it('should throw error for array with reserved AI 29', () => {
      const { parseArray } = useCborCollection()

      // MT 4, AI 29 - reserved
      expect(() => parseArray('9d')).toThrow('Invalid additional info: 29')
    })

    it('should throw error for array with reserved AI 30', () => {
      const { parseArray } = useCborCollection()

      // MT 4, AI 30 - reserved
      expect(() => parseArray('9e')).toThrow('Invalid additional info: 30')
    })

    it('should throw error for map with reserved AI 28', () => {
      const { parseMap } = useCborCollection()

      // MT 5, AI 28 - reserved
      expect(() => parseMap('bc')).toThrow('Invalid additional info: 28')
    })

    it('should throw error for map with reserved AI 29', () => {
      const { parseMap } = useCborCollection()

      // MT 5, AI 29 - reserved
      expect(() => parseMap('bd')).toThrow('Invalid additional info: 29')
    })

    it('should throw error for map with reserved AI 30', () => {
      const { parseMap } = useCborCollection()

      // MT 5, AI 30 - reserved
      expect(() => parseMap('be')).toThrow('Invalid additional info: 30')
    })
  })

  describe('parseArray - Wrong Major Type', () => {
    it('should throw error when major type is not 4', () => {
      const { parseArray } = useCborCollection()

      // MT 0 (integer) is not an array
      expect(() => parseArray('00')).toThrow('Expected major type 4 (array), got 0')
    })

    it('should throw error for MT 5 (map)', () => {
      const { parseArray } = useCborCollection()

      // MT 5 (map) is not an array
      expect(() => parseArray('a0')).toThrow('Expected major type 4 (array), got 5')
    })
  })

  describe('parseMap - Wrong Major Type', () => {
    it('should throw error when major type is not 5', () => {
      const { parseMap } = useCborCollection()

      // MT 0 (integer) is not a map
      expect(() => parseMap('00')).toThrow('Expected major type 5 (map), got 0')
    })

    it('should throw error for MT 4 (array)', () => {
      const { parseMap } = useCborCollection()

      // MT 4 (array) is not a map
      expect(() => parseMap('80')).toThrow('Expected major type 5 (map), got 4')
    })
  })

  describe('parseArray - Insufficient Data', () => {
    it('should throw error when array element is missing', () => {
      const { parseArray } = useCborCollection()

      // Array of 3, but only 2 elements
      expect(() => parseArray('830102')).toThrow('Unexpected end of buffer while parsing array element 2/3')
    })

    it('should throw error when nested array is incomplete', () => {
      const { parseArray } = useCborCollection()

      // Array with incomplete nested structure
      // 82 (array of 2) + 01 + 8301 (nested array of 3 with only 1 element)
      expect(() => parseArray('8201830102')).toThrow('Unexpected end of buffer while parsing array element 2/3')
    })
  })

  describe('parseMap - Insufficient Data', () => {
    it('should throw error when map entry is missing', () => {
      const { parseMap } = useCborCollection()

      // Map of 2, but only 1 entry
      expect(() => parseMap('a20102')).toThrow('Unexpected end of buffer while parsing map entry 1/2')
    })

    it('should throw error when map value is missing', () => {
      const { parseMap } = useCborCollection()

      // Map of 1, with key but no value
      expect(() => parseMap('a101')).toThrow('Unexpected end of buffer while parsing map value for entry 0/1')
    })

    it('should throw error in indefinite map when value is missing after key', () => {
      const { parseMap } = useCborCollection()

      // Indefinite map with key but no value before break
      // bf (indefinite map) + 01 (key) - missing value
      expect(() => parseMap('bf01')).toThrow('Unexpected end of buffer while parsing map value')
    })
  })

  describe('Indefinite-Length Collections', () => {
    it('should parse indefinite array with proper break', () => {
      const { parseArray } = useCborCollection()

      // 9f (indefinite array) + 01 02 03 + ff (break)
      const result = parseArray('9f010203ff')
      // Use spread to get clean array without Symbol metadata
      expect([...result.value]).toEqual([1, 2, 3])
    })

    it('should parse indefinite map with proper break', () => {
      const { parseMap } = useCborCollection()

      // bf (indefinite map) + 01 02 03 04 + ff (break)
      const result = parseMap('bf01020304ff')
      // Use spread to get clean map without Symbol metadata
      expect(new Map([...result.value])).toEqual(new Map([[1, 2], [3, 4]]))
    })

    it('should parse nested indefinite structures', () => {
      const { parseArray } = useCborCollection()

      // 9f (indefinite array) + 9f 01 ff (nested indefinite array [1]) + ff (break)
      const result = parseArray('9f9f01ffff')
      // Use spread to get clean arrays without Symbol metadata
      expect([...result.value].map(inner => [...inner])).toEqual([[1]])
    })
  })

  describe('Complex Nested Structures', () => {
    it('should parse deeply nested arrays', () => {
      const { parseArray } = useCborCollection()

      // [[[[1]]]]
      const result = parseArray('81818181 01'.replace(/\s/g, ''))
      expect(result.value).toEqual([[[[1]]]])
    })

    it('should parse map with array values', () => {
      const { parseMap } = useCborCollection()

      // {"a": [1, 2], "b": [3, 4]}
      const result = parseMap('a261618201026162820304')
      expect(result.value).toEqual(new Map([['a', [1, 2]], ['b', [3, 4]]]))
    })

    it('should parse array with map values', () => {
      const { parseArray } = useCborCollection()

      // [{"x": 1}, {"y": 2}]
      const result = parseArray('82a16178 01a16179 02'.replace(/\s/g, ''))
      expect(result.value).toEqual([new Map([['x', 1]]), new Map([['y', 2]])])
    })
  })

  describe('All Major Types in Collections', () => {
    it('should parse array containing all major types', () => {
      const { parseArray } = useCborCollection()

      // Array with: integer, negative, text string, byte string, array, map, simple
      // [0, -1, "", h'', [], {}, false]
      // 87 (array of 7) + 00 (0) + 20 (-1) + 60 ("") + 40 (h'') + 80 ([]) + a0 ({}) + f4 (false)
      const result = parseArray('8700206040 80a0f4'.replace(/\s/g, ''))
      expect(result.value).toEqual([0, -1, '', new Uint8Array([]), [], new Map(), false])
    })

    it('should handle map with various key types', () => {
      const { parseMap } = useCborCollection()

      // Map with integer and string keys
      // {1: "a", "b": 2}
      const result = parseMap('a2016161616202')
      expect(result.value).toEqual(new Map([[1, 'a'], ['b', 2]]))
    })
  })
})
