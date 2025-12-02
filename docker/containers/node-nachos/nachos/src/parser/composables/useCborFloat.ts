/**
 * CBOR Float and Simple Values Parser Composable
 * Handles Major Type 7 (Simple Values and Floats)
 * Supports Float16, Float32, Float64, and simple values (true, false, null, undefined)
 */

import type { ParseResult, ParseOptions } from '../types'
import { hexToBytes, readByte, extractCborHeader } from '../utils'

/**
 * Composable for parsing CBOR floats and simple values (Major Type 7)
 *
 * @returns Object with parse, parseFloat, and parseSimple functions
 *
 * @example
 * ```ts
 * const { parse } = useCborFloat()
 * const result = parse('f5') // true
 * ```
 */
export function useCborFloat() {
  /**
   * Converts IEEE 754 binary16 (Float16) to JavaScript number
   * Manual conversion required as JavaScript doesn't have native Float16 support
   *
   * @param buffer - Data buffer
   * @param offset - Starting offset
   * @returns Float64 number representation
   */
  const float16ToFloat64 = (buffer: Uint8Array, offset: number): number => {
    // Read 16-bit value in big-endian
    const byte1 = readByte(buffer, offset)
    const byte2 = readByte(buffer, offset + 1)
    const value = (byte1 << 8) | byte2

    // Extract components
    const sign = (value & 0x8000) >> 15
    const exponent = (value & 0x7c00) >> 10
    const fraction = value & 0x03ff

    // Handle special cases
    if (exponent === 0) {
      if (fraction === 0) {
        // Zero (positive or negative)
        return sign === 0 ? 0.0 : -0.0
      }
      // Subnormal number
      return (sign === 0 ? 1 : -1) * Math.pow(2, -14) * (fraction / 1024)
    }

    if (exponent === 0x1f) {
      if (fraction === 0) {
        // Infinity (positive or negative)
        return sign === 0 ? Infinity : -Infinity
      }
      // NaN
      return NaN
    }

    // Normal number
    // Formula: (-1)^sign * 2^(exponent - 15) * (1 + fraction/1024)
    return (sign === 0 ? 1 : -1) * Math.pow(2, exponent - 15) * (1 + fraction / 1024)
  }

  /**
   * Parses simple values (booleans, null, undefined, unassigned)
   *
   * @param buffer - Data buffer
   * @param offset - Current offset
   * @returns Parsed simple value and bytes read
   */
  const parseSimpleFromBuffer = (buffer: Uint8Array, offset: number): ParseResult => {
    const initialByte = readByte(buffer, offset)
    const { majorType, additionalInfo } = extractCborHeader(initialByte)

    if (majorType !== 7) {
      throw new Error(`Expected major type 7 (simple/float), got ${majorType}`)
    }

    // Simple values based on additional info
    if (additionalInfo < 20) {
      // Unassigned simple values (0-19)
      return {
        value: { simpleValue: additionalInfo },
        bytesRead: 1
      }
    }

    switch (additionalInfo) {
      case 20: // false
        return { value: false, bytesRead: 1 }

      case 21: // true
        return { value: true, bytesRead: 1 }

      case 22: // null
        return { value: null, bytesRead: 1 }

      case 23: // undefined
        return { value: undefined, bytesRead: 1 }

      case 24: // 1-byte simple value
        {
          if (offset + 1 >= buffer.length) {
            throw new Error('Unexpected end of buffer while reading simple value')
          }
          const simpleValue = readByte(buffer, offset + 1)
          // Simple values 0-19 should not use 1-byte encoding
          if (simpleValue < 32) {
            throw new Error(`Invalid 1-byte encoding for simple value ${simpleValue}`)
          }
          return {
            value: { simpleValue },
            bytesRead: 2
          }
        }

      case 25: // Float16
      case 26: // Float32
      case 27: // Float64
        // These are floats, not simple values - should use parseFloatFromBuffer
        throw new Error(`Additional info ${additionalInfo} is a float, use parseFloat instead`)

      case 28:
      case 29:
      case 30:
        // Reserved
        throw new Error(`Reserved additional info value: ${additionalInfo}`)

      case 31: // Break marker
        throw new Error('Break marker (0xff) should only appear in indefinite-length items')

      default:
        throw new Error(`Invalid additional info: ${additionalInfo}`)
    }
  }

  /**
   * Parses floating point numbers (Float16, Float32, Float64)
   *
   * @param buffer - Data buffer
   * @param offset - Current offset
   * @returns Parsed float and bytes read
   */
  const parseFloatFromBuffer = (buffer: Uint8Array, offset: number): ParseResult => {
    const initialByte = readByte(buffer, offset)
    const { majorType, additionalInfo } = extractCborHeader(initialByte)

    if (majorType !== 7) {
      throw new Error(`Expected major type 7 (simple/float), got ${majorType}`)
    }

    switch (additionalInfo) {
      case 25: // Float16 (2 bytes)
        {
          if (offset + 2 >= buffer.length) {
            throw new Error('Unexpected end of buffer while reading Float16')
          }
          const value = float16ToFloat64(buffer, offset + 1)
          return { value, bytesRead: 3 }
        }

      case 26: // Float32 (4 bytes)
        {
          if (offset + 4 >= buffer.length) {
            throw new Error('Unexpected end of buffer while reading Float32')
          }
          // Use DataView for proper IEEE 754 parsing
          const dataView = new DataView(buffer.buffer, buffer.byteOffset + offset + 1, 4)
          const value = dataView.getFloat32(0, false) // false = big-endian
          return { value, bytesRead: 5 }
        }

      case 27: // Float64 (8 bytes)
        {
          if (offset + 8 >= buffer.length) {
            throw new Error('Unexpected end of buffer while reading Float64')
          }
          // Use DataView for proper IEEE 754 parsing
          const dataView = new DataView(buffer.buffer, buffer.byteOffset + offset + 1, 8)
          const value = dataView.getFloat64(0, false) // false = big-endian
          return { value, bytesRead: 9 }
        }

      default:
        throw new Error(`Additional info ${additionalInfo} is not a float type`)
    }
  }

  /**
   * Auto-detects and parses any Major Type 7 value (simple or float)
   *
   * @param buffer - Data buffer
   * @param offset - Current offset
   * @returns Parsed value and bytes read
   */
  const parseFromBuffer = (buffer: Uint8Array, offset: number): ParseResult => {
    const initialByte = readByte(buffer, offset)
    const { majorType, additionalInfo } = extractCborHeader(initialByte)

    if (majorType !== 7) {
      throw new Error(`Expected major type 7 (simple/float), got ${majorType}`)
    }

    // Determine if it's a float or simple value based on additional info
    if (additionalInfo === 25 || additionalInfo === 26 || additionalInfo === 27) {
      // Float16, Float32, or Float64
      return parseFloatFromBuffer(buffer, offset)
    } else {
      // Simple value (including false, true, null, undefined)
      return parseSimpleFromBuffer(buffer, offset)
    }
  }

  /**
   * Parses CBOR simple value from hex string
   *
   * @param hexString - CBOR hex string
   * @param _options - Parser options (optional, for future use)
   * @returns Parsed simple value and bytes read
   */
  const parseSimple = (hexString: string, _options?: ParseOptions): ParseResult => {
    const buffer = hexToBytes(hexString)
    return parseSimpleFromBuffer(buffer, 0)
  }

  /**
   * Parses CBOR float from hex string
   *
   * @param hexString - CBOR hex string
   * @param _options - Parser options (optional, for future use)
   * @returns Parsed float and bytes read
   */
  const parseFloat = (hexString: string, _options?: ParseOptions): ParseResult => {
    const buffer = hexToBytes(hexString)
    return parseFloatFromBuffer(buffer, 0)
  }

  /**
   * Auto-detects and parses any Major Type 7 value from hex string
   *
   * @param hexString - CBOR hex string
   * @param _options - Parser options (optional, for future use)
   * @returns Parsed value and bytes read
   */
  const parse = (hexString: string, _options?: ParseOptions): ParseResult => {
    const buffer = hexToBytes(hexString)
    return parseFromBuffer(buffer, 0)
  }

  return {
    parse,
    parseFloat,
    parseSimple
  }
}
