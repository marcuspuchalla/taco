/**
 * CBOR Duplicate Map Key Detection Tests
 * Tests RFC 8949 Section 5.6 requirement for strict mode
 *
 * RFC 8949: "A map that has duplicate keys may be well-formed, but it is not valid,
 * and duplicate keys are prohibited by CBOR decoders that are using strict mode."
 *
 * Tests cover:
 * - Duplicate key detection with different modes ('allow', 'warn', 'reject')
 * - Various key types (strings, integers, byte strings)
 * - Nested maps with duplicates
 * - Real-world Cardano scenarios
 */

import { describe, it, expect, vi } from 'vitest'
import { useCborParser } from '../composables/useCborParser'

describe('useCborParser - Duplicate Map Key Detection', () => {
  describe('Allow Mode (default)', () => {
    it('should allow duplicate string keys by default', () => {
      const { parseWithSourceMap } = useCborParser()

      // Map with duplicate key "a": {"a": 1, "a": 2}
      // a2 6161 01 6161 02
      const duplicateHex = 'a2616101616102'

      const result = parseWithSourceMap(duplicateHex)

      expect(result.value).toBeDefined()
      // Last value wins in JavaScript objects
      expect(result.value.get("a")).toBe(2)
    })

    it('should allow duplicate integer keys by default', () => {
      const { parseWithSourceMap } = useCborParser()

      // Map with duplicate key 1: {1: 10, 1: 20}
      // a2 01 0a 01 14
      const duplicateHex = 'a2010a0114'

      const result = parseWithSourceMap(duplicateHex)

      expect(result.value).toBeDefined()
      expect(result.value.get(1)).toBe(20)
    })
  })

  describe('Warn Mode', () => {
    it('should warn but not throw on duplicate keys', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const { parseWithSourceMap } = useCborParser()

      // Map: {"a": 1, "a": 2}
      const duplicateHex = 'a2616101616102'

      const result = parseWithSourceMap(duplicateHex, {
        dupMapKeyMode: 'warn'
      })

      expect(result.value).toBeDefined()
      expect(consoleWarnSpy).toHaveBeenCalled()
      expect(consoleWarnSpy.mock.calls[0][0]).toContain('Duplicate map key')

      consoleWarnSpy.mockRestore()
    })

    it('should warn multiple times for multiple duplicates', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const { parseWithSourceMap } = useCborParser()

      // Map: {"a": 1, "a": 2, "a": 3}
      // a3 6161 01 6161 02 6161 03
      const duplicateHex = 'a3616101616102616103'

      parseWithSourceMap(duplicateHex, {
        dupMapKeyMode: 'warn'
      })

      // Should warn twice (second and third occurrence)
      expect(consoleWarnSpy).toHaveBeenCalledTimes(2)

      consoleWarnSpy.mockRestore()
    })
  })

  describe('Reject Mode (strict)', () => {
    it('should throw error on duplicate string keys', () => {
      const { parseWithSourceMap } = useCborParser()

      // Map: {"a": 1, "a": 2}
      const duplicateHex = 'a2616101616102'

      expect(() => {
        parseWithSourceMap(duplicateHex, {
          dupMapKeyMode: 'reject'
        })
      }).toThrow(/Duplicate map key/)
    })

    it('should throw error on duplicate integer keys', () => {
      const { parseWithSourceMap } = useCborParser()

      // Map: {1: 10, 1: 20}
      const duplicateHex = 'a2010a0114'

      expect(() => {
        parseWithSourceMap(duplicateHex, {
          dupMapKeyMode: 'reject'
        })
      }).toThrow(/Duplicate map key/)
    })

    it('should throw on first duplicate encountered', () => {
      const { parseWithSourceMap } = useCborParser()

      // Map: {"a": 1, "a": 2, "b": 3, "b": 4}
      // Should fail at second "a"
      const duplicateHex = 'a4616101616102616203616204'

      expect(() => {
        parseWithSourceMap(duplicateHex, {
          dupMapKeyMode: 'reject'
        })
      }).toThrow(/Duplicate map key/)
    })
  })

  describe('Different Key Types', () => {
    it('should NOT flag different keys of same type', () => {
      const { parseWithSourceMap } = useCborParser()

      // Map: {"a": 1, "b": 2} - different keys, no error
      // a2 6161 01 6162 02
      const uniqueHex = 'a2616101616202'

      const result = parseWithSourceMap(uniqueHex, {
        dupMapKeyMode: 'reject'
      })

      expect(result.value).toBeDefined()
      expect(result.value).toEqual(new Map([['a', 1], ['b', 2]]))
    })

    it('should handle byte string keys correctly', () => {
      const { parseWithSourceMap } = useCborParser()

      // Map with duplicate byte string key
      // {h'01': 1, h'01': 2}
      // a2 4101 01 4101 02
      const duplicateHex = 'a2410101410102'

      expect(() => {
        parseWithSourceMap(duplicateHex, {
          dupMapKeyMode: 'reject'
        })
      }).toThrow(/Duplicate map key/)
    })
  })

  describe('Nested Maps', () => {
    it('should detect duplicates in nested maps', () => {
      const { parseWithSourceMap } = useCborParser()

      // Map: {"outer": {"inner": 1, "inner": 2}}
      // a1 656f75746572 a2 65696e6e6572 01 65696e6e6572 02
      const duplicateHex = 'a1656f75746572a26569' + '6e6e65720165696e6e657202'

      expect(() => {
        parseWithSourceMap(duplicateHex, {
          dupMapKeyMode: 'reject'
        })
      }).toThrow(/Duplicate map key/)
    })

    it('should allow same keys in different nested maps', () => {
      const { parseWithSourceMap } = useCborParser()

      // Map: {"map1": {"a": 1}, "map2": {"a": 2}}
      // Same key "a" in different maps - OK
      // a2 646d617031 a1616101 646d617032 a1616102
      const validHex = 'a2646d617031a1616101646d617032a1616102'

      const result = parseWithSourceMap(validHex, {
        dupMapKeyMode: 'reject'
      })

      expect(result.value).toBeDefined()
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty maps', () => {
      const { parseWithSourceMap } = useCborParser()

      // Empty map: {}
      const emptyHex = 'a0'

      const result = parseWithSourceMap(emptyHex, {
        dupMapKeyMode: 'reject'
      })

      expect(result.value).toEqual(new Map())
    })

    it('should handle single-entry maps', () => {
      const { parseWithSourceMap } = useCborParser()

      // Map: {"a": 1}
      const singleHex = 'a1616101'

      const result = parseWithSourceMap(singleHex, {
        dupMapKeyMode: 'reject'
      })

      expect(result.value).toEqual(new Map([['a', 1]]))
    })

    it('should handle large maps without duplicates', () => {
      const { parseWithSourceMap } = useCborParser()

      // Map with 10 unique keys
      // {"a": 1, "b": 2, ..., "j": 10}
      const largeHex = 'aa616101616202616303616404616505616606616707616808616909616a0a'

      const result = parseWithSourceMap(largeHex, {
        dupMapKeyMode: 'reject'
      })

      expect(result.value).toBeDefined()
      expect(result.value.size).toBe(10)
    })
  })
})
