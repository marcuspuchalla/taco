/**
 * CBOR Float and Simple Values Parser Tests
 * Major Type 7 (Simple Values and Floats)
 * Following RFC 8949 specification
 */

import { describe, it, expect } from 'vitest'
import { useCborFloat } from '../composables/useCborFloat'

describe('useCborFloat', () => {
  describe('Simple Values', () => {
    describe('Boolean Values', () => {
      it('should parse false (0xf4)', () => {
        const { parseSimple } = useCborFloat()

        // RFC 8949: false = 0xf4
        const result = parseSimple('f4')
        expect(result.value).toBe(false)
        expect(result.bytesRead).toBe(1)
      })

      it('should parse true (0xf5)', () => {
        const { parseSimple } = useCborFloat()

        // RFC 8949: true = 0xf5
        const result = parseSimple('f5')
        expect(result.value).toBe(true)
        expect(result.bytesRead).toBe(1)
      })
    })

    describe('Null and Undefined', () => {
      it('should parse null (0xf6)', () => {
        const { parseSimple } = useCborFloat()

        // RFC 8949: null = 0xf6
        const result = parseSimple('f6')
        expect(result.value).toBe(null)
        expect(result.bytesRead).toBe(1)
      })

      it('should parse undefined (0xf7)', () => {
        const { parseSimple } = useCborFloat()

        // RFC 8949: undefined = 0xf7
        const result = parseSimple('f7')
        expect(result.value).toBe(undefined)
        expect(result.bytesRead).toBe(1)
      })
    })

    describe('Unassigned Simple Values', () => {
      it('should handle simple value 0 (0xe0)', () => {
        const { parseSimple } = useCborFloat()

        // Simple value 0 = 0xe0
        const result = parseSimple('e0')
        expect(result.value).toEqual({ simpleValue: 0 })
        expect(result.bytesRead).toBe(1)
      })

      it('should handle simple value 19 (0xf3)', () => {
        const { parseSimple } = useCborFloat()

        // Simple value 19 = 0xf3
        const result = parseSimple('f3')
        expect(result.value).toEqual({ simpleValue: 19 })
        expect(result.bytesRead).toBe(1)
      })

      it('should handle 1-byte simple value 32 (0xf8 0x20)', () => {
        const { parseSimple } = useCborFloat()

        // Simple value 32 = 0xf8 0x20
        const result = parseSimple('f820')
        expect(result.value).toEqual({ simpleValue: 32 })
        expect(result.bytesRead).toBe(2)
      })

      it('should handle 1-byte simple value 255 (0xf8 0xff)', () => {
        const { parseSimple } = useCborFloat()

        // Simple value 255 = 0xf8 0xff
        const result = parseSimple('f8ff')
        expect(result.value).toEqual({ simpleValue: 255 })
        expect(result.bytesRead).toBe(2)
      })
    })
  })

  describe('Float16 (IEEE 754 binary16)', () => {
    it('should parse 0.0 (0xf9 0x0000)', () => {
      const { parseFloat } = useCborFloat()

      // Float16: 0.0 = 0xf9 0x00 0x00
      const result = parseFloat('f90000')
      expect(result.value).toBe(0.0)
      expect(result.bytesRead).toBe(3)
    })

    it('should parse -0.0 (0xf9 0x8000)', () => {
      const { parseFloat } = useCborFloat()

      // Float16: -0.0 = 0xf9 0x80 0x00
      const result = parseFloat('f98000')
      expect(result.value).toBe(-0.0)
      expect(Object.is(result.value, -0.0)).toBe(true)
      expect(result.bytesRead).toBe(3)
    })

    it('should parse 1.0 (0xf9 0x3c00)', () => {
      const { parseFloat } = useCborFloat()

      // Float16: 1.0 = 0xf9 0x3c 0x00
      const result = parseFloat('f93c00')
      expect(result.value).toBe(1.0)
      expect(result.bytesRead).toBe(3)
    })

    it('should parse -1.0 (0xf9 0xbc00)', () => {
      const { parseFloat } = useCborFloat()

      // Float16: -1.0 = 0xf9 0xbc 0x00
      const result = parseFloat('f9bc00')
      expect(result.value).toBe(-1.0)
      expect(result.bytesRead).toBe(3)
    })

    it('should parse 1.5 (0xf9 0x3e00)', () => {
      const { parseFloat } = useCborFloat()

      // Float16: 1.5 = 0xf9 0x3e 0x00
      const result = parseFloat('f93e00')
      expect(result.value).toBe(1.5)
      expect(result.bytesRead).toBe(3)
    })

    it('should parse 65504.0 (max normal) (0xf9 0x7bff)', () => {
      const { parseFloat } = useCborFloat()

      // Float16: 65504.0 (max) = 0xf9 0x7b 0xff
      const result = parseFloat('f97bff')
      expect(result.value).toBe(65504.0)
      expect(result.bytesRead).toBe(3)
    })

    it('should parse Infinity (0xf9 0x7c00)', () => {
      const { parseFloat } = useCborFloat()

      // Float16: +Infinity = 0xf9 0x7c 0x00
      const result = parseFloat('f97c00')
      expect(result.value).toBe(Infinity)
      expect(result.bytesRead).toBe(3)
    })

    it('should parse -Infinity (0xf9 0xfc00)', () => {
      const { parseFloat } = useCborFloat()

      // Float16: -Infinity = 0xf9 0xfc 0x00
      const result = parseFloat('f9fc00')
      expect(result.value).toBe(-Infinity)
      expect(result.bytesRead).toBe(3)
    })

    it('should parse NaN (0xf9 0x7e00)', () => {
      const { parseFloat } = useCborFloat()

      // Float16: NaN = 0xf9 0x7e 0x00
      const result = parseFloat('f97e00')
      expect(Number.isNaN(result.value)).toBe(true)
      expect(result.bytesRead).toBe(3)
    })

    it('should parse smallest positive subnormal (0xf9 0x0001)', () => {
      const { parseFloat } = useCborFloat()

      // Float16: smallest positive subnormal = 0xf9 0x00 0x01
      // Formula: 2^-14 * (1/1024) = 2^-24 ≈ 5.960464477539063e-8
      const result = parseFloat('f90001')
      expect(result.value).toBeCloseTo(5.960464477539063e-8, 15)
      expect(result.bytesRead).toBe(3)
    })
  })

  describe('Float32 (IEEE 754 single precision)', () => {
    it('should parse 0.0 (0xfa 0x00000000)', () => {
      const { parseFloat } = useCborFloat()

      // Float32: 0.0 = 0xfa 0x00 0x00 0x00 0x00
      const result = parseFloat('fa00000000')
      expect(result.value).toBe(0.0)
      expect(result.bytesRead).toBe(5)
    })

    it('should parse 1.0 (0xfa 0x3f800000)', () => {
      const { parseFloat } = useCborFloat()

      // Float32: 1.0 = 0xfa 0x3f 0x80 0x00 0x00
      const result = parseFloat('fa3f800000')
      expect(result.value).toBe(1.0)
      expect(result.bytesRead).toBe(5)
    })

    it('should parse -1.0 (0xfa 0xbf800000)', () => {
      const { parseFloat } = useCborFloat()

      // Float32: -1.0 = 0xfa 0xbf 0x80 0x00 0x00
      const result = parseFloat('fabf800000')
      expect(result.value).toBe(-1.0)
      expect(result.bytesRead).toBe(5)
    })

    it('should parse 3.4028234663852886e+38 (max) (0xfa 0x7f7fffff)', () => {
      const { parseFloat } = useCborFloat()

      // Float32: max value = 0xfa 0x7f 0x7f 0xff 0xff
      const result = parseFloat('fa7f7fffff')
      expect(result.value).toBeCloseTo(3.4028234663852886e+38, -30)
      expect(result.bytesRead).toBe(5)
    })

    it('should parse Infinity (0xfa 0x7f800000)', () => {
      const { parseFloat } = useCborFloat()

      // Float32: +Infinity = 0xfa 0x7f 0x80 0x00 0x00
      const result = parseFloat('fa7f800000')
      expect(result.value).toBe(Infinity)
      expect(result.bytesRead).toBe(5)
    })

    it('should parse -Infinity (0xfa 0xff800000)', () => {
      const { parseFloat } = useCborFloat()

      // Float32: -Infinity = 0xfa 0xff 0x80 0x00 0x00
      const result = parseFloat('faff800000')
      expect(result.value).toBe(-Infinity)
      expect(result.bytesRead).toBe(5)
    })

    it('should parse NaN (0xfa 0x7fc00000)', () => {
      const { parseFloat } = useCborFloat()

      // Float32: NaN = 0xfa 0x7fc00000
      const result = parseFloat('fa7fc00000')
      expect(Number.isNaN(result.value)).toBe(true)
      expect(result.bytesRead).toBe(5)
    })

    it('should parse 100000.0', () => {
      const { parseFloat } = useCborFloat()

      // Float32: 100000.0 = 0xfa 0x47 0xc3 0x50 0x00
      const result = parseFloat('fa47c35000')
      expect(result.value).toBe(100000.0)
      expect(result.bytesRead).toBe(5)
    })
  })

  describe('Float64 (IEEE 754 double precision)', () => {
    it('should parse 0.0 (0xfb 0x0000000000000000)', () => {
      const { parseFloat } = useCborFloat()

      // Float64: 0.0 = 0xfb + 8 bytes of zero
      const result = parseFloat('fb0000000000000000')
      expect(result.value).toBe(0.0)
      expect(result.bytesRead).toBe(9)
    })

    it('should parse 1.0 (0xfb 0x3ff0000000000000)', () => {
      const { parseFloat } = useCborFloat()

      // Float64: 1.0 = 0xfb 0x3ff0000000000000
      const result = parseFloat('fb3ff0000000000000')
      expect(result.value).toBe(1.0)
      expect(result.bytesRead).toBe(9)
    })

    it('should parse -1.0 (0xfb 0xbff0000000000000)', () => {
      const { parseFloat } = useCborFloat()

      // Float64: -1.0 = 0xfb 0xbff0000000000000
      const result = parseFloat('fbbff0000000000000')
      expect(result.value).toBe(-1.0)
      expect(result.bytesRead).toBe(9)
    })

    it('should parse 1.1 (0xfb 0x3ff199999999999a)', () => {
      const { parseFloat } = useCborFloat()

      // Float64: 1.1 = 0xfb 0x3ff199999999999a
      const result = parseFloat('fb3ff199999999999a')
      expect(result.value).toBe(1.1)
      expect(result.bytesRead).toBe(9)
    })

    it('should parse -4.1 (0xfb 0xc010666666666666)', () => {
      const { parseFloat } = useCborFloat()

      // Float64: -4.1 = 0xfb 0xc010666666666666
      const result = parseFloat('fbc010666666666666')
      expect(result.value).toBe(-4.1)
      expect(result.bytesRead).toBe(9)
    })

    it('should parse 1.0e+300 (0xfb 0x7e37e43c8800759c)', () => {
      const { parseFloat } = useCborFloat()

      // Float64: 1.0e+300 = 0xfb 0x7e37e43c8800759c
      const result = parseFloat('fb7e37e43c8800759c')
      expect(result.value).toBe(1.0e+300)
      expect(result.bytesRead).toBe(9)
    })

    it('should parse Infinity (0xfb 0x7ff0000000000000)', () => {
      const { parseFloat } = useCborFloat()

      // Float64: +Infinity = 0xfb 0x7ff0000000000000
      const result = parseFloat('fb7ff0000000000000')
      expect(result.value).toBe(Infinity)
      expect(result.bytesRead).toBe(9)
    })

    it('should parse -Infinity (0xfb 0xfff0000000000000)', () => {
      const { parseFloat } = useCborFloat()

      // Float64: -Infinity = 0xfb 0xfff0000000000000
      const result = parseFloat('fbfff0000000000000')
      expect(result.value).toBe(-Infinity)
      expect(result.bytesRead).toBe(9)
    })

    it('should parse NaN (0xfb 0x7ff8000000000000)', () => {
      const { parseFloat } = useCborFloat()

      // Float64: NaN = 0xfb 0x7ff8000000000000
      const result = parseFloat('fb7ff8000000000000')
      expect(Number.isNaN(result.value)).toBe(true)
      expect(result.bytesRead).toBe(9)
    })
  })

  describe('Auto-detect parse function', () => {
    it('should auto-detect and parse false', () => {
      const { parse } = useCborFloat()

      const result = parse('f4')
      expect(result.value).toBe(false)
      expect(result.bytesRead).toBe(1)
    })

    it('should auto-detect and parse true', () => {
      const { parse } = useCborFloat()

      const result = parse('f5')
      expect(result.value).toBe(true)
      expect(result.bytesRead).toBe(1)
    })

    it('should auto-detect and parse null', () => {
      const { parse } = useCborFloat()

      const result = parse('f6')
      expect(result.value).toBe(null)
      expect(result.bytesRead).toBe(1)
    })

    it('should auto-detect and parse undefined', () => {
      const { parse } = useCborFloat()

      const result = parse('f7')
      expect(result.value).toBe(undefined)
      expect(result.bytesRead).toBe(1)
    })

    it('should auto-detect and parse Float16', () => {
      const { parse } = useCborFloat()

      const result = parse('f93c00')
      expect(result.value).toBe(1.0)
      expect(result.bytesRead).toBe(3)
    })

    it('should auto-detect and parse Float32', () => {
      const { parse } = useCborFloat()

      const result = parse('fa3f800000')
      expect(result.value).toBe(1.0)
      expect(result.bytesRead).toBe(5)
    })

    it('should auto-detect and parse Float64', () => {
      const { parse } = useCborFloat()

      const result = parse('fb3ff0000000000000')
      expect(result.value).toBe(1.0)
      expect(result.bytesRead).toBe(9)
    })

    it('should auto-detect and parse unassigned simple value', () => {
      const { parse } = useCborFloat()

      const result = parse('e0')
      expect(result.value).toEqual({ simpleValue: 0 })
      expect(result.bytesRead).toBe(1)
    })
  })

  describe('Error Handling', () => {
    it('should throw error for invalid major type', () => {
      const { parse } = useCborFloat()

      // 0x00 = integer 0, not MT 7
      expect(() => parse('00')).toThrow('Expected major type 7')
    })

    it('should throw error for reserved additional info values', () => {
      const { parse } = useCborFloat()

      // 0xfc = MT 7, AI 28 (reserved)
      expect(() => parse('fc')).toThrow()
    })

    it('should throw error for truncated Float16', () => {
      const { parseFloat } = useCborFloat()

      // 0xf9 = Float16 indicator, but no data
      expect(() => parseFloat('f9')).toThrow()
    })

    it('should throw error for truncated Float32', () => {
      const { parseFloat } = useCborFloat()

      // 0xfa = Float32 indicator, incomplete data
      expect(() => parseFloat('fa3f8000')).toThrow()
    })

    it('should throw error for truncated Float64', () => {
      const { parseFloat } = useCborFloat()

      // 0xfb = Float64 indicator, incomplete data
      expect(() => parseFloat('fb3ff00000')).toThrow()
    })
  })

  describe('RFC 8949 Appendix A Examples', () => {
    it('should parse RFC example: false', () => {
      const { parse } = useCborFloat()

      const result = parse('f4')
      expect(result.value).toBe(false)
    })

    it('should parse RFC example: true', () => {
      const { parse } = useCborFloat()

      const result = parse('f5')
      expect(result.value).toBe(true)
    })

    it('should parse RFC example: null', () => {
      const { parse } = useCborFloat()

      const result = parse('f6')
      expect(result.value).toBe(null)
    })

    it('should parse RFC example: undefined', () => {
      const { parse } = useCborFloat()

      const result = parse('f7')
      expect(result.value).toBe(undefined)
    })

    it('should parse RFC example: Float16 0.0', () => {
      const { parse } = useCborFloat()

      const result = parse('f90000')
      expect(result.value).toBe(0.0)
    })

    it('should parse RFC example: Float32 100000.0', () => {
      const { parse } = useCborFloat()

      const result = parse('fa47c35000')
      expect(result.value).toBe(100000.0)
    })

    it('should parse RFC example: Float64 1.1', () => {
      const { parse } = useCborFloat()

      const result = parse('fb3ff199999999999a')
      expect(result.value).toBe(1.1)
    })

    it('should parse RFC example: Float64 1.0e+300', () => {
      const { parse } = useCborFloat()

      const result = parse('fb7e37e43c8800759c')
      expect(result.value).toBe(1.0e+300)
    })
  })
})
