/**
 * CBOR Simple Values and Floats Encoder Composable
 * Handles Major Type 7 (Floats and Simple Values)
 * Following RFC 8949 specification
 */

import type { EncodeResult, EncodeOptions } from '../types'
import { bytesToHex } from '../utils'
import { useCborIntegerEncoder } from './useCborIntegerEncoder'

/**
 * CBOR Simple Values and Floats Encoder Composable
 *
 * Provides functions to encode:
 * - Simple values: false, true, null, undefined
 * - Floating-point numbers: float16, float32, float64
 *
 * @param options - Global encoder options
 *
 * @example
 * ```ts
 * const { encodeSimple, encodeFloat } = useCborSimpleEncoder()
 *
 * // Encode simple values
 * const result1 = encodeSimple(true)
 * // result1: { bytes: Uint8Array([0xf5]), hex: 'f5' }
 *
 * // Encode float
 * const result2 = encodeFloat(1.1)
 * // result2: { bytes: Uint8Array([0xfb, ...]), hex: 'fb...' }
 * ```
 */
export function useCborSimpleEncoder(_globalOptions?: Partial<EncodeOptions>) {
  const { encodeInteger } = useCborIntegerEncoder()

  /**
   * Encode simple values (booleans, null, undefined)
   *
   * @param value - Simple value to encode
   * @returns Encoded CBOR bytes and hex string
   */
  const encodeSimple = (value: boolean | null | undefined): EncodeResult => {
    let byte: number

    if (value === false) {
      byte = 0xf4
    } else if (value === true) {
      byte = 0xf5
    } else if (value === null) {
      byte = 0xf6
    } else if (value === undefined) {
      byte = 0xf7
    } else {
      throw new Error(`Unsupported simple value: ${value}`)
    }

    return {
      bytes: new Uint8Array([byte]),
      hex: bytesToHex(new Uint8Array([byte]))
    }
  }

  /**
   * Encode float16 (IEEE 754 half precision)
   *
   * @param value - Number to encode
   * @returns Uint8Array with float16 bytes (2 bytes)
   */
  const encodeFloat16Bytes = (value: number): Uint8Array => {
    // Handle special cases
    if (value === 0) return new Uint8Array([0x00, 0x00])
    if (value === -0) return new Uint8Array([0x80, 0x00])
    if (Number.isNaN(value)) return new Uint8Array([0x7e, 0x00])
    if (value === Infinity) return new Uint8Array([0x7c, 0x00])
    if (value === -Infinity) return new Uint8Array([0xfc, 0x00])

    // Convert float64 to float16
    const sign = value < 0 ? 1 : 0
    const absValue = Math.abs(value)

    // Get exponent and mantissa from float64
    const buffer = new ArrayBuffer(8)
    const view = new DataView(buffer)
    view.setFloat64(0, absValue, false)

    const bits = view.getBigUint64(0, false)
    const exp64 = Number((bits >> 52n) & 0x7ffn) - 1023
    const mant64 = Number(bits & 0xfffffffffffffn)

    // Convert to float16 range
    let exp16: number
    let mant16: number

    if (exp64 < -14) {
      // Subnormal or zero
      exp16 = 0
      mant16 = 0
    } else if (exp64 > 15) {
      // Overflow to infinity
      exp16 = 31
      mant16 = 0
    } else {
      // Normal number
      exp16 = exp64 + 15
      // Take top 10 bits of mantissa
      mant16 = mant64 >> 42
    }

    const float16 = (sign << 15) | (exp16 << 10) | mant16

    return new Uint8Array([
      (float16 >> 8) & 0xff,
      float16 & 0xff
    ])
  }

  /**
   * Encode float32 (IEEE 754 single precision)
   *
   * @param value - Number to encode
   * @returns Uint8Array with float32 bytes (4 bytes)
   */
  const encodeFloat32Bytes = (value: number): Uint8Array => {
    const buffer = new ArrayBuffer(4)
    const view = new DataView(buffer)
    view.setFloat32(0, value, false)  // Big-endian

    return new Uint8Array(buffer)
  }

  /**
   * Encode float64 (IEEE 754 double precision)
   *
   * @param value - Number to encode
   * @returns Uint8Array with float64 bytes (8 bytes)
   */
  const encodeFloat64Bytes = (value: number): Uint8Array => {
    const buffer = new ArrayBuffer(8)
    const view = new DataView(buffer)
    view.setFloat64(0, value, false)  // Big-endian

    return new Uint8Array(buffer)
  }

  /**
   * Check if a number can be exactly represented as float16
   *
   * @param value - Number to check
   * @returns True if can be represented as float16
   */
  const canBeFloat16 = (value: number): boolean => {
    // Special values
    if (!Number.isFinite(value) || value === 0 || value === -0) {
      return true
    }

    // Check range
    const absValue = Math.abs(value)
    if (absValue < 0.00006103515625 || absValue > 65504) {
      return false
    }

    // Encode and decode to check for precision loss
    const bytes = encodeFloat16Bytes(value)
    const view = new DataView(bytes.buffer)
    const bits = view.getUint16(0, false)

    const sign = (bits >> 15) & 0x1
    const exp = (bits >> 10) & 0x1f
    const mant = bits & 0x3ff

    let decoded: number

    if (exp === 0) {
      decoded = (sign ? -1 : 1) * Math.pow(2, -14) * (mant / 1024)
    } else if (exp === 31) {
      decoded = mant === 0 ? (sign ? -Infinity : Infinity) : NaN
    } else {
      decoded = (sign ? -1 : 1) * Math.pow(2, exp - 15) * (1 + mant / 1024)
    }

    return decoded === value
  }

  /**
   * Check if a number can be exactly represented as float32
   *
   * @param value - Number to check
   * @returns True if can be represented as float32
   */
  const canBeFloat32 = (value: number): boolean => {
    // Special values
    if (!Number.isFinite(value) || value === 0 || value === -0) {
      return true
    }

    // Encode as float32 and decode back to check for precision loss
    const buffer = new ArrayBuffer(4)
    const view = new DataView(buffer)
    view.setFloat32(0, value, false)
    const decoded = view.getFloat32(0, false)

    return decoded === value
  }

  /**
   * Check if a number is an integer
   *
   * @param value - Number to check
   * @returns True if value is an integer
   */
  const isInteger = (value: number): boolean => {
    return Number.isInteger(value) && Number.isSafeInteger(value)
  }

  /**
   * Encode floating-point number
   *
   * @param value - Number to encode
   * @param precision - Optional precision (16, 32, or 64). If not specified, uses smallest possible.
   * @returns Encoded CBOR bytes and hex string
   */
  const encodeFloat = (value: number, precision?: 16 | 32 | 64): EncodeResult => {
    let bytes: Uint8Array

    // If value is an integer, encode as integer
    if (isInteger(value) && !precision) {
      return encodeInteger(value)
    }

    // If precision is specified, use it
    if (precision === 16) {
      const floatBytes = encodeFloat16Bytes(value)
      bytes = new Uint8Array([0xf9, ...floatBytes])
    } else if (precision === 32) {
      const floatBytes = encodeFloat32Bytes(value)
      bytes = new Uint8Array([0xfa, ...floatBytes])
    } else if (precision === 64) {
      const floatBytes = encodeFloat64Bytes(value)
      bytes = new Uint8Array([0xfb, ...floatBytes])
    } else {
      // Auto-detect smallest precision
      if (canBeFloat16(value)) {
        const floatBytes = encodeFloat16Bytes(value)
        bytes = new Uint8Array([0xf9, ...floatBytes])
      } else if (canBeFloat32(value)) {
        const floatBytes = encodeFloat32Bytes(value)
        bytes = new Uint8Array([0xfa, ...floatBytes])
      } else {
        // Use float64 for best precision
        const floatBytes = encodeFloat64Bytes(value)
        bytes = new Uint8Array([0xfb, ...floatBytes])
      }
    }

    return {
      bytes,
      hex: bytesToHex(bytes)
    }
  }

  return {
    encodeSimple,
    encodeFloat
  }
}
