/**
 * Extreme Edge Cases for 100% Coverage
 * Tests for the last few uncovered lines
 */

import { describe, it, expect } from 'vitest'
import { useCborInteger } from '../composables/useCborInteger'
import { useCborString } from '../composables/useCborString'

describe('Extreme Edge Cases', () => {
  describe('useCborInteger - Line 81 coverage', () => {
    it('should keep BigInt when converting negative BigInt that stays outside safe range', () => {
      const { parseInteger } = useCborInteger()

      // Test the else branch on line 83: when negValue as BigInt stays as BigInt
      // We need a value where the rawValue is BigInt AND the result is BigInt
      // -1 - rawValue where rawValue > MAX_SAFE_INTEGER
      // This will keep it as BigInt

      // Use a value just above MAX_SAFE_INTEGER
      // MAX_SAFE_INTEGER is 9007199254740991 (0x001FFFFFFFFFFFFF)
      // We want rawValue = 9007199254740992 (0x0020000000000000)
      // Result: -1 - 9007199254740992 = -9007199254740993 (outside safe range)

      const result = parseInteger('3b0020000000000000')
      expect(typeof result.value).toBe('bigint')
      expect(result.value).toBe(-9007199254740993n)
    })

    it('should convert large BigInt negative to number when it fits', () => {
      const { parseInteger } = useCborInteger()

      // Test line 80-81: when negValue >= MIN_SAFE_INTEGER and converts to Number
      // MIN_SAFE_INTEGER = -9007199254740991
      // We want: -1 - rawValue >= -9007199254740991
      // So: rawValue <= 9007199254740990

      // Use rawValue = 9007199254740990 (just at the boundary)
      // -1 - 9007199254740990 = -9007199254740991 (exactly MIN_SAFE_INTEGER)
      const result = parseInteger('3b001ffffffffffffe')

      // Should be converted to Number
      expect(typeof result.value).toBe('number')
      expect(result.value).toBe(-9007199254740991)
    })
  })

  describe('useCborString - Indefinite edge cases', () => {
    it('should handle edge case with indefinite string chunks', () => {
      const { parseByteString } = useCborString()

      // Test indefinite byte string with empty chunks
      // 5f (indefinite) + 40 (empty chunk) + 40 (empty chunk) + ff (break)
      const buffer = new Uint8Array([0x5f, 0x40, 0x40, 0xff])
      const result = parseByteString(buffer, 0)

      // Parser returns structured object with chunk metadata for round-tripping
      expect(result.value).toMatchObject({
        type: 'cbor-byte-string',
        bytes: new Uint8Array([]),
        chunks: [new Uint8Array([]), new Uint8Array([])]
      })
      expect(result.bytesRead).toBe(4)
    })

    it('should handle indefinite text string with empty chunks', () => {
      const { parseTextString } = useCborString()

      // Test indefinite text string with empty chunks
      // 7f (indefinite) + 60 (empty chunk) + 60 (empty chunk) + ff (break)
      const buffer = new Uint8Array([0x7f, 0x60, 0x60, 0xff])
      const result = parseTextString(buffer, 0)

      // Parser returns structured object with chunk metadata for round-tripping
      expect(result.value).toMatchObject({
        type: 'cbor-text-string',
        text: '',
        chunks: ['', '']
      })
      expect(result.bytesRead).toBe(4)
    })
  })

  describe('Length encoding edge cases', () => {
    it('should use all length encoding paths', () => {
      const { parseByteString } = useCborString()

      // Direct encoding (0-23): 23 bytes
      const buffer1 = new Uint8Array([0x57, ...new Array(23).fill(0)])
      const result1 = parseByteString(buffer1, 0)
      expect(result1.value.length).toBe(23)

      // 1-byte length (AI 24): 100 bytes
      const buffer2 = new Uint8Array([0x58, 100, ...new Array(100).fill(0)])
      const result2 = parseByteString(buffer2, 0)
      expect(result2.value.length).toBe(100)

      // 2-byte length (AI 25): 256 bytes
      const buffer3 = new Uint8Array([0x59, 0x01, 0x00, ...new Array(256).fill(0)])
      const result3 = parseByteString(buffer3, 0)
      expect(result3.value.length).toBe(256)

      // 4-byte length (AI 26): 300 bytes
      const buffer4 = new Uint8Array([0x5a, 0x00, 0x00, 0x01, 0x2c, ...new Array(300).fill(0)])
      const result4 = parseByteString(buffer4, 0)
      expect(result4.value.length).toBe(300)

      // 8-byte length (AI 27): 500 bytes
      const buffer5 = new Uint8Array([0x5b, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0xf4, ...new Array(500).fill(0)])
      const result5 = parseByteString(buffer5, 0)
      expect(result5.value.length).toBe(500)
    })
  })

  describe('Boundary value testing', () => {
    it('should handle maximum safe integer boundaries', () => {
      const { parseInteger } = useCborInteger()

      // Maximum safe positive integer: 2^53 - 1 = 9007199254740991
      const result1 = parseInteger('1b001fffffffffffff')
      expect(typeof result1.value).toBe('number')
      expect(result1.value).toBe(9007199254740991)

      // Just beyond max safe integer: 2^53 = 9007199254740992
      const result2 = parseInteger('1b0020000000000000')
      expect(typeof result2.value).toBe('bigint')
      expect(result2.value).toBe(9007199254740992n)
    })

    it('should handle minimum safe integer boundary for negatives', () => {
      const { parseInteger } = useCborInteger()

      // Minimum safe negative integer: -(2^53 - 1) = -9007199254740991
      // Encoding: -1 - N, so N = 9007199254740990
      const result1 = parseInteger('3b001ffffffffffffe')
      expect(typeof result1.value).toBe('number')
      expect(result1.value).toBe(-9007199254740991)

      // Just beyond min safe integer: -9007199254740992
      // Encoding: -1 - N, so N = 9007199254740991
      const result2 = parseInteger('3b001fffffffffffff')
      expect(typeof result2.value).toBe('bigint')
      expect(result2.value).toBe(-9007199254740992n)
    })
  })
})
