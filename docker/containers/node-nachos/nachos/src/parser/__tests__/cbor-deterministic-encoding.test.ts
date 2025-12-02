/**
 * CBOR Deterministic Encoding Tests (RFC 8949 Section 4.2)
 *
 * Core Deterministic Encoding Requirements:
 * 1. Preferred serialization MUST be used (shortest form)
 * 2. Indefinite-length items MUST NOT be used
 * 3. Map keys MUST be sorted in bytewise lexicographic order
 * 4. No duplicate map keys allowed
 *
 * Critical for Cardano transaction signing safety!
 */

import { describe, it, expect } from 'vitest'
import { useCborParser } from '../composables/useCborParser'
import { useCborInteger } from '../composables/useCborInteger'
import { useCborCollection } from '../composables/useCborCollection'

describe('RFC 8949 Core Deterministic Encoding (Section 4.2)', () => {
  describe('Requirement 1: Preferred Serialization (Shortest Form)', () => {
    describe('Integers must use shortest encoding', () => {
      it('should accept value 10 with direct encoding (AI=10)', () => {
        const { parse } = useCborParser()
        const result = parse('0a', { validateCanonical: true })
        expect(result.value).toBe(10)
      })

      it('should reject value 10 with wasteful 1-byte encoding', () => {
        const { parse } = useCborParser()
        // 0x180a = AI 24 + 0x0a (wasteful, should be direct 0x0a)
        expect(() => parse('180a', { validateCanonical: true }))
          .toThrow(/non-canonical.*integer/i)
      })

      it('should accept value 24 with 1-byte encoding (AI=24)', () => {
        const { parse } = useCborParser()
        const result = parse('1818', { validateCanonical: true })
        expect(result.value).toBe(24)
      })

      it('should reject value 24 with wasteful 2-byte encoding', () => {
        const { parse } = useCborParser()
        // 0x190018 = AI 25 + 0x0018 (wasteful, should be AI 24)
        expect(() => parse('190018', { validateCanonical: true }))
          .toThrow(/non-canonical.*integer/i)
      })

      it('should accept value 256 with 2-byte encoding (AI=25)', () => {
        const { parse } = useCborParser()
        const result = parse('190100', { validateCanonical: true })
        expect(result.value).toBe(256)
      })

      it('should reject value 256 with wasteful 4-byte encoding', () => {
        const { parse } = useCborParser()
        // 0x1a00000100 = AI 26 + 0x00000100 (wasteful)
        expect(() => parse('1a00000100', { validateCanonical: true }))
          .toThrow(/non-canonical.*integer/i)
      })

      it('should accept value 65536 with 4-byte encoding (AI=26)', () => {
        const { parse } = useCborParser()
        const result = parse('1a00010000', { validateCanonical: true })
        expect(result.value).toBe(65536)
      })

      it('should reject value 65536 with wasteful 8-byte encoding', () => {
        const { parse } = useCborParser()
        // 0x1b0000000000010000 = AI 27 + 8 bytes (wasteful)
        expect(() => parse('1b0000000000010000', { validateCanonical: true }))
          .toThrow(/non-canonical.*integer/i)
      })

      it('should accept value 4294967296 with 8-byte encoding (AI=27)', () => {
        const { parse } = useCborParser()
        const result = parse('1b0000000100000000', { validateCanonical: true })
        // 4294967296 is within Number.MAX_SAFE_INTEGER, so it's a number, not BigInt
        expect(result.value).toBe(4294967296)
      })
    })

    describe('Negative integers must use shortest encoding', () => {
      it('should accept -10 with direct encoding', () => {
        const { parse } = useCborParser()
        const result = parse('29', { validateCanonical: true }) // -1 - 9 = -10
        expect(result.value).toBe(-10)
      })

      it('should reject -10 with wasteful encoding', () => {
        const { parse } = useCborParser()
        // 0x3809 = negative with AI 24 (wasteful)
        expect(() => parse('3809', { validateCanonical: true }))
          .toThrow(/non-canonical.*integer/i)
      })

      it('should accept -100 with 1-byte encoding', () => {
        const { parse } = useCborParser()
        const result = parse('3863', { validateCanonical: true }) // -1 - 99 = -100
        expect(result.value).toBe(-100)
      })
    })

    describe('String lengths must use shortest encoding', () => {
      it('should accept 10-byte string with direct length', () => {
        const { parse } = useCborParser()
        // 0x6a = text string, length 10
        const result = parse('6a48656c6c6f576f726c64', { validateCanonical: true }) // "HelloWorld" (10 bytes)
        expect(result.value).toBe('HelloWorld')
      })

      it('should reject 10-byte string with wasteful 1-byte length', () => {
        const { parse } = useCborParser()
        // 0x780a = text string, AI 24, length 10 (wasteful)
        expect(() => parse('780a48656c6c6f576f726c64', { validateCanonical: true })) // "HelloWorld"
          .toThrow(/non-canonical/i)
      })
    })

    describe('Array lengths must use shortest encoding', () => {
      it('should accept array of 5 with direct length', () => {
        const { parse } = useCborParser()
        const result = parse('8501020304 05', { validateCanonical: true })
        expect(result.value).toEqual([1, 2, 3, 4, 5])
      })

      it('should reject array of 5 with wasteful encoding', () => {
        const { parse } = useCborParser()
        // 0x9805 = array, AI 24, length 5 (wasteful)
        expect(() => parse('98050102030405', { validateCanonical: true }))
          .toThrow(/non-canonical/i)
      })
    })

    describe('Map lengths must use shortest encoding', () => {
      it('should accept map of 2 pairs with direct length', () => {
        const { parse } = useCborParser()
        const result = parse('a2616101616202', { validateCanonical: true })
        expect(result.value).toEqual(new Map([['a', 1], ['b', 2]]))
      })

      it('should reject map of 2 pairs with wasteful encoding', () => {
        const { parse } = useCborParser()
        // 0xb802 = map, AI 24, length 2 (wasteful)
        expect(() => parse('b802616101616202', { validateCanonical: true }))
          .toThrow(/non-canonical/i)
      })
    })
  })

  describe('Requirement 2: No Indefinite-Length Encoding', () => {
    it('should reject indefinite-length arrays in strict mode', () => {
      const { parse } = useCborParser()
      // 0x9f = indefinite array start
      expect(() => parse('9f010203ff', { validateCanonical: true }))
        .toThrow(/indefinite.*not allowed/i)
    })

    it('should reject indefinite-length maps in strict mode', () => {
      const { parse } = useCborParser()
      // 0xbf = indefinite map start
      expect(() => parse('bf61610161 6202ff', { validateCanonical: true }))
        .toThrow(/indefinite.*not allowed/i)
    })

    it('should reject indefinite-length byte strings in strict mode', () => {
      const { parse } = useCborParser()
      // 0x5f = indefinite byte string start
      expect(() => parse('5f42010243030405ff', { validateCanonical: true }))
        .toThrow(/indefinite.*not allowed/i)
    })

    it('should reject indefinite-length text strings in strict mode', () => {
      const { parse } = useCborParser()
      // 0x7f = indefinite text string start
      expect(() => parse('7f657374726561646d696e67ff', { validateCanonical: true }))
        .toThrow(/indefinite.*not allowed/i)
    })

    it('should accept definite-length arrays in strict mode', () => {
      const { parse } = useCborParser()
      const result = parse('83010203', { validateCanonical: true })
      expect(result.value).toEqual([1, 2, 3])
    })
  })

  describe('Requirement 3: Map Keys Must Be Sorted (Bytewise Lexicographic)', () => {
    it('should accept map with correctly sorted integer keys', () => {
      const { parse } = useCborParser()
      // Keys: 1, 2, 3 (already sorted)
      const result = parse('a3010a020b030c', { validateCanonical: true })
      expect(result.value).toEqual(new Map([[1, 10], [2, 11], [3, 12]]))
    })

    it('should reject map with unsorted integer keys', () => {
      const { parse } = useCborParser()
      // Keys: 2, 1, 3 (WRONG ORDER)
      expect(() => parse('a3020b010a030c', { validateCanonical: true }))
        .toThrow(/not in canonical order/i)
    })

    it('should accept map with correctly sorted string keys (alphabetical)', () => {
      const { parse } = useCborParser()
      // Keys: "a", "b", "c" (correct order)
      const result = parse('a3616101616202616303', { validateCanonical: true })
      expect(result.value).toEqual(new Map([['a', 1], ['b', 2], ['c', 3]]))
    })

    it('should reject map with unsorted string keys', () => {
      const { parse } = useCborParser()
      // Keys: "c", "a", "b" (WRONG ORDER)
      expect(() => parse('a3616303616101616202', { validateCanonical: true }))
        .toThrow(/not in canonical order/i)
    })

    it('should reject map with reversed string keys', () => {
      const { parse } = useCborParser()
      // Keys: "z", "a" (WRONG ORDER - should be "a", "z")
      expect(() => parse('a2617a01616102', { validateCanonical: true }))
        .toThrow(/not in canonical order/i)
    })

    it('should accept map with correctly sorted keys by length then content', () => {
      const { parse } = useCborParser()
      // Keys: "a" (1 byte), "aa" (2 bytes) - shorter keys come first
      const result = parse('a26161016261 6102', { validateCanonical: true })
      expect(result.value).toEqual(new Map([['a', 1], ['aa', 2]]))
    })

    it('should reject map with keys sorted by content but not length', () => {
      const { parse } = useCborParser()
      // Keys: "aa" (2 bytes), "a" (1 byte) - WRONG ORDER
      expect(() => parse('a26261610261 6101', { validateCanonical: true }))
        .toThrow(/not in canonical order/i)
    })

    it('should accept map with mixed-type keys sorted correctly', () => {
      const { parse } = useCborParser()
      // Integer keys sort before string keys bytewise
      // Key 0 (0x00) < Key "a" (0x6161)
      const result = parse('a2000a616101', { validateCanonical: true })
      expect(result.value).toEqual(new Map([[0, 10], ['a', 1]]))
    })

    it('should reject map with mixed-type keys in wrong order', () => {
      const { parse } = useCborParser()
      // Key "a" (0x6161) should come AFTER Key 0 (0x00)
      expect(() => parse('a26161010a00', { validateCanonical: true }))
        .toThrow(/not in canonical order/i)
    })

    it('should accept empty map in canonical mode', () => {
      const { parse } = useCborParser()
      const result = parse('a0', { validateCanonical: true })
      expect(result.value).toEqual(new Map())
    })

    it('should accept single-entry map in canonical mode', () => {
      const { parse } = useCborParser()
      const result = parse('a1616101', { validateCanonical: true })
      expect(result.value).toEqual(new Map([['a', 1]]))
    })
  })

  describe('Requirement 4: No Duplicate Map Keys (Deterministic)', () => {
    it('should reject map with duplicate string keys in canonical mode', () => {
      const { parse } = useCborParser()
      // Map with duplicate "a" key (sorted: a, a, b)
      // Keys must be sorted for canonical form, but duplicates still rejected
      expect(() => parse('a3616101616103616202', { validateCanonical: true }))
        .toThrow(/duplicate/i)
    })

    it('should reject map with duplicate integer keys in canonical mode', () => {
      const { parse } = useCborParser()
      // Map with duplicate key 1
      expect(() => parse('a3010a010b020c', { validateCanonical: true }))
        .toThrow(/duplicate/i)
    })

    it('should reject map with duplicate byte string keys', () => {
      const { parse } = useCborParser()
      // Map with duplicate h'0102' key
      expect(() => parse('a34201020a42010 20b420304 0c', { validateCanonical: true }))
        .toThrow(/duplicate/i)
    })
  })

  describe('Cardano Transaction Signing Safety', () => {
    it('should ensure deterministic encoding for transaction amounts', () => {
      const { parse } = useCborParser()

      // Simulated Cardano transaction with amount field
      // Map { "amount": 1000000 } in canonical form
      const canonicalTx = 'a166616d6f756e741a000f4240'

      const result = parse(canonicalTx, {
        validateCanonical: true,
        dupMapKeyMode: 'reject'
      })

      expect(result.value).toEqual(new Map([['amount', 1000000]]))
    })

    it('should reject non-canonical transaction (duplicate amount field)', () => {
      const { parse } = useCborParser()

      // Malicious transaction with duplicate "amount" key
      // First: 1000000, Second: 100000000
      const maliciousTx = 'a266616d6f756e741a000f424066616d6f756e741a05f5e100'

      expect(() => parse(maliciousTx, {
        validateCanonical: true,
        dupMapKeyMode: 'reject'
      })).toThrow(/duplicate/i)
    })

    it('should reject non-canonical transaction (unsorted keys)', () => {
      const { parse } = useCborParser()

      // Transaction with unsorted keys: "b", "a" (should be "a", "b")
      const maliciousTx = 'a2616201616101' // {"b": 1, "a": 1} - wrong order

      expect(() => parse(maliciousTx, { validateCanonical: true }))
        .toThrow(/not in canonical order/i)
    })

    it('should accept properly signed canonical Cardano UTXO', () => {
      const { parse } = useCborParser()

      // Canonical UTXO: sorted keys, shortest encoding
      const canonicalUTXO = 'a26161 6472657761726482005820abcd...'
      // Simplified test - in reality would be full UTXO structure

      const simplifiedUTXO = 'a2616101616202' // {a: 1, b: 2}
      const result = parse(simplifiedUTXO, { validateCanonical: true })

      expect(result.value).toEqual(new Map([['a', 1], ['b', 2]]))
    })

    it('should enforce strict mode enables all validations', () => {
      const { parse } = useCborParser()

      // strict: true should enable validateCanonical, rejectDuplicateKeys, etc.
      // Non-canonical integer
      expect(() => parse('180a', { strict: true }))
        .toThrow(/non-canonical/i)

      // Indefinite length
      expect(() => parse('9f0102 03ff', { strict: true }))
        .toThrow(/indefinite.*not allowed/i)
    })
  })

  describe('Complex Nested Structures (Deterministic)', () => {
    it('should validate nested maps have sorted keys', () => {
      const { parse } = useCborParser()

      // Outer map with sorted keys, inner map with sorted keys
      const nested = 'a2616101616 2a26163 01616402' // {a: 1, b: {c: 1, d: 2}}

      const result = parse(nested, { validateCanonical: true })
      expect(result.value).toEqual(new Map([['a', 1], ['b', new Map([['c', 1], ['d', 2]])]]))
    })

    it('should reject nested maps with unsorted inner keys', () => {
      const { parse } = useCborParser()

      // Outer sorted, but inner map has keys "d", "c" (WRONG ORDER)
      const nested = 'a2616101616 2a2616402616301'

      expect(() => parse(nested, { validateCanonical: true }))
        .toThrow(/not in canonical order/i)
    })

    it('should validate arrays within maps in canonical form', () => {
      const { parse } = useCborParser()

      // Map with array value using shortest length encoding
      const mapWithArray = 'a161618301 0203' // {a: [1, 2, 3]}

      const result = parse(mapWithArray, { validateCanonical: true })
      expect(result.value).toEqual(new Map([['a', [1, 2, 3]]]))
    })
  })

  describe('Float Canonical Encoding (Shortest Form)', () => {
    it('should accept float16 for values that fit', () => {
      const { parse } = useCborParser()
      // 0.0 as float16
      const result = parse('f90000', { validateCanonical: true })
      expect(result.value).toBe(0.0)
    })

    // Note: Float canonical form is complex - values like 5.5 should use float16
    // if possible, but our current implementation may not validate this yet
    // This is a lower priority than integer/map canonicalization
  })

  describe('Edge Cases in Deterministic Mode', () => {
    it('should accept map with keys that differ only in length', () => {
      const { parse } = useCborParser()
      // Keys: "a", "aa", "aaa" (correctly sorted by length then content)
      const result = parse('a3616101626161026361616103', { validateCanonical: true })
      expect(result.value).toEqual(new Map([['a', 1], ['aa', 2], ['aaa', 3]]))
    })

    it('should accept map with byte string keys sorted correctly', () => {
      const { parse } = useCborParser()
      // Byte strings sort by bytewise comparison
      const result = parse('a24200010142000202', { validateCanonical: true })
      // Check that map has the byte string keys
      expect(result.value.size).toBe(2)
      // Keys are Uint8Arrays [0, 1] and [0, 2]
      let foundFirst = false
      let foundSecond = false
      for (const [key] of result.value) {
        if (key instanceof Uint8Array) {
          if (key.length === 2 && key[0] === 0 && key[1] === 1) foundFirst = true
          if (key.length === 2 && key[0] === 0 && key[1] === 2) foundSecond = true
        }
      }
      expect(foundFirst).toBe(true)
      expect(foundSecond).toBe(true)
    })

    it('should handle tags in canonical mode', () => {
      const { parse } = useCborParser()
      // Tag 1 (epoch time) with canonical integer
      const result = parse('c11a514b67b0', { validateCanonical: true })
      expect(result.value.tag).toBe(1)
    })
  })
})
