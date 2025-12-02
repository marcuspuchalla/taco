/**
 * CBOR Simple Values and Floats Encoder Test Suite
 * Tests for Major Type 7 (Floats and Simple Values)
 */

import { describe, it, expect } from 'vitest'
import { useCborSimpleEncoder } from '../composables/useCborSimpleEncoder'

describe('CBOR Simple Values and Floats Encoder', () => {
  describe('Simple Values', () => {
    it('should encode false', () => {
      const { encodeSimple } = useCborSimpleEncoder()
      const result = encodeSimple(false)

      expect(result.bytes).toEqual(new Uint8Array([0xf4]))
      expect(result.hex).toBe('f4')
    })

    it('should encode true', () => {
      const { encodeSimple } = useCborSimpleEncoder()
      const result = encodeSimple(true)

      expect(result.bytes).toEqual(new Uint8Array([0xf5]))
      expect(result.hex).toBe('f5')
    })

    it('should encode null', () => {
      const { encodeSimple } = useCborSimpleEncoder()
      const result = encodeSimple(null)

      expect(result.bytes).toEqual(new Uint8Array([0xf6]))
      expect(result.hex).toBe('f6')
    })

    it('should encode undefined', () => {
      const { encodeSimple } = useCborSimpleEncoder()
      const result = encodeSimple(undefined)

      expect(result.bytes).toEqual(new Uint8Array([0xf7]))
      expect(result.hex).toBe('f7')
    })
  })

  describe('Floating-Point Numbers', () => {
    describe('Float16 (half precision)', () => {
      it('should encode 0.0 as float16', () => {
        const { encodeFloat } = useCborSimpleEncoder()
        const result = encodeFloat(0.0, 16)

        // 0xf9 (float16) + 0x0000
        expect(result.bytes).toEqual(new Uint8Array([0xf9, 0x00, 0x00]))
        expect(result.hex).toBe('f90000')
      })

      it('should encode 1.0 as float16', () => {
        const { encodeFloat } = useCborSimpleEncoder()
        const result = encodeFloat(1.0, 16)

        // 0xf9 (float16) + 0x3c00
        expect(result.bytes).toEqual(new Uint8Array([0xf9, 0x3c, 0x00]))
        expect(result.hex).toBe('f93c00')
      })

      it('should encode -1.0 as float16', () => {
        const { encodeFloat } = useCborSimpleEncoder()
        const result = encodeFloat(-1.0, 16)

        // 0xf9 (float16) + 0xbc00
        expect(result.bytes).toEqual(new Uint8Array([0xf9, 0xbc, 0x00]))
        expect(result.hex).toBe('f9bc00')
      })

      it('should encode Infinity as float16', () => {
        const { encodeFloat } = useCborSimpleEncoder()
        const result = encodeFloat(Infinity, 16)

        // 0xf9 (float16) + 0x7c00
        expect(result.bytes).toEqual(new Uint8Array([0xf9, 0x7c, 0x00]))
        expect(result.hex).toBe('f97c00')
      })

      it('should encode -Infinity as float16', () => {
        const { encodeFloat } = useCborSimpleEncoder()
        const result = encodeFloat(-Infinity, 16)

        // 0xf9 (float16) + 0xfc00
        expect(result.bytes).toEqual(new Uint8Array([0xf9, 0xfc, 0x00]))
        expect(result.hex).toBe('f9fc00')
      })

      it('should encode NaN as float16', () => {
        const { encodeFloat } = useCborSimpleEncoder()
        const result = encodeFloat(NaN, 16)

        // 0xf9 (float16) + 0x7e00
        expect(result.bytes).toEqual(new Uint8Array([0xf9, 0x7e, 0x00]))
        expect(result.hex).toBe('f97e00')
      })
    })

    describe('Float32 (single precision)', () => {
      it('should encode 0.0 as float32', () => {
        const { encodeFloat } = useCborSimpleEncoder()
        const result = encodeFloat(0.0, 32)

        // 0xfa (float32) + 0x00000000
        expect(result.bytes).toEqual(new Uint8Array([0xfa, 0x00, 0x00, 0x00, 0x00]))
        expect(result.hex).toBe('fa00000000')
      })

      it('should encode 1.0 as float32', () => {
        const { encodeFloat } = useCborSimpleEncoder()
        const result = encodeFloat(1.0, 32)

        // 0xfa (float32) + 0x3f800000
        expect(result.bytes).toEqual(new Uint8Array([0xfa, 0x3f, 0x80, 0x00, 0x00]))
        expect(result.hex).toBe('fa3f800000')
      })

      it('should encode 3.4028234663852886e+38 (max float32)', () => {
        const { encodeFloat } = useCborSimpleEncoder()
        const result = encodeFloat(3.4028234663852886e+38, 32)

        // 0xfa (float32) + 0x7f7fffff
        expect(result.bytes).toEqual(new Uint8Array([0xfa, 0x7f, 0x7f, 0xff, 0xff]))
        expect(result.hex).toBe('fa7f7fffff')
      })

      it('should encode Infinity as float32', () => {
        const { encodeFloat } = useCborSimpleEncoder()
        const result = encodeFloat(Infinity, 32)

        // 0xfa (float32) + 0x7f800000
        expect(result.bytes).toEqual(new Uint8Array([0xfa, 0x7f, 0x80, 0x00, 0x00]))
        expect(result.hex).toBe('fa7f800000')
      })
    })

    describe('Float64 (double precision)', () => {
      it('should encode 0.0 as float64', () => {
        const { encodeFloat } = useCborSimpleEncoder()
        const result = encodeFloat(0.0, 64)

        // 0xfb (float64) + 0x0000000000000000
        expect(result.bytes).toEqual(new Uint8Array([0xfb, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]))
        expect(result.hex).toBe('fb0000000000000000')
      })

      it('should encode 1.1 as float64', () => {
        const { encodeFloat } = useCborSimpleEncoder()
        const result = encodeFloat(1.1, 64)

        // RFC 8949 Appendix A example
        expect(result.bytes).toEqual(new Uint8Array([0xfb, 0x3f, 0xf1, 0x99, 0x99, 0x99, 0x99, 0x99, 0x9a]))
        expect(result.hex).toBe('fb3ff199999999999a')
      })

      it('should encode 1.0e+300 as float64', () => {
        const { encodeFloat } = useCborSimpleEncoder()
        const result = encodeFloat(1.0e+300, 64)

        // RFC 8949 Appendix A example
        expect(result.bytes).toEqual(new Uint8Array([0xfb, 0x7e, 0x37, 0xe4, 0x3c, 0x88, 0x00, 0x75, 0x9c]))
        expect(result.hex).toBe('fb7e37e43c8800759c')
      })

      it('should encode -4.1 as float64', () => {
        const { encodeFloat } = useCborSimpleEncoder()
        const result = encodeFloat(-4.1, 64)

        // RFC 8949 Appendix A example
        expect(result.bytes).toEqual(new Uint8Array([0xfb, 0xc0, 0x10, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66]))
        expect(result.hex).toBe('fbc010666666666666')
      })

      it('should encode Infinity as float64', () => {
        const { encodeFloat } = useCborSimpleEncoder()
        const result = encodeFloat(Infinity, 64)

        // 0xfb (float64) + 0x7ff0000000000000
        expect(result.bytes).toEqual(new Uint8Array([0xfb, 0x7f, 0xf0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]))
        expect(result.hex).toBe('fb7ff0000000000000')
      })

      it('should encode NaN as float64', () => {
        const { encodeFloat } = useCborSimpleEncoder()
        const result = encodeFloat(NaN, 64)

        // 0xfb (float64) + NaN representation
        expect(result.bytes[0]).toBe(0xfb)
        expect(result.bytes.length).toBe(9)
      })
    })

    describe('Auto-detect precision', () => {
      it('should encode integer-like float as integer', () => {
        const { encodeFloat } = useCborSimpleEncoder()
        const result = encodeFloat(100.0)

        // Should use integer encoding if possible
        // This is an optimization - float64 is also acceptable
        expect(result.bytes[0]).toBe(0x18)  // Integer encoding
        expect(result.bytes[1]).toBe(100)
      })

      it('should encode fractional number as smallest float', () => {
        const { encodeFloat } = useCborSimpleEncoder()
        const result = encodeFloat(1.5)

        // 1.5 can be represented in float16, float32, or float64
        // Any of these are acceptable
        expect([0xf9, 0xfa, 0xfb]).toContain(result.bytes[0])  // Float16, Float32, or Float64
      })

      it('should use float64 for high-precision numbers', () => {
        const { encodeFloat } = useCborSimpleEncoder()
        const result = encodeFloat(1.1)

        // 1.1 requires float64 for precision
        expect(result.bytes[0]).toBe(0xfb)  // Float64
      })
    })
  })
})
