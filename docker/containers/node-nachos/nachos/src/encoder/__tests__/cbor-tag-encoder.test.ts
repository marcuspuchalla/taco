/**
 * CBOR Tag Encoder Tests
 * Tests encoding of tagged values (Major Type 6)
 *
 * Tests cover:
 * - Standard CBOR tags (0-24)
 * - Plutus constructor tags (121-127, 1280-1400, 102)
 * - Custom application tags
 * - Nested tagged values
 * - Tagged values in collections
 */

import { describe, it, expect } from 'vitest'
import { useCborEncoder } from '../composables/useCborEncoder'
import { useCborParser } from '../../parser/composables/useCborParser'

describe('useCborEncoder - Tag Encoding', () => {
  const { encode } = useCborEncoder()

  describe('Standard CBOR Tags', () => {
    it('should encode tag 0 (datetime string)', () => {
      const tagged = {
        tag: 0,
        value: '2013-03-21T20:04:00Z'
      }

      const result = encode(tagged)

      // Tag 0 (c0) + text string
      expect(result.hex).toMatch(/^c0/)
      expect(result.hex).toContain('323031332d30332d32315432303a30343a30305a')
    })

    it('should encode tag 1 (epoch datetime)', () => {
      const tagged = {
        tag: 1,
        value: 1363896240
      }

      const result = encode(tagged)

      // Tag 1 (c1) + integer
      expect(result.hex).toMatch(/^c1/)
    })

    it('should encode tag 2 (bignum)', () => {
      const tagged = {
        tag: 2,
        value: new Uint8Array([0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])
      }

      const result = encode(tagged)

      // Tag 2 (c2) + byte string
      expect(result.hex).toMatch(/^c2/)
    })

    it('should encode tag 24 (encoded CBOR data item)', () => {
      const tagged = {
        tag: 24,
        value: new Uint8Array([0x64, 0x49, 0x45, 0x54, 0x46]) // CBOR for "IETF"
      }

      const result = encode(tagged)

      // Tag 24 (d8 18) + byte string
      expect(result.hex).toMatch(/^d818/)
    })

    it('should encode tag 32 (URI)', () => {
      const tagged = {
        tag: 32,
        value: 'https://example.com'
      }

      const result = encode(tagged)

      // Tag 32 (d8 20) + text string
      expect(result.hex).toMatch(/^d820/)
    })

    it('should encode tag 258 (set)', () => {
      const tagged = {
        tag: 258,
        value: [1, 2, 3]
      }

      const result = encode(tagged)

      // Tag 258 (d9 01 02) + array
      expect(result.hex).toMatch(/^d90102/)
    })
  })

  describe('Plutus Constructor Tags (Compact)', () => {
    it('should encode tag 121 (Plutus constructor 0)', () => {
      const tagged = {
        tag: 121,
        value: []
      }

      const result = encode(tagged)

      // Tag 121 (d8 79) + empty array (80)
      expect(result.hex).toBe('d87980')
    })

    it('should encode tag 122 (Plutus constructor 1)', () => {
      const tagged = {
        tag: 122,
        value: [42]
      }

      const result = encode(tagged)

      // Tag 122 (d8 7a) + array [42]
      expect(result.hex).toMatch(/^d87a/)
      expect(result.hex).toContain('182a') // 42
    })

    it('should encode tag 123 (Plutus constructor 2)', () => {
      const tagged = {
        tag: 123,
        value: [1, 2]
      }

      const result = encode(tagged)

      // Tag 123 (d8 7b) + array [1, 2]
      expect(result.hex).toBe('d87b820102')
    })

    it('should encode tag 127 (Plutus constructor 6)', () => {
      const tagged = {
        tag: 127,
        value: [1, 2, 3, 4, 5, 6]
      }

      const result = encode(tagged)

      // Tag 127 (d8 7f) + array
      expect(result.hex).toMatch(/^d87f/)
    })
  })

  describe('Plutus Constructor Tags (Extended)', () => {
    it('should encode tag 1280 (Plutus constructor 7)', () => {
      const tagged = {
        tag: 1280,
        value: [7, 7, 7]
      }

      const result = encode(tagged)

      // Tag 1280 (d9 05 00) + array
      expect(result.hex).toMatch(/^d90500/)
    })

    it('should encode tag 1283 (Plutus constructor 10)', () => {
      const tagged = {
        tag: 1283,
        value: [1, 2, 3]
      }

      const result = encode(tagged)

      // Tag 1283 (d9 05 03)
      expect(result.hex).toBe('d9050383010203')
    })

    it('should encode tag 1400 (Plutus constructor 127)', () => {
      const tagged = {
        tag: 1400,
        value: []
      }

      const result = encode(tagged)

      // Tag 1400 (d9 05 78) + empty array
      expect(result.hex).toBe('d9057880')
    })
  })

  describe('Plutus Alternative Constructor', () => {
    it('should encode tag 102 (alternative constructor)', () => {
      const tagged = {
        tag: 102,
        value: [200, [99]]
      }

      const result = encode(tagged)

      // Tag 102 (d8 66) + array [200, [99]]
      expect(result.hex).toBe('d8668218c8811863')
    })

    it('should encode tag 102 with complex value', () => {
      const tagged = {
        tag: 102,
        value: [0, ['constructor_variant', 123]]
      }

      const result = encode(tagged)

      // Tag 102 + array [0, ["constructor_variant", 123]]
      expect(result.hex).toMatch(/^d866/)
    })
  })

  describe('Nested Tagged Values', () => {
    it('should encode tag within tag', () => {
      const nested = {
        tag: 121,
        value: [{
          tag: 121,
          value: []
        }]
      }

      const result = encode(nested)

      // Outer tag 121 + array + inner tag 121 + empty array
      // d8 79 81 d8 79 80
      expect(result.hex).toBe('d87981d87980')
    })

    it('should encode deeply nested tags (3 levels)', () => {
      const deeply = {
        tag: 121,
        value: [{
          tag: 121,
          value: [{
            tag: 121,
            value: []
          }]
        }]
      }

      const result = encode(deeply)

      // d8 79 81 d8 79 81 d8 79 80
      expect(result.hex).toBe('d87981d87981d87980')
    })

    it('should encode tag with mixed content', () => {
      const mixed = {
        tag: 121,
        value: [
          1,
          {
            tag: 122,
            value: [2]
          },
          3
        ]
      }

      const result = encode(mixed)

      // Tag 121 + array [1, tag 122 [2], 3]
      expect(result.hex).toMatch(/^d879/)
      expect(result.hex).toContain('d87a') // inner tag 122
    })
  })

  describe('Tags in Collections', () => {
    it('should encode array of tagged values', () => {
      const array = [
        { tag: 121, value: [] },
        { tag: 121, value: [] }
      ]

      const result = encode(array)

      // Array of 2 + tag 121 [] + tag 121 []
      expect(result.hex).toBe('82d87980d87980')
    })

    it('should encode map with tagged values', () => {
      const map = {
        'key': {
          tag: 121,
          value: [42]
        }
      }

      const result = encode(map)

      // Map + "key" (636b6579) + tag 121 [42]
      expect(result.hex).toMatch(/a1636b6579d87981182a/)
    })

    it('should encode tag containing map', () => {
      const tagged = {
        tag: 121,
        value: [{ amount: 1000000 }]
      }

      const result = encode(tagged)

      // Tag 121 + array + map
      expect(result.hex).toMatch(/^d87981/)
      expect(result.hex).toContain('616d6f756e74') // "amount"
    })
  })

  describe('Real-World Cardano Examples', () => {
    it('should encode Cardano redeemer structure', () => {
      const redeemer = {
        tag: 121,
        value: [
          'stream_mgxpv1qd_5ke7nkj',
          new Uint8Array(Buffer.from('2fc2a082557dc6a74dfc42d204a6d3ff1a241c103c0bbdd2f3525ce6', 'hex')),
          new Uint8Array(Buffer.from('d8b6a54c95aac8970bcfbf625bb694336c43baa40aa1fc50952563f4', 'hex')),
          55155648,
          104622300,
          104628456,
          107085404,
          0,
          { tag: 121, value: [] }
        ]
      }

      const result = encode(redeemer)

      // Should encode full redeemer structure
      expect(result.hex).toMatch(/^d879/)
      expect(result.hex).toContain('d87980') // nested tag 121 []
    })

    it('should encode Plutus Nothing (tag 121, empty array)', () => {
      const nothing = {
        tag: 121,
        value: []
      }

      const result = encode(nothing)

      expect(result.hex).toBe('d87980')
    })

    it('should encode Plutus Just (tag 122, [value])', () => {
      const just = {
        tag: 122,
        value: [42]
      }

      const result = encode(just)

      // Tag 122 + array [42]
      expect(result.hex).toMatch(/^d87a81182a/)
    })

    it('should encode Plutus pair (tag 121, [a, b])', () => {
      const pair = {
        tag: 121,
        value: [100, 200]
      }

      const result = encode(pair)

      // Tag 121 (d879) + array [100, 200] (821864 18c8)
      expect(result.hex).toBe('d87982186418c8')
    })
  })

  describe('Canonical Encoding for Tags', () => {
    it('should use smallest tag encoding', () => {
      // Tag 0-23: single byte (c0-d7)
      const tag10 = { tag: 10, value: 0 }
      const result10 = encode(tag10, { canonical: true })
      expect(result10.bytes[0]).toBe(0xca) // ca = tag 10

      // Tag 24-255: d8 + 1 byte
      const tag100 = { tag: 100, value: 0 }
      const result100 = encode(tag100, { canonical: true })
      expect(result100.bytes[0]).toBe(0xd8)
      expect(result100.bytes[1]).toBe(100)

      // Tag 256+: d9 + 2 bytes
      const tag1000 = { tag: 1000, value: 0 }
      const result1000 = encode(tag1000, { canonical: true })
      expect(result1000.bytes[0]).toBe(0xd9)
    })

    it('should use canonical encoding for tagged value content', () => {
      const tagged = {
        tag: 121,
        value: [1, 2, 3]
      }

      const result = encode(tagged, { canonical: true })

      // Array should be definite-length (83), not indefinite (9f)
      expect(result.bytes[2]).toBe(0x83) // array of 3
      expect(result.bytes[2]).not.toBe(0x9f) // not indefinite
    })
  })

  describe('Edge Cases', () => {
    it('should encode tag with empty byte string', () => {
      const tagged = {
        tag: 2,
        value: new Uint8Array([])
      }

      const result = encode(tagged)

      // Tag 2 (c2) + empty byte string (40)
      expect(result.hex).toBe('c240')
    })

    it('should encode tag with null value', () => {
      const tagged = {
        tag: 121,
        value: [null]
      }

      const result = encode(tagged)

      // Tag 121 + array [null]
      expect(result.hex).toBe('d87981f6')
    })

    it('should encode tag with boolean values', () => {
      const tagged = {
        tag: 121,
        value: [true, false]
      }

      const result = encode(tagged)

      // Tag 121 + array [true, false]
      expect(result.hex).toBe('d87982f5f4')
    })

    it('should encode tag with large integer', () => {
      const tagged = {
        tag: 121,
        value: [4294967296] // 2^32
      }

      const result = encode(tagged)

      // Tag 121 + array [2^32]
      expect(result.hex).toMatch(/^d87981/)
      expect(result.hex).toContain('1b0000000100000000') // large int encoding
    })

    it('should encode tag with negative integer', () => {
      const tagged = {
        tag: 121,
        value: [-1000]
      }

      const result = encode(tagged)

      // Tag 121 + array [-1000]
      expect(result.hex).toBe('d879813903e7')
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid tag structure gracefully', () => {
      // Missing tag property - should encode as regular object
      const invalid = {
        value: [1, 2, 3]
      }

      const result = encode(invalid)

      // Should encode as map, not tag
      expect(result.hex).toMatch(/^a1/) // map, not tag
    })

    it('should encode very large tag numbers', () => {
      const largeTag = {
        tag: 65535,
        value: 0
      }

      const result = encode(largeTag)

      // Tag 65535: d9 ff ff
      expect(result.hex).toMatch(/^d9ffff/)
    })

    it('should encode tag with complex nested structure', () => {
      const complex = {
        tag: 121,
        value: [
          [1, 2, [3, 4, [5]]],
          { a: 1, b: { c: 2 } },
          'text',
          new Uint8Array([0xff, 0x00])
        ]
      }

      const result = encode(complex)

      // Should handle deeply nested structures
      expect(result.hex).toMatch(/^d879/)
      expect(result.bytes.length).toBeGreaterThan(10)
    })
  })

  describe('Roundtrip Compatibility', () => {
    it('should encode tags that can be decoded back', () => {
      const { parseWithSourceMap } = useCborParser()

      const original = {
        tag: 121,
        value: [1, 2, 3]
      }

      const encoded = encode(original, { canonical: true })
      const decoded = parseWithSourceMap(encoded.hex, { validatePlutusSemantics: false })

      // Remove plutus field if present for comparison
      if ('plutus' in decoded.value) {
        const { plutus, ...rest } = decoded.value as any
        expect(rest).toEqual(original)
      } else {
        expect(decoded.value).toEqual(original)
      }
    })

    it('should roundtrip complex Plutus structures', () => {
      const { parseWithSourceMap } = useCborParser()

      const complex = {
        tag: 121,
        value: [
          { tag: 122, value: [42] },
          { tag: 121, value: [] },
          { tag: 123, value: [1, 2] }
        ]
      }

      const encoded = encode(complex, { canonical: true })
      const decoded = parseWithSourceMap(encoded.hex, { validatePlutusSemantics: false })

      // Remove plutus field if present for comparison
      const removeP = (obj: any): any => {
        if (obj && typeof obj === 'object') {
          if ('plutus' in obj) {
            const { plutus, ...rest } = obj
            return removeP(rest)
          }
          if (Array.isArray(obj)) {
            return obj.map(removeP)
          }
          const result: any = {}
          for (const key in obj) {
            result[key] = removeP(obj[key])
          }
          return result
        }
        return obj
      }

      expect(removeP(decoded.value)).toEqual(complex)
    })
  })
})
