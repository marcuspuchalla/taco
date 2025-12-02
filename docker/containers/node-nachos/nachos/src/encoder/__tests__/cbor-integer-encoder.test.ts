/**
 * CBOR Integer Encoder Test Suite
 * Tests for Major Type 0 (Unsigned) and Major Type 1 (Negative)
 */

import { describe, it, expect } from 'vitest'
import { useCborIntegerEncoder } from '../composables/useCborIntegerEncoder'

describe('CBOR Integer Encoder', () => {
  describe('Unsigned Integers (Major Type 0)', () => {
    describe('Direct encoding (0-23)', () => {
      it('should encode 0', () => {
        const { encodeUnsignedInt } = useCborIntegerEncoder()
        const result = encodeUnsignedInt(0)

        expect(result.bytes).toEqual(new Uint8Array([0x00]))
        expect(result.hex).toBe('00')
      })

      it('should encode 1', () => {
        const { encodeUnsignedInt } = useCborIntegerEncoder()
        const result = encodeUnsignedInt(1)

        expect(result.bytes).toEqual(new Uint8Array([0x01]))
        expect(result.hex).toBe('01')
      })

      it('should encode 10', () => {
        const { encodeUnsignedInt } = useCborIntegerEncoder()
        const result = encodeUnsignedInt(10)

        expect(result.bytes).toEqual(new Uint8Array([0x0a]))
        expect(result.hex).toBe('0a')
      })

      it('should encode 23', () => {
        const { encodeUnsignedInt } = useCborIntegerEncoder()
        const result = encodeUnsignedInt(23)

        expect(result.bytes).toEqual(new Uint8Array([0x17]))
        expect(result.hex).toBe('17')
      })
    })

    describe('1-byte encoding (24-255)', () => {
      it('should encode 24', () => {
        const { encodeUnsignedInt } = useCborIntegerEncoder()
        const result = encodeUnsignedInt(24)

        expect(result.bytes).toEqual(new Uint8Array([0x18, 0x18]))
        expect(result.hex).toBe('1818')
      })

      it('should encode 25', () => {
        const { encodeUnsignedInt } = useCborIntegerEncoder()
        const result = encodeUnsignedInt(25)

        expect(result.bytes).toEqual(new Uint8Array([0x18, 0x19]))
        expect(result.hex).toBe('1819')
      })

      it('should encode 100', () => {
        const { encodeUnsignedInt } = useCborIntegerEncoder()
        const result = encodeUnsignedInt(100)

        expect(result.bytes).toEqual(new Uint8Array([0x18, 0x64]))
        expect(result.hex).toBe('1864')
      })

      it('should encode 255', () => {
        const { encodeUnsignedInt } = useCborIntegerEncoder()
        const result = encodeUnsignedInt(255)

        expect(result.bytes).toEqual(new Uint8Array([0x18, 0xff]))
        expect(result.hex).toBe('18ff')
      })
    })

    describe('2-byte encoding (256-65535)', () => {
      it('should encode 256', () => {
        const { encodeUnsignedInt } = useCborIntegerEncoder()
        const result = encodeUnsignedInt(256)

        expect(result.bytes).toEqual(new Uint8Array([0x19, 0x01, 0x00]))
        expect(result.hex).toBe('190100')
      })

      it('should encode 1000', () => {
        const { encodeUnsignedInt } = useCborIntegerEncoder()
        const result = encodeUnsignedInt(1000)

        expect(result.bytes).toEqual(new Uint8Array([0x19, 0x03, 0xe8]))
        expect(result.hex).toBe('1903e8')
      })

      it('should encode 65535', () => {
        const { encodeUnsignedInt } = useCborIntegerEncoder()
        const result = encodeUnsignedInt(65535)

        expect(result.bytes).toEqual(new Uint8Array([0x19, 0xff, 0xff]))
        expect(result.hex).toBe('19ffff')
      })
    })

    describe('4-byte encoding (65536-4294967295)', () => {
      it('should encode 65536', () => {
        const { encodeUnsignedInt } = useCborIntegerEncoder()
        const result = encodeUnsignedInt(65536)

        expect(result.bytes).toEqual(new Uint8Array([0x1a, 0x00, 0x01, 0x00, 0x00]))
        expect(result.hex).toBe('1a00010000')
      })

      it('should encode 1000000', () => {
        const { encodeUnsignedInt } = useCborIntegerEncoder()
        const result = encodeUnsignedInt(1000000)

        expect(result.bytes).toEqual(new Uint8Array([0x1a, 0x00, 0x0f, 0x42, 0x40]))
        expect(result.hex).toBe('1a000f4240')
      })

      it('should encode 4294967295', () => {
        const { encodeUnsignedInt } = useCborIntegerEncoder()
        const result = encodeUnsignedInt(4294967295)

        expect(result.bytes).toEqual(new Uint8Array([0x1a, 0xff, 0xff, 0xff, 0xff]))
        expect(result.hex).toBe('1affffffff')
      })
    })

    describe('8-byte encoding (> 4294967295)', () => {
      it('should encode 4294967296', () => {
        const { encodeUnsignedInt } = useCborIntegerEncoder()
        const result = encodeUnsignedInt(4294967296)

        expect(result.bytes).toEqual(new Uint8Array([0x1b, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00]))
        expect(result.hex).toBe('1b0000000100000000')
      })

      it('should encode BigInt values', () => {
        const { encodeUnsignedInt } = useCborIntegerEncoder()
        const result = encodeUnsignedInt(18446744073709551615n)  // 2^64 - 1

        expect(result.bytes).toEqual(new Uint8Array([0x1b, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]))
        expect(result.hex).toBe('1bffffffffffffffff')
      })
    })

    describe('Error cases', () => {
      it('should reject negative values', () => {
        const { encodeUnsignedInt } = useCborIntegerEncoder()

        expect(() => encodeUnsignedInt(-1)).toThrow('Cannot encode negative value as unsigned integer')
      })

      it('should reject values >= 2^64', () => {
        const { encodeUnsignedInt } = useCborIntegerEncoder()

        expect(() => encodeUnsignedInt(18446744073709551616n)).toThrow('Value exceeds maximum unsigned integer (2^64-1)')
      })
    })
  })

  describe('Negative Integers (Major Type 1)', () => {
    describe('Direct encoding (-1 to -24)', () => {
      it('should encode -1', () => {
        const { encodeNegativeInt } = useCborIntegerEncoder()
        const result = encodeNegativeInt(-1)

        expect(result.bytes).toEqual(new Uint8Array([0x20]))
        expect(result.hex).toBe('20')
      })

      it('should encode -10', () => {
        const { encodeNegativeInt } = useCborIntegerEncoder()
        const result = encodeNegativeInt(-10)

        expect(result.bytes).toEqual(new Uint8Array([0x29]))
        expect(result.hex).toBe('29')
      })

      it('should encode -24', () => {
        const { encodeNegativeInt } = useCborIntegerEncoder()
        const result = encodeNegativeInt(-24)

        expect(result.bytes).toEqual(new Uint8Array([0x37]))
        expect(result.hex).toBe('37')
      })
    })

    describe('1-byte encoding (-25 to -256)', () => {
      it('should encode -25', () => {
        const { encodeNegativeInt } = useCborIntegerEncoder()
        const result = encodeNegativeInt(-25)

        expect(result.bytes).toEqual(new Uint8Array([0x38, 0x18]))
        expect(result.hex).toBe('3818')
      })

      it('should encode -100', () => {
        const { encodeNegativeInt } = useCborIntegerEncoder()
        const result = encodeNegativeInt(-100)

        expect(result.bytes).toEqual(new Uint8Array([0x38, 0x63]))
        expect(result.hex).toBe('3863')
      })

      it('should encode -256', () => {
        const { encodeNegativeInt } = useCborIntegerEncoder()
        const result = encodeNegativeInt(-256)

        expect(result.bytes).toEqual(new Uint8Array([0x38, 0xff]))
        expect(result.hex).toBe('38ff')
      })
    })

    describe('2-byte encoding (-257 to -65536)', () => {
      it('should encode -257', () => {
        const { encodeNegativeInt } = useCborIntegerEncoder()
        const result = encodeNegativeInt(-257)

        expect(result.bytes).toEqual(new Uint8Array([0x39, 0x01, 0x00]))
        expect(result.hex).toBe('390100')
      })

      it('should encode -1000', () => {
        const { encodeNegativeInt } = useCborIntegerEncoder()
        const result = encodeNegativeInt(-1000)

        expect(result.bytes).toEqual(new Uint8Array([0x39, 0x03, 0xe7]))
        expect(result.hex).toBe('3903e7')
      })
    })

    describe('4-byte encoding', () => {
      it('should encode -1000000', () => {
        const { encodeNegativeInt } = useCborIntegerEncoder()
        const result = encodeNegativeInt(-1000000)

        expect(result.bytes).toEqual(new Uint8Array([0x3a, 0x00, 0x0f, 0x42, 0x3f]))
        expect(result.hex).toBe('3a000f423f')
      })
    })

    describe('Error cases', () => {
      it('should reject positive values', () => {
        const { encodeNegativeInt } = useCborIntegerEncoder()

        expect(() => encodeNegativeInt(1)).toThrow('Cannot encode positive value as negative integer')
      })

      it('should reject zero', () => {
        const { encodeNegativeInt } = useCborIntegerEncoder()

        expect(() => encodeNegativeInt(0)).toThrow('Cannot encode positive value as negative integer')
      })

      it('should reject values < -2^64', () => {
        const { encodeNegativeInt } = useCborIntegerEncoder()

        expect(() => encodeNegativeInt(-18446744073709551617n)).toThrow('Value exceeds minimum negative integer (-2^64)')
      })
    })
  })

  describe('Auto-detect integer type', () => {
    it('should encode positive integers', () => {
      const { encodeInteger } = useCborIntegerEncoder()

      expect(encodeInteger(0).hex).toBe('00')
      expect(encodeInteger(100).hex).toBe('1864')
      expect(encodeInteger(1000000).hex).toBe('1a000f4240')
    })

    it('should encode negative integers', () => {
      const { encodeInteger } = useCborIntegerEncoder()

      expect(encodeInteger(-1).hex).toBe('20')
      expect(encodeInteger(-100).hex).toBe('3863')
      expect(encodeInteger(-1000).hex).toBe('3903e7')
    })
  })
})
