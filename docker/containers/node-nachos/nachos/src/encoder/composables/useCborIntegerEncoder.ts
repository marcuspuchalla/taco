/**
 * CBOR Integer Encoder Composable
 * Handles Major Type 0 (Unsigned) and Major Type 1 (Negative)
 * Following RFC 8949 specification
 */

import type { EncodeResult } from '../types'
import { bytesToHex, writeUint, writeBigUint } from '../utils'

/**
 * CBOR Integer Encoder Composable
 *
 * Provides functions to encode integers to CBOR format:
 * - Major Type 0: Unsigned integers (0 to 2^64-1)
 * - Major Type 1: Negative integers (-1 to -2^64)
 *
 * @example
 * ```ts
 * const { encodeUnsignedInt, encodeNegativeInt, encodeInteger } = useCborIntegerEncoder()
 *
 * // Encode unsigned integer
 * const result1 = encodeUnsignedInt(100)
 * // result1: { bytes: Uint8Array([0x18, 0x64]), hex: '1864' }
 *
 * // Encode negative integer
 * const result2 = encodeNegativeInt(-100)
 * // result2: { bytes: Uint8Array([0x38, 0x63]), hex: '3863' }
 *
 * // Auto-detect integer type
 * const result3 = encodeInteger(-100)
 * // result3: { bytes: Uint8Array([0x38, 0x63]), hex: '3863' }
 * ```
 */
export function useCborIntegerEncoder() {
  /**
   * Encode unsigned integer (Major Type 0)
   *
   * Encoding rules:
   * - 0-23: Direct encoding in initial byte (0x00-0x17)
   * - 24-255: 0x18 + 1 byte
   * - 256-65535: 0x19 + 2 bytes
   * - 65536-4294967295: 0x1a + 4 bytes
   * - 4294967296-2^64-1: 0x1b + 8 bytes
   *
   * @param value - Unsigned integer (0 to 2^64-1)
   * @returns Encoded CBOR bytes and hex string
   * @throws Error if value is negative or >= 2^64
   */
  const encodeUnsignedInt = (value: number | bigint): EncodeResult => {
    // Convert to BigInt for consistent handling
    const bigValue = typeof value === 'bigint' ? value : BigInt(value)

    // Validate value is non-negative
    if (bigValue < 0n) {
      throw new Error('Cannot encode negative value as unsigned integer')
    }

    // Validate value doesn't exceed 2^64-1
    const MAX_UINT64 = 18446744073709551615n  // 2^64 - 1
    if (bigValue > MAX_UINT64) {
      throw new Error('Value exceeds maximum unsigned integer (2^64-1)')
    }

    let bytes: Uint8Array

    // Direct encoding (0-23)
    if (bigValue <= 23n) {
      bytes = new Uint8Array([Number(bigValue)])
    }
    // 1-byte encoding (24-255)
    else if (bigValue <= 255n) {
      bytes = new Uint8Array([0x18, Number(bigValue)])
    }
    // 2-byte encoding (256-65535)
    else if (bigValue <= 65535n) {
      const valueBytes = writeUint(Number(bigValue), 2)
      bytes = new Uint8Array([0x19, ...valueBytes])
    }
    // 4-byte encoding (65536-4294967295)
    else if (bigValue <= 4294967295n) {
      const valueBytes = writeUint(Number(bigValue), 4)
      bytes = new Uint8Array([0x1a, ...valueBytes])
    }
    // 8-byte encoding (> 4294967295)
    else {
      const valueBytes = writeBigUint(bigValue, 8)
      bytes = new Uint8Array([0x1b, ...valueBytes])
    }

    return {
      bytes,
      hex: bytesToHex(bytes)
    }
  }

  /**
   * Encode negative integer (Major Type 1)
   *
   * CBOR encodes negative integers as: -1 - N
   * where N is the encoded value
   *
   * Encoding rules:
   * - -1 to -24: Direct encoding in initial byte (0x20-0x37)
   * - -25 to -256: 0x38 + 1 byte
   * - -257 to -65536: 0x39 + 2 bytes
   * - -65537 to -4294967296: 0x3a + 4 bytes
   * - -4294967297 to -2^64: 0x3b + 8 bytes
   *
   * @param value - Negative integer (-1 to -2^64)
   * @returns Encoded CBOR bytes and hex string
   * @throws Error if value is non-negative or < -2^64
   */
  const encodeNegativeInt = (value: number | bigint): EncodeResult => {
    // Convert to BigInt for consistent handling
    const bigValue = typeof value === 'bigint' ? value : BigInt(value)

    // Validate value is negative
    if (bigValue >= 0n) {
      throw new Error('Cannot encode positive value as negative integer')
    }

    // Validate value doesn't exceed -2^64
    const MIN_INT64 = -18446744073709551616n  // -2^64
    if (bigValue < MIN_INT64) {
      throw new Error('Value exceeds minimum negative integer (-2^64)')
    }

    // CBOR encodes negative as: -1 - N
    // So for value V, we encode N = -1 - V
    const encoded = -1n - bigValue

    let bytes: Uint8Array

    // Direct encoding (-1 to -24, encoded as 0-23)
    if (encoded <= 23n) {
      bytes = new Uint8Array([0x20 + Number(encoded)])
    }
    // 1-byte encoding (-25 to -256, encoded as 24-255)
    else if (encoded <= 255n) {
      bytes = new Uint8Array([0x38, Number(encoded)])
    }
    // 2-byte encoding (-257 to -65536, encoded as 256-65535)
    else if (encoded <= 65535n) {
      const valueBytes = writeUint(Number(encoded), 2)
      bytes = new Uint8Array([0x39, ...valueBytes])
    }
    // 4-byte encoding (-65537 to -4294967296, encoded as 65536-4294967295)
    else if (encoded <= 4294967295n) {
      const valueBytes = writeUint(Number(encoded), 4)
      bytes = new Uint8Array([0x3a, ...valueBytes])
    }
    // 8-byte encoding (< -4294967296)
    else {
      const valueBytes = writeBigUint(encoded, 8)
      bytes = new Uint8Array([0x3b, ...valueBytes])
    }

    return {
      bytes,
      hex: bytesToHex(bytes)
    }
  }

  /**
   * Encode integer (auto-detect type)
   *
   * Automatically selects Major Type 0 (unsigned) or Major Type 1 (negative)
   * based on the sign of the value.
   *
   * @param value - Any integer
   * @returns Encoded CBOR bytes and hex string
   */
  const encodeInteger = (value: number | bigint): EncodeResult => {
    const bigValue = typeof value === 'bigint' ? value : BigInt(value)

    if (bigValue < 0n) {
      return encodeNegativeInt(bigValue)
    } else {
      return encodeUnsignedInt(bigValue)
    }
  }

  return {
    encodeUnsignedInt,
    encodeNegativeInt,
    encodeInteger
  }
}
