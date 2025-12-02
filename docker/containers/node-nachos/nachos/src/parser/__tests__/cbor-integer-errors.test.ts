/**
 * CBOR Integer Parser Error Handling Tests
 * Tests all error cases and edge cases for 100% code coverage
 */

import { describe, it, expect } from 'vitest'
import { useCborInteger } from '../composables/useCborInteger'

describe('useCborInteger - Error Handling', () => {
  describe('Invalid Additional Info', () => {
    it('should throw error for reserved additional info 28', () => {
      const { parseInteger } = useCborInteger()
      // MT 0, AI 28 (0x1c) - reserved
      expect(() => parseInteger('1c')).toThrow('Invalid additional info: 28')
    })

    it('should throw error for reserved additional info 29', () => {
      const { parseInteger } = useCborInteger()
      // MT 0, AI 29 (0x1d) - reserved
      expect(() => parseInteger('1d')).toThrow('Invalid additional info: 29')
    })

    it('should throw error for reserved additional info 30', () => {
      const { parseInteger } = useCborInteger()
      // MT 0, AI 30 (0x1e) - reserved
      expect(() => parseInteger('1e')).toThrow('Invalid additional info: 30')
    })

    it('should throw error for break marker 31', () => {
      const { parseInteger } = useCborInteger()
      // MT 0, AI 31 (0x1f) - break marker, invalid for integers
      expect(() => parseInteger('1f')).toThrow('Invalid additional info: 31')
    })
  })

  describe('Wrong Major Type', () => {
    it('should throw error when major type is 2 (byte string)', () => {
      const { parseInteger } = useCborInteger()
      // MT 2 (byte string) should not be parsed as integer
      expect(() => parseInteger('40')).toThrow('Expected major type 0 or 1, got 2')
    })

    it('should throw error when major type is 3 (text string)', () => {
      const { parseInteger } = useCborInteger()
      // MT 3 (text string) should not be parsed as integer
      expect(() => parseInteger('60')).toThrow('Expected major type 0 or 1, got 3')
    })

    it('should throw error when major type is 4 (array)', () => {
      const { parseInteger } = useCborInteger()
      // MT 4 (array) should not be parsed as integer
      expect(() => parseInteger('80')).toThrow('Expected major type 0 or 1, got 4')
    })

    it('should throw error when major type is 7 (simple/float)', () => {
      const { parseInteger } = useCborInteger()
      // MT 7 (simple value) should not be parsed as integer
      expect(() => parseInteger('f4')).toThrow('Expected major type 0 or 1, got 7')
    })
  })

  describe('BigInt Conversion Edge Cases', () => {
    it('should convert large negative BigInt to Number when it fits in safe range', () => {
      const { parseInteger } = useCborInteger()

      // This tests line 80-81: negative BigInt that fits in safe integer
      // The smallest safe negative integer is -9007199254740991 (-(2^53 - 1))
      // We need a CBOR value that produces this

      // For MT 1, value = -1 - N
      // We want -9007199254740991, so N = 9007199254740990
      // 9007199254740990 = 0x001FFFFFFFFFFFFF - 1 = 0x001FFFFFFFFFFFFE

      // This requires 8-byte encoding (AI = 27)
      // Hex: 3b (MT 1, AI 27) + 001FFFFFFFFFFFFE
      const result = parseInteger('3b001ffffffffffffe')

      expect(typeof result.value).toBe('number')
      expect(result.value).toBe(-9007199254740991) // -(2^53 - 1)
    })

    it('should keep as BigInt when negative value is outside safe range', () => {
      const { parseInteger } = useCborInteger()

      // Value below Number.MIN_SAFE_INTEGER should remain BigInt
      // For MT 1, value = -1 - N
      // We want something below -9007199254740991

      // Max uint64 produces -18446744073709551616
      const result = parseInteger('3bffffffffffffffff')

      expect(typeof result.value).toBe('bigint')
      expect(result.value).toBe(-18446744073709551616n)
    })

    it('should convert to BigInt when negative number is outside safe range', () => {
      const { parseInteger } = useCborInteger()

      // This tests line 92: negative number conversion to BigInt
      // We need a case where the raw value is a number, but result is BigInt
      // This happens when rawValue fits in Number but result doesn't

      // For MT 1 with AI 26 (4 bytes): max is 4294967295
      // Result: -1 - 4294967295 = -4294967296 (still within safe integer range)
      // We need AI 27 (8 bytes) for this edge case

      // Let's use a value that creates a negative number outside safe range
      // Raw value: 9007199254740992 (2^53, just beyond MAX_SAFE_INTEGER)
      // Result: -1 - 9007199254740992 = -9007199254740993 (beyond MIN_SAFE_INTEGER)

      const result = parseInteger('3b0020000000000000')

      expect(typeof result.value).toBe('bigint')
      expect(result.value).toBe(-9007199254740993n)
    })
  })

  describe('All Additional Info Values Coverage', () => {
    it('should parse all valid additional info values (0-27)', () => {
      const { parseInteger } = useCborInteger()

      // AI 0-23: direct encoding
      expect(parseInteger('00').value).toBe(0)
      expect(parseInteger('17').value).toBe(23)

      // AI 24: 1 byte
      expect(parseInteger('1818').value).toBe(24)

      // AI 25: 2 bytes
      expect(parseInteger('190100').value).toBe(256)

      // AI 26: 4 bytes
      expect(parseInteger('1a00010000').value).toBe(65536)

      // AI 27: 8 bytes
      expect(parseInteger('1b0000000100000000').value).toBe(4294967296)
    })
  })
})
