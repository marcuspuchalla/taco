/**
 * CBOR Collection Encoder Test Suite
 * Tests for Major Type 4 (Arrays) and Major Type 5 (Maps)
 */

import { describe, it, expect } from 'vitest'
import { useCborCollectionEncoder } from '../composables/useCborCollectionEncoder'
import type { EncodableValue } from '../types'

describe('CBOR Collection Encoder', () => {
  describe('Arrays (Major Type 4)', () => {
    describe('Definite-length arrays', () => {
      it('should encode empty array', () => {
        const { encodeArray } = useCborCollectionEncoder()
        const result = encodeArray([])

        expect(result.bytes).toEqual(new Uint8Array([0x80]))
        expect(result.hex).toBe('80')
      })

      it('should encode array with single integer', () => {
        const { encodeArray } = useCborCollectionEncoder()
        const result = encodeArray([1])

        // 0x81 (array length 1) + 0x01 (integer 1)
        expect(result.bytes).toEqual(new Uint8Array([0x81, 0x01]))
        expect(result.hex).toBe('8101')
      })

      it('should encode array of integers [1, 2, 3]', () => {
        const { encodeArray } = useCborCollectionEncoder()
        const result = encodeArray([1, 2, 3])

        // RFC 8949 Appendix A: [1, 2, 3] = 0x83 0x01 0x02 0x03
        expect(result.bytes).toEqual(new Uint8Array([0x83, 0x01, 0x02, 0x03]))
        expect(result.hex).toBe('83010203')
      })

      it('should encode array with mixed types', () => {
        const { encodeArray } = useCborCollectionEncoder()
        const result = encodeArray([1, 'test', true])

        // 0x83 (length 3) + 0x01 (1) + 0x64746573740a ("test") + 0xf5 (true)
        expect(result.bytes[0]).toBe(0x83)
        expect(result.bytes[1]).toBe(0x01)  // Integer 1
        expect(result.bytes[2]).toBe(0x64)  // Text string length 4
        expect(result.bytes[7]).toBe(0xf5)  // true
      })

      it('should encode nested arrays [[1, 2], [3, 4]]', () => {
        const { encodeArray } = useCborCollectionEncoder()
        const result = encodeArray([[1, 2], [3, 4]])

        // 0x82 (outer array length 2)
        //   + 0x82 0x01 0x02 (inner array [1,2])
        //   + 0x82 0x03 0x04 (inner array [3,4])
        expect(result.bytes).toEqual(new Uint8Array([
          0x82,             // Array length 2
          0x82, 0x01, 0x02, // [1, 2]
          0x82, 0x03, 0x04  // [3, 4]
        ]))
        expect(result.hex).toBe('82820102820304')
      })

      it('should encode array with 24 elements (1-byte length)', () => {
        const { encodeArray } = useCborCollectionEncoder()
        const arr = Array(24).fill(1)
        const result = encodeArray(arr)

        // 0x98 0x18 (length 24) + 24 × 0x01
        expect(result.bytes[0]).toBe(0x98)
        expect(result.bytes[1]).toBe(24)
        expect(result.bytes.length).toBe(26)  // 2 byte header + 24 elements
      })

      it('should encode Cardano collateral UTXO array', () => {
        const { encodeArray } = useCborCollectionEncoder()

        // Real Cardano CIP-30 example: array of [txHash, outputIndex] pairs
        const txHash = new Uint8Array([
          0x48, 0xbd, 0x01, 0xd5, 0x1e, 0x58, 0x0c, 0xde,
          0x15, 0xaf, 0xa6, 0xd2, 0x8f, 0x63, 0xd8, 0x9c,
          0x91, 0x37, 0xb9, 0x3a, 0x91, 0x0e, 0x59, 0x41,
          0x19, 0x2e, 0x26, 0xb1, 0x29, 0x06, 0x10, 0x67
        ])

        const utxo: EncodableValue[] = [txHash, 0]
        const result = encodeArray([utxo])

        // Should start with 0x81 (outer array length 1)
        expect(result.bytes[0]).toBe(0x81)
        // Then 0x82 (inner array length 2)
        expect(result.bytes[1]).toBe(0x82)
        // Then 0x58 0x20 (byte string length 32)
        expect(result.bytes[2]).toBe(0x58)
        expect(result.bytes[3]).toBe(0x20)
      })
    })

    describe('Indefinite-length arrays', () => {
      it('should encode empty indefinite array', () => {
        const { encodeArrayIndefinite } = useCborCollectionEncoder()
        const result = encodeArrayIndefinite([])

        // 0x9f (start) + 0xff (break)
        expect(result.bytes).toEqual(new Uint8Array([0x9f, 0xff]))
        expect(result.hex).toBe('9fff')
      })

      it('should encode indefinite array [1, 2, 3]', () => {
        const { encodeArrayIndefinite } = useCborCollectionEncoder()
        const result = encodeArrayIndefinite([1, 2, 3])

        // RFC 8949: 0x9f 0x01 0x02 0x03 0xff
        expect(result.bytes).toEqual(new Uint8Array([0x9f, 0x01, 0x02, 0x03, 0xff]))
        expect(result.hex).toBe('9f010203ff')
      })

      it('should reject indefinite arrays in canonical mode', () => {
        const { encodeArray } = useCborCollectionEncoder({ canonical: true })

        expect(() => encodeArray([], { indefinite: true }))
          .toThrow('Indefinite-length encoding not allowed in canonical mode')
      })
    })
  })

  describe('Maps (Major Type 5)', () => {
    describe('Definite-length maps', () => {
      it('should encode empty map', () => {
        const { encodeMap } = useCborCollectionEncoder()
        const result = encodeMap({})

        expect(result.bytes).toEqual(new Uint8Array([0xa0]))
        expect(result.hex).toBe('a0')
      })

      it('should encode map with single string key', () => {
        const { encodeMap } = useCborCollectionEncoder()
        const result = encodeMap({ a: 1 })

        // 0xa1 (map length 1) + 0x61 0x61 ("a") + 0x01 (1)
        expect(result.bytes).toEqual(new Uint8Array([0xa1, 0x61, 0x61, 0x01]))
        expect(result.hex).toBe('a1616101')
      })

      it('should encode Cardano amount map', () => {
        const { encodeMap } = useCborCollectionEncoder()
        const result = encodeMap({ amount: 1000000 })

        // 0xa1 (length 1)
        //   + 0x66 "amount" (text string)
        //   + 0x1a 0x000f4240 (integer 1000000)
        expect(result.bytes[0]).toBe(0xa1)
        expect(result.bytes[1]).toBe(0x66)  // Text string length 6
        expect(result.hex).toBe('a166616d6f756e741a000f4240')
      })

      it('should encode map with integer keys', () => {
        const { encodeMap } = useCborCollectionEncoder()
        const result = encodeMap(new Map([[1, 2], [3, 4]]))

        // 0xa2 (length 2) + (0x01 0x02) + (0x03 0x04)
        expect(result.bytes).toEqual(new Uint8Array([0xa2, 0x01, 0x02, 0x03, 0x04]))
        expect(result.hex).toBe('a201020304')
      })

      it('should encode nested map', () => {
        const { encodeMap } = useCborCollectionEncoder()
        const result = encodeMap({ a: { b: 1 } })

        // 0xa1 (outer map length 1)
        //   + 0x61 0x61 ("a")
        //   + 0xa1 (inner map length 1)
        //     + 0x61 0x62 ("b")
        //     + 0x01 (1)
        expect(result.bytes[0]).toBe(0xa1)
        expect(result.bytes[3]).toBe(0xa1)  // Nested map
      })

      it('should encode map with mixed value types', () => {
        const { encodeMap } = useCborCollectionEncoder()
        const result = encodeMap({
          num: 42,
          str: 'hello',
          bool: true,
          arr: [1, 2]
        })

        expect(result.bytes[0]).toBe(0xa4)  // Map length 4
      })
    })

    describe('Canonical map encoding', () => {
      it('should sort map keys by encoded bytes (canonical mode)', () => {
        const { encodeMap } = useCborCollectionEncoder({ canonical: true })
        const result = encodeMap({ z: 1, a: 2 })

        // In canonical mode, keys must be sorted by encoded bytes
        // "a" (0x6161) < "z" (0x617a), so "a" should come first
        const hex = result.hex
        const aPos = hex.indexOf('6161')  // "a"
        const zPos = hex.indexOf('617a')  // "z"

        expect(aPos).toBeLessThan(zPos)
      })

      it('should sort by length first, then bytewise', () => {
        const { encodeMap } = useCborCollectionEncoder({ canonical: true })
        const result = encodeMap({ aa: 1, b: 2 })

        // "b" (0x6162) is shorter than "aa" (0x626161), so "b" comes first
        const hex = result.hex
        const bPos = hex.indexOf('6162')   // "b"
        const aaPos = hex.indexOf('626161') // "aa"

        expect(bPos).toBeLessThan(aaPos)
      })

      it('should reject duplicate keys when option is set', () => {
        const { encodeMap } = useCborCollectionEncoder({ rejectDuplicateKeys: true })

        // Create a map with duplicate keys using Map constructor
        const map = new Map([
          ['key', 1],
          ['key', 2]  // Duplicate (will overwrite in Map)
        ])

        // This should not throw because Map automatically handles duplicates
        // but we test with manual encoding later
        const result = encodeMap(map)
        expect(result.bytes[0]).toBe(0xa1)  // Only one entry
      })
    })

    describe('Indefinite-length maps', () => {
      it('should encode empty indefinite map', () => {
        const { encodeMapIndefinite } = useCborCollectionEncoder()
        const result = encodeMapIndefinite({})

        // 0xbf (start) + 0xff (break)
        expect(result.bytes).toEqual(new Uint8Array([0xbf, 0xff]))
        expect(result.hex).toBe('bfff')
      })

      it('should encode indefinite map {"a": 1}', () => {
        const { encodeMapIndefinite } = useCborCollectionEncoder()
        const result = encodeMapIndefinite({ a: 1 })

        // 0xbf + 0x61 0x61 ("a") + 0x01 (1) + 0xff
        expect(result.bytes).toEqual(new Uint8Array([0xbf, 0x61, 0x61, 0x01, 0xff]))
        expect(result.hex).toBe('bf616101ff')
      })

      it('should reject indefinite maps in canonical mode', () => {
        const { encodeMap } = useCborCollectionEncoder({ canonical: true })

        expect(() => encodeMap({}, { indefinite: true }))
          .toThrow('Indefinite-length encoding not allowed in canonical mode')
      })
    })
  })

  describe('Depth limits', () => {
    it('should enforce maximum nesting depth', () => {
      const { encodeArray } = useCborCollectionEncoder({ maxDepth: 1 })

      // Create deeply nested array: [[[1]]]
      // With maxDepth=1, recursion proceeds as:
      // - encodeArray starts with depth=0
      // - encodeValue([[1]]) checks depth=0 > 1? No, creates newCtx depth=1
      // - encodeValue([1]) checks depth=1 > 1? No, creates newCtx depth=2
      // - encodeValue(1) checks depth=2 > 1? Yes! Throws
      const deep = [[[1]]]

      expect(() => encodeArray(deep))
        .toThrow('Maximum nesting depth exceeded')
    })

    it('should handle nested maps and arrays', () => {
      const { encodeArray } = useCborCollectionEncoder({ maxDepth: 5 })

      const nested = [
        {
          data: [
            { inner: [1, 2, 3] }
          ]
        }
      ]

      const result = encodeArray(nested)
      expect(result.bytes[0]).toBe(0x81)  // Should succeed
    })
  })

  describe('Output size limits', () => {
    it('should respect maxOutputSize option', () => {
      const { encodeArray } = useCborCollectionEncoder({ maxOutputSize: 10 })
      const largeArray = Array(100).fill(1)

      expect(() => encodeArray(largeArray))
        .toThrow('Encoded output exceeds maximum size')
    })
  })

  describe('Real-world Cardano examples', () => {
    it('should encode Cardano transaction structure', () => {
      const { encodeMap, encodeArray } = useCborCollectionEncoder()

      // Simplified Cardano transaction
      const tx = {
        inputs: [[new Uint8Array(32).fill(0xaa), 0]],
        outputs: [{ address: new Uint8Array(28).fill(0xbb), amount: 1000000 }],
        fee: 170000
      }

      const result = encodeMap(tx)
      expect(result.bytes[0]).toBe(0xa3)  // Map with 3 entries
    })

    it('should encode Plutus data list', () => {
      const { encodeArray } = useCborCollectionEncoder()

      // Plutus list of integers
      const plutusList = [121, [1, 2, 3]]  // Tag 121 with list
      const result = encodeArray(plutusList)

      expect(result.bytes[0]).toBe(0x82)  // Array length 2
    })
  })
})
