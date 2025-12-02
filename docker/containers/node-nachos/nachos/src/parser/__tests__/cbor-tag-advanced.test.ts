/**
 * CBOR Advanced Tag Tests - Semantic Interpretation & Validation
 * Tests for Tag 258 (Set), Tag 4 (Decimal Fraction), Tag 5 (Bigfloat)
 * Following TDD principles with real-world CBOR examples
 */

import { describe, it, expect } from 'vitest'
import { useCborTag } from '../composables/useCborTag'

describe('useCborTag - Advanced Semantic Tags', () => {
  describe('Tag 258: Mathematical Finite Set (with uniqueness validation)', () => {
    describe('Valid sets (no duplicates)', () => {
      it('should parse set of unique integers', () => {
        const { parseTag } = useCborTag()

        // 258([1, 2, 3]) - unique integers
        // d9 0102 = tag 258 (2-byte), 83 = array(3)
        const result = parseTag('d9010283010203')

        expect(result.value.tag).toBe(258)
        expect(result.value.value).toEqual([1, 2, 3])
        expect(result.bytesRead).toBe(7)
      })

      it('should parse set of unique strings', () => {
        const { parseTag } = useCborTag()

        // 258(["a", "b", "c"]) - unique strings
        const result = parseTag('d9010283616161626163')

        expect(result.value.tag).toBe(258)
        expect(result.value.value).toEqual(['a', 'b', 'c'])
      })

      it('should parse empty set', () => {
        const { parseTag } = useCborTag()

        // 258([]) - empty set (always valid)
        const result = parseTag('d9010280')

        expect(result.value.tag).toBe(258)
        expect(result.value.value).toEqual([])
      })

      it('should parse single-element set', () => {
        const { parseTag } = useCborTag()

        // 258([42]) - single element
        // d9 0102 = tag 258, 81 = array(1), 18 2a = value 42
        const result = parseTag('d901028118 2a'.replace(/\s/g, ''))

        expect(result.value.tag).toBe(258)
        expect(result.value.value).toEqual([42])
      })

      it('should parse set with mixed types (valid if unique)', () => {
        const { parseTag } = useCborTag()

        // 258([1, "a", true]) - mixed types, all unique
        // d9 0102 = tag 258, 83 = array(3)
        // 01 = 1, 6161 = "a", f5 = true
        const result = parseTag('d9010283016161f5')

        expect(result.value.tag).toBe(258)
        expect(result.value.value).toEqual([1, 'a', true])
      })
    })

    describe('Invalid sets (with duplicates) - strict mode', () => {
      it('should reject set with duplicate integers in strict mode', () => {
        const { parseTag } = useCborTag()

        // 258([1, 2, 1]) - duplicate value 1
        const maliciousHex = 'd9010283010201'

        expect(() => parseTag(maliciousHex, { strict: true }))
          .toThrow(/duplicate.*set/i)
      })

      it('should reject set with duplicate strings in strict mode', () => {
        const { parseTag } = useCborTag()

        // 258(["a", "b", "a"]) - duplicate "a"
        const maliciousHex = 'd901028361616162616161'

        expect(() => parseTag(maliciousHex, { strict: true }))
          .toThrow(/duplicate.*set/i)
      })

      it('should reject set with all identical elements in strict mode', () => {
        const { parseTag } = useCborTag()

        // 258([5, 5, 5, 5]) - all duplicates
        const maliciousHex = 'd901028405050505'

        expect(() => parseTag(maliciousHex, { strict: true }))
          .toThrow(/duplicate.*set/i)
      })

      it('should reject set with duplicate boolean values in strict mode', () => {
        const { parseTag } = useCborTag()

        // 258([true, false, true]) - duplicate true
        const maliciousHex = 'd9010283f5f4f5'

        expect(() => parseTag(maliciousHex, { strict: true }))
          .toThrow(/duplicate.*set/i)
      })

      it('should reject set with duplicate byte strings in strict mode', () => {
        const { parseTag } = useCborTag()

        // 258([h'0102', h'0304', h'0102']) - duplicate h'0102'
        const maliciousHex = 'd901028342010242030442 0102'.replace(/\s/g, '')

        expect(() => parseTag(maliciousHex, { strict: true }))
          .toThrow(/duplicate.*set/i)
      })
    })

    describe('Duplicate detection (non-strict mode)', () => {
      it('should allow duplicates in non-strict mode but still parse', () => {
        const { parseTag } = useCborTag()

        // 258([1, 2, 1]) - with duplicates
        const result = parseTag('d9010283010201')

        // Should parse successfully (not throw)
        expect(result.value.tag).toBe(258)
        expect(result.value.value).toEqual([1, 2, 1])
      })

      it('should allow duplicates when validateSetUniqueness is explicitly false', () => {
        const { parseTag } = useCborTag()

        // 258(["x", "x"]) - duplicates allowed
        const result = parseTag('d901028261786178', {
          validateSetUniqueness: false
        })

        expect(result.value.tag).toBe(258)
        expect(result.value.value).toEqual(['x', 'x'])
      })
    })

    describe('Edge cases', () => {
      it('should handle set with nested arrays (compare by serialization)', () => {
        const { parseTag } = useCborTag()

        // 258([[1,2], [3,4]]) - nested arrays should be unique
        const result = parseTag('d901028282010282 0304'.replace(/\s/g, ''))

        expect(result.value.tag).toBe(258)
        expect(result.value.value).toEqual([[1, 2], [3, 4]])
      })

      it('should detect duplicate nested arrays in strict mode', () => {
        const { parseTag } = useCborTag()

        // 258([[1,2], [1,2]]) - duplicate arrays
        const maliciousHex = 'd901028282010282 0102'.replace(/\s/g, '')

        expect(() => parseTag(maliciousHex, { strict: true }))
          .toThrow(/duplicate.*set/i)
      })

      it('should handle large sets efficiently', () => {
        const { parseTag } = useCborTag()

        // 258([0, 1, 2, ..., 9]) - 10 unique integers (simpler test)
        // d9 0102 = tag 258, 8a = array(10), then 00-09
        const hex = 'd901028a00010203040506070809'

        const result = parseTag(hex)

        expect(result.value.tag).toBe(258)
        expect(Array.isArray(result.value.value)).toBe(true)
        expect(result.value.value).toHaveLength(10)
        expect(result.value.value[0]).toBe(0)
        expect(result.value.value[9]).toBe(9)
      })
    })

    describe('Cardano-specific set usage', () => {
      it('should parse Cardano Plutus set of datums', () => {
        const { parseTag } = useCborTag()

        // 258([datum1, datum2]) - Set of Plutus datums
        // Using simple integers as placeholder datums
        const result = parseTag('d901028218641865')

        expect(result.value.tag).toBe(258)
        expect(result.value.value).toEqual([100, 101])
      })

      it('should validate uniqueness for Cardano asset names in set', () => {
        const { parseTag } = useCborTag()

        // 258(["TokenA", "TokenB", "TokenC"]) - unique asset names
        const result = parseTag('d901028366546f6b656e4166546f6b656e4266546f6b656e43', {
          strict: true
        })

        expect(result.value.tag).toBe(258)
        expect(result.value.value).toEqual(['TokenA', 'TokenB', 'TokenC'])
      })
    })
  })

  describe('Tag 4: Decimal Fraction [exponent, mantissa]', () => {
    describe('Basic decimal fraction parsing', () => {
      it('should parse decimal fraction 273.15 as [exponent: -2, mantissa: 27315]', () => {
        const { parseTag } = useCborTag()

        // 4([-2, 27315]) represents 27315 * 10^(-2) = 273.15
        // c4 = tag 4, 82 = array(2), 21 = -2, 196ab3 = 27315
        const result = parseTag('c48221196ab3')

        expect(result.value.tag).toBe(4)
        expect(result.value.value).toEqual([-2, 27315])

        // Semantic interpretation: mantissa * 10^exponent
        const [exponent, mantissa] = result.value.value as [number, number]
        const decimalValue = mantissa * Math.pow(10, exponent)
        expect(decimalValue).toBeCloseTo(273.15, 10)
      })

      it('should parse decimal fraction 1.1 (not exactly representable in binary)', () => {
        const { parseTag } = useCborTag()

        // 4([-1, 11]) represents 11 * 10^(-1) = 1.1
        // c4 = tag 4, 82 = array(2), 20 = -1, 0b = 11
        const result = parseTag('c482200b')

        expect(result.value.tag).toBe(4)
        const [exponent, mantissa] = result.value.value as [number, number]
        const decimalValue = mantissa * Math.pow(10, exponent)
        expect(decimalValue).toBeCloseTo(1.1, 10)
      })

      it('should parse positive exponent decimal', () => {
        const { parseTag } = useCborTag()

        // 4([2, 5]) represents 5 * 10^2 = 500
        const result = parseTag('c4820205')

        expect(result.value.tag).toBe(4)
        const [exponent, mantissa] = result.value.value as [number, number]
        expect(mantissa * Math.pow(10, exponent)).toBe(500)
      })

      it('should parse zero exponent decimal', () => {
        const { parseTag } = useCborTag()

        // 4([0, 123]) represents 123 * 10^0 = 123
        const result = parseTag('c48200187b')

        expect(result.value.tag).toBe(4)
        const [exponent, mantissa] = result.value.value as [number, number]
        expect(mantissa * Math.pow(10, exponent)).toBe(123)
      })

      it('should parse negative mantissa decimal', () => {
        const { parseTag } = useCborTag()

        // 4([-2, -273]) represents -273 * 10^(-2) = -2.73
        // c4 = tag 4, 82 = array(2), 21 = -2, 39 0110 = -273
        const result = parseTag('c4822139 0110'.replace(/\s/g, ''))

        expect(result.value.tag).toBe(4)
        const [exponent, mantissa] = result.value.value as [number, number]
        expect(mantissa * Math.pow(10, exponent)).toBeCloseTo(-2.73, 10)
      })
    })

    describe('Financial/monetary use cases', () => {
      it('should parse price $19.99 as decimal fraction', () => {
        const { parseTag } = useCborTag()

        // 4([-2, 1999]) = 1999 * 10^(-2) = $19.99
        const result = parseTag('c48221190 7cf'.replace(/\s/g, ''))

        expect(result.value.tag).toBe(4)
        const [exponent, mantissa] = result.value.value as [number, number]
        expect(mantissa * Math.pow(10, exponent)).toBeCloseTo(19.99, 10)
      })

      it('should parse Cardano ADA amount 1000.50 as decimal fraction', () => {
        const { parseTag } = useCborTag()

        // 4([-2, 100050]) = 100050 * 10^(-2) = 1000.50 ADA
        const result = parseTag('c482211a000186d2')

        expect(result.value.tag).toBe(4)
        const [exponent, mantissa] = result.value.value as [number, number]
        expect(mantissa * Math.pow(10, exponent)).toBeCloseTo(1000.50, 10)
      })
    })

    describe('Error cases', () => {
      it('should reject decimal fraction with non-array value', () => {
        const { parseTag } = useCborTag()

        // 4(42) - invalid, must be array
        expect(() => parseTag('c4182a', { validateTagSemantics: true }))
          .toThrow(/decimal fraction.*array/i)
      })

      it('should reject decimal fraction with wrong array length', () => {
        const { parseTag } = useCborTag()

        // 4([1, 2, 3]) - invalid, must be exactly 2 elements
        expect(() => parseTag('c483010203', { validateTagSemantics: true }))
          .toThrow(/decimal fraction.*exactly.*2/i)
      })

      it('should reject decimal fraction with non-integer exponent', () => {
        const { parseTag } = useCborTag()

        // 4(["x", 100]) - invalid, exponent must be integer
        expect(() => parseTag('c4826178186 4'.replace(/\s/g, ''), { validateTagSemantics: true }))
          .toThrow(/exponent.*integer/i)
      })

      it('should reject decimal fraction with non-integer mantissa', () => {
        const { parseTag } = useCborTag()

        // 4([-2, "hello"]) - invalid, mantissa must be integer
        expect(() => parseTag('c482216568656c6c6f', { validateTagSemantics: true }))
          .toThrow(/mantissa.*integer/i)
      })
    })
  })

  describe('Tag 5: Bigfloat [exponent, mantissa]', () => {
    describe('Basic bigfloat parsing', () => {
      it('should parse bigfloat [exponent: -2, mantissa: 3]', () => {
        const { parseTag } = useCborTag()

        // 5([-2, 3]) represents 3 * 2^(-2) = 3 * 0.25 = 0.75
        // c5 = tag 5, 82 = array(2), 21 = -2, 03 = 3
        const result = parseTag('c5822103')

        expect(result.value.tag).toBe(5)
        expect(result.value.value).toEqual([-2, 3])

        // Semantic interpretation: mantissa * 2^exponent
        const [exponent, mantissa] = result.value.value as [number, number]
        const floatValue = mantissa * Math.pow(2, exponent)
        expect(floatValue).toBe(0.75)
      })

      it('should parse bigfloat with positive exponent', () => {
        const { parseTag } = useCborTag()

        // 5([10, 1000000]) represents 1000000 * 2^10 = 1024000000
        // c5 = tag 5, 82 = array(2), 0a = 10, 1a000f4240 = 1000000
        const result = parseTag('c5820a1a000f4240')

        expect(result.value.tag).toBe(5)
        const [exponent, mantissa] = result.value.value as [number, number]
        expect(mantissa * Math.pow(2, exponent)).toBe(1024000000)
      })

      it('should parse bigfloat with zero exponent', () => {
        const { parseTag } = useCborTag()

        // 5([0, 42]) represents 42 * 2^0 = 42
        const result = parseTag('c5820018 2a'.replace(/\s/g, ''))

        expect(result.value.tag).toBe(5)
        const [exponent, mantissa] = result.value.value as [number, number]
        expect(mantissa * Math.pow(2, exponent)).toBe(42)
      })

      it('should parse bigfloat with negative mantissa', () => {
        const { parseTag } = useCborTag()

        // 5([-1, -8]) represents -8 * 2^(-1) = -4
        const result = parseTag('c5822027')

        expect(result.value.tag).toBe(5)
        const [exponent, mantissa] = result.value.value as [number, number]
        expect(mantissa * Math.pow(2, exponent)).toBe(-4)
      })

      it('should parse bigfloat with bigint mantissa (beyond Number.MAX_SAFE_INTEGER)', () => {
        const { parseTag } = useCborTag()

        // 5([0, 2^63]) - large mantissa
        // c5 = tag 5, 82 = array(2), 00 = 0, 1b8000000000000000 = 2^63
        const result = parseTag('c582001b8000000000000000')

        expect(result.value.tag).toBe(5)
        expect(result.value.value[0]).toBe(0)
        expect(result.value.value[1]).toBe(BigInt('9223372036854775808'))
      })
    })

    describe('High-precision scientific computing', () => {
      it('should represent fractional values precisely', () => {
        const { parseTag } = useCborTag()

        // 5([-10, 1025]) = 1025 * 2^(-10) = 1025 / 1024 ≈ 1.0009765625
        const result = parseTag('c5822919040 1'.replace(/\s/g, ''))

        expect(result.value.tag).toBe(5)
        const [exponent, mantissa] = result.value.value as [number, number]
        expect(mantissa * Math.pow(2, exponent)).toBeCloseTo(1.0009765625, 15)
      })

      it('should handle very large exponents', () => {
        const { parseTag } = useCborTag()

        // 5([1000, 1]) = 1 * 2^1000 (astronomically large)
        const result = parseTag('c58219 03e801'.replace(/\s/g, ''))

        expect(result.value.tag).toBe(5)
        expect(result.value.value).toEqual([1000, 1])
        // Don't compute the value - it's too large!
      })

      it('should handle very negative exponents (tiny values)', () => {
        const { parseTag } = useCborTag()

        // 5([-1000, 1]) = 1 * 2^(-1000) (infinitesimally small)
        const result = parseTag('c5823903e701')

        expect(result.value.tag).toBe(5)
        expect(result.value.value).toEqual([-1000, 1])
        // Don't compute - underflows to 0 in JavaScript
      })
    })

    describe('Error cases', () => {
      it('should reject bigfloat with non-array value', () => {
        const { parseTag } = useCborTag()

        // 5(100) - invalid, must be array
        expect(() => parseTag('c51864', { validateTagSemantics: true }))
          .toThrow(/bigfloat.*array/i)
      })

      it('should reject bigfloat with wrong array length', () => {
        const { parseTag } = useCborTag()

        // 5([1]) - invalid, must be exactly 2 elements
        expect(() => parseTag('c58101', { validateTagSemantics: true }))
          .toThrow(/bigfloat.*exactly.*2/i)
      })

      it('should reject bigfloat with non-integer exponent', () => {
        const { parseTag } = useCborTag()

        // 5(["text", 100]) - invalid, exponent must be integer
        expect(() => parseTag('c4826474657874186 4'.replace(/\s/g, ''), { validateTagSemantics: true }))
          .toThrow(/exponent.*integer/i)
      })

      it('should reject bigfloat with non-integer mantissa', () => {
        const { parseTag } = useCborTag()

        // 5([0, true]) - invalid, mantissa must be integer
        expect(() => parseTag('c58200f5', { validateTagSemantics: true }))
          .toThrow(/mantissa.*integer/i)
      })
    })
  })

  describe('Integration: Complex nested structures with advanced tags', () => {
    it('should parse set containing decimal fractions', () => {
      const { parseTag } = useCborTag()

      // 258([4([-2, 1000]), 4([-2, 2000]), 4([-2, 3000])])
      // Set of prices: {$10.00, $20.00, $30.00}
      const result = parseTag('d9010283c482211903e8c482211907d0c482211 90bb8'.replace(/\s/g, ''))

      expect(result.value.tag).toBe(258)
      expect(result.value.value).toHaveLength(3)

      // Each element should be a tagged decimal fraction
      const prices = result.value.value as Array<{ tag: number, value: [number, number] }>
      prices.forEach(item => {
        expect(item.tag).toBe(4)
        expect(item.value).toHaveLength(2)
      })
    })

    it('should parse set containing bigfloats', () => {
      const { parseTag } = useCborTag()

      // 258([5([-2, 1]), 5([-2, 3])])
      // Set of binary fractions: {0.25, 0.75}
      const result = parseTag('d9010282c5822101c5822103')

      expect(result.value.tag).toBe(258)
      expect(result.value.value).toHaveLength(2)
    })
  })
})
