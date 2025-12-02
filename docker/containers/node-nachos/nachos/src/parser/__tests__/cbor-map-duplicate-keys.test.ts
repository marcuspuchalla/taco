/**
 * CBOR Map Duplicate Keys Detection Tests
 *
 * RFC 8949 Section 5.6:
 * "Duplicate keys in maps SHOULD be rejected in applications requiring
 * deterministic encoding"
 *
 * CRITICAL FOR CARDANO TRANSACTION SECURITY:
 * - Prevents attacker from creating ambiguous transactions
 * - Ensures all decoders see the same data
 * - Required for safe signature verification
 */

import { describe, it, expect } from 'vitest'
import { useCborParser } from '../composables/useCborParser'
import { useCborCollection } from '../composables/useCborCollection'

describe('CBOR Map Duplicate Key Detection', () => {
  describe('String Keys - Duplicate Detection', () => {
    it('should reject map with duplicate string keys when rejectDuplicateKeys is true', () => {
      const { parseMap } = useCborCollection()

      // Map: {"a": 1, "b": 2, "a": 3} - duplicate "a"
      // a2 (map of 3) + 6161 ("a") + 01 + 6162 ("b") + 02 + 6161 ("a") + 03
      const duplicateMap = 'a3616101616202616103'

      expect(() => parseMap(duplicateMap, { dupMapKeyMode: 'reject' }))
        .toThrow(/duplicate.*key/i)
    })

    it('should reject map with multiple duplicate string keys', () => {
      const { parseMap } = useCborCollection()

      // Map: {"x": 1, "x": 2, "x": 3} - all keys duplicate
      const allDuplicates = 'a3617801617802617803'

      expect(() => parseMap(allDuplicates, { dupMapKeyMode: 'reject' }))
        .toThrow(/duplicate.*key/i)
    })

    it('should allow duplicate keys when rejectDuplicateKeys is false', () => {
      const { parseMap } = useCborCollection()

      // Map: {"a": 1, "a": 2} - duplicates allowed in lenient mode
      const duplicateMap = 'a2616101616102'

      const result = parseMap(duplicateMap, { dupMapKeyMode: 'allow' })

      // Last value wins in JavaScript objects
      expect(result.value).toEqual(new Map([['a', 2]]))
    })

    it('should reject map with duplicate keys separated by other keys', () => {
      const { parseMap } = useCborCollection()

      // Map: {"a": 1, "b": 2, "c": 3, "a": 4} - "a" appears twice
      const scattered = 'a4616101616202616303616104'

      expect(() => parseMap(scattered, { dupMapKeyMode: 'reject' }))
        .toThrow(/duplicate.*key/i)
    })

    it('should handle case-sensitive duplicate detection', () => {
      const { parseMap } = useCborCollection()

      // Map: {"a": 1, "A": 2} - different keys (case-sensitive)
      const caseDifferent = 'a2616101614102'

      const result = parseMap(caseDifferent, { dupMapKeyMode: 'reject' })
      expect(result.value).toEqual(new Map([['a', 1], ['A', 2]]))
    })

    it('should reject exact duplicate strings', () => {
      const { parseMap } = useCborCollection()

      // Map: {"hello": 1, "world": 2, "hello": 3}
      const duplicateHello = 'a36568656c6c6f0165776f726c64026568656c6c6f03'

      expect(() => parseMap(duplicateHello, { dupMapKeyMode: 'reject' }))
        .toThrow(/duplicate.*key/i)
    })
  })

  describe('Integer Keys - Duplicate Detection', () => {
    it('should reject map with duplicate positive integer keys', () => {
      const { parseMap } = useCborCollection()

      // Map: {1: 10, 2: 20, 1: 30} - duplicate key 1
      const duplicateInt = 'a3010a020b010c'

      expect(() => parseMap(duplicateInt, { dupMapKeyMode: 'reject' }))
        .toThrow(/duplicate.*key/i)
    })

    it('should reject map with duplicate negative integer keys', () => {
      const { parseMap } = useCborCollection()

      // Map: {-1: 10, -2: 20, -1: 30} - duplicate key -1
      const duplicateNeg = 'a320 0a210b200c'

      expect(() => parseMap(duplicateNeg, { dupMapKeyMode: 'reject' }))
        .toThrow(/duplicate.*key/i)
    })

    it('should reject map with duplicate zero keys', () => {
      const { parseMap } = useCborCollection()

      // Map: {0: 1, 0: 2}
      const duplicateZero = 'a200010002'

      expect(() => parseMap(duplicateZero, { dupMapKeyMode: 'reject' }))
        .toThrow(/duplicate.*key/i)
    })

    it('should allow different integer keys', () => {
      const { parseMap } = useCborCollection()

      // Map: {1: 10, 2: 11, 3: 12} - all unique
      // a3 (map of 3) + 01 (key:1) + 0a (val:10) + 02 (key:2) + 0b (val:11) + 03 (key:3) + 0c (val:12)
      const uniqueInts = 'a3010a020b030c'

      const result = parseMap(uniqueInts, { dupMapKeyMode: 'reject' })
      expect(result.value).toEqual(new Map([[1, 10], [2, 11], [3, 12]]))
    })

    it('should treat 1 and -1 as different keys', () => {
      const { parseMap } = useCborCollection()

      // Map: {1: 10, -1: 11} - different keys
      // a2 (map of 2) + 01 (key:1) + 0a (val:10) + 20 (key:-1) + 0b (val:11)
      const posAndNeg = 'a2010a200b'

      const result = parseMap(posAndNeg, { dupMapKeyMode: 'reject' })
      expect(result.value).toEqual(new Map([[1, 10], [-1, 11]]))
    })
  })

  describe('Byte String Keys - Duplicate Detection', () => {
    it('should reject map with duplicate byte string keys', () => {
      const { parseMap } = useCborCollection()

      // Map: {h'0102': 1, h'0304': 2, h'0102': 3} - duplicate h'0102'
      const duplicateBytes = 'a34201020142030402420102 03'

      expect(() => parseMap(duplicateBytes, { dupMapKeyMode: 'reject' }))
        .toThrow(/duplicate.*key/i)
    })

    it('should allow different byte strings as keys', () => {
      const { parseMap } = useCborCollection()

      // Map: {h'01': 1, h'02': 2, h'03': 3}
      const uniqueBytes = 'a341010141020241 0303'

      const result = parseMap(uniqueBytes, { dupMapKeyMode: 'reject' })
      // Byte strings as keys become comma-separated strings in JS
      expect(result.value.size).toBe(3)
    })

    it('should reject duplicate empty byte strings', () => {
      const { parseMap } = useCborCollection()

      // Map: {h'': 1, h'': 2} - duplicate empty byte string
      const duplicateEmpty = 'a24001 4002'

      expect(() => parseMap(duplicateEmpty, { dupMapKeyMode: 'reject' }))
        .toThrow(/duplicate.*key/i)
    })
  })

  describe('Mixed Type Keys - Duplicate Detection', () => {
    it('should reject keys that collide in JavaScript object model', () => {
      const { parseMap } = useCborCollection()

      // Map: {1: 10, "1": 20} - different types in CBOR (int vs string)
      // a2 (map of 2) + 01 (key:1 integer) + 0a (val:10) + 6131 (key:"1" string) + 14 (val:20)
      // SECURITY: Both convert to string "1" in JavaScript, causing collision
      // This is correctly rejected to prevent unexpected behavior in Cardano applications
      const mixedTypes = 'a2010a613114'

      expect(() => parseMap(mixedTypes, { dupMapKeyMode: 'reject' }))
        .toThrow(/duplicate.*key/i)
    })

    it('should detect duplicates when both are strings', () => {
      const { parseMap } = useCborCollection()

      // Map: {"1": 10, "1": 20} - both strings, duplicate
      const bothStrings = 'a26131 0a6131 0b'

      expect(() => parseMap(bothStrings, { dupMapKeyMode: 'reject' }))
        .toThrow(/duplicate.*key/i)
    })
  })

  describe('Nested Maps - Duplicate Detection', () => {
    it('should detect duplicates in outer map', () => {
      const { parse } = useCborParser()

      // Outer map: {"a": {...}, "a": {...}} - duplicate outer key
      const duplicateOuter = 'a2616 1a1616201616 1a161630 2'

      expect(() => parse(duplicateOuter, { dupMapKeyMode: 'reject' }))
        .toThrow(/duplicate.*key/i)
    })

    it('should detect duplicates in inner map', () => {
      const { parse } = useCborParser()

      // Outer unique, inner has duplicate: {"a": {"x": 1, "x": 2}}
      const duplicateInner = 'a16161a2617801617802'

      expect(() => parse(duplicateInner, { dupMapKeyMode: 'reject' }))
        .toThrow(/duplicate.*key/i)
    })

    it('should allow same keys in different nested maps', () => {
      const { parse } = useCborParser()

      // {"a": {"x": 1}, "b": {"x": 2}} - "x" in both inner maps (allowed)
      const sameKeyDifferentMaps = 'a2616 1a1617801616 2a16178 02'

      const result = parse(sameKeyDifferentMaps, { dupMapKeyMode: 'reject' })
      expect(result.value).toEqual(new Map([['a', new Map([['x', 1]])], ['b', new Map([['x', 2]])]]))
    })
  })

  describe('Cardano Security Scenarios', () => {
    it('should prevent transaction amount duplication attack', () => {
      const { parse } = useCborParser()

      // Malicious Cardano transaction with duplicate "amount" field
      // Attacker tries: amount: 1000000, amount: 100000000
      // Wallet sees 100M, node sees 1M → SECURITY BREACH
      const maliciousTx = 'a266616d6f756e741a000f424066616d6f756e741a05f5e100'

      expect(() => parse(maliciousTx, {
        dupMapKeyMode: 'reject',
        strict: true
      })).toThrow(/duplicate/i)
    })

    it('should prevent UTXO address duplication attack', () => {
      const { parse } = useCborParser()

      // Malicious UTXO with duplicate "address" field
      // a2 (map of 2) + 6761646472657373 ("address") + 01 + 6761646472657373 ("address") + 02
      const maliciousUTXO = 'a2676164647265737301676164647265737302'

      expect(() => parse(maliciousUTXO, {
        dupMapKeyMode: 'reject'
      })).toThrow(/duplicate/i)
    })

    it('should prevent metadata duplication attack', () => {
      const { parse } = useCborParser()

      // Transaction metadata with duplicate key
      const maliciousMetadata = 'a2616101616102'

      expect(() => parse(maliciousMetadata, {
        dupMapKeyMode: 'reject'
      })).toThrow(/duplicate/i)
    })

    it('should ensure strict mode enables duplicate key rejection', () => {
      const { parse } = useCborParser()

      // strict: true should automatically enable rejectDuplicateKeys
      const duplicateMap = 'a2616101616102'

      expect(() => parse(duplicateMap, { strict: true }))
        .toThrow(/duplicate/i)
    })
  })

  describe('Indefinite-Length Maps - Duplicate Detection', () => {
    it('should detect duplicates in indefinite-length maps', () => {
      const { parseMap } = useCborCollection()

      // Indefinite map: {_ "a": 1, "b": 2, "a": 3}
      // Note: This test may fail if indefinite is rejected in strict mode
      const indefiniteDuplicates = 'bf616101616 202616103ff'

      // In non-strict mode but with duplicate rejection
      expect(() => parseMap(indefiniteDuplicates, {
        dupMapKeyMode: 'reject',
        allowIndefinite: true
      })).toThrow(/duplicate/i)
    })
  })

  describe('Large Maps - Performance and Correctness', () => {
    it('should detect duplicates in large maps efficiently', () => {
      const { parseMap } = useCborCollection()

      // Create map with 50 unique keys + 1 duplicate at the end (51 total)
      const entries: string[] = []
      for (let i = 0; i < 50; i++) {
        // Integer keys 24-73 (using 1-byte encoding AI=24)
        const key = `18${(24 + i).toString(16).padStart(2, '0')}`
        const value = `18${(100 + i).toString(16).padStart(2, '0')}`
        entries.push(key + value)
      }
      // Add duplicate of first key (24)
      entries.push('1818' + '1880') // Duplicate key 24, value 128

      // b8 = Major type 5 (map), AI=24, followed by 1 byte for count
      const largeDuplicateMap = `b833${entries.join('')}` // 51 entries = 0x33

      expect(() => parseMap(largeDuplicateMap, {
        dupMapKeyMode: 'reject'
      })).toThrow(/duplicate/i)
    })

    it('should accept large maps with all unique keys', () => {
      const { parseMap } = useCborCollection()

      // Create map with 30 unique keys (all unique)
      const entries: string[] = []
      for (let i = 0; i < 30; i++) {
        // Integer keys 20-49 (using 1-byte encoding AI=24)
        const key = `18${(20 + i).toString(16).padStart(2, '0')}`
        const value = `18${(100 + i).toString(16).padStart(2, '0')}`
        entries.push(key + value)
      }

      // b8 = Major type 5 (map), AI=24, followed by 1 byte for count
      const largeUniqueMap = `b81e${entries.join('')}` // 30 entries = 0x1e

      const result = parseMap(largeUniqueMap, {
        dupMapKeyMode: 'reject',
        limits: { maxMapSize: 100 }
      })

      expect(result.value.size).toBe(30)
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty map with duplicate detection enabled', () => {
      const { parseMap } = useCborCollection()

      const emptyMap = 'a0'
      const result = parseMap(emptyMap, { dupMapKeyMode: 'reject' })

      expect(result.value).toEqual(new Map())
    })

    it('should handle single-entry map with duplicate detection', () => {
      const { parseMap } = useCborCollection()

      const singleEntry = 'a1616101'
      const result = parseMap(singleEntry, { dupMapKeyMode: 'reject' })

      expect(result.value).toEqual(new Map([['a', 1]]))
    })

    it('should detect duplicates with boolean and null keys', () => {
      const { parseMap } = useCborCollection()

      // Map: {true: 1, false: 2, true: 3} - duplicate true
      const duplicateBool = 'a3f501f402f503'

      expect(() => parseMap(duplicateBool, { dupMapKeyMode: 'reject' }))
        .toThrow(/duplicate/i)
    })

    it('should detect duplicates with null keys', () => {
      const { parseMap } = useCborCollection()

      // Map: {null: 1, null: 2} - duplicate null
      const duplicateNull = 'a2f601f602'

      expect(() => parseMap(duplicateNull, { dupMapKeyMode: 'reject' }))
        .toThrow(/duplicate/i)
    })
  })

  describe('Default Behavior', () => {
    it('should NOT reject duplicates by default (lenient mode)', () => {
      const { parseMap } = useCborCollection()

      // Map: {"a": 1, "a": 2} - duplicates allowed by default
      const duplicateMap = 'a2616101616102'

      // No options passed - should use default (lenient)
      const result = parseMap(duplicateMap)

      // Last value wins
      expect(result.value).toEqual(new Map([['a', 2]]))
    })

    it('should reject duplicates when explicitly enabled', () => {
      const { parseMap } = useCborCollection()

      const duplicateMap = 'a2616101616102'

      expect(() => parseMap(duplicateMap, { dupMapKeyMode: 'reject' }))
        .toThrow(/duplicate/i)
    })
  })
})
