/**
 * CBOR String Encoder Composable
 * Handles Major Type 2 (Byte Strings) and Major Type 3 (Text Strings)
 * Following RFC 8949 specification
 */

import type { EncodeResult, EncodeOptions, CborByteString, CborTextString } from '../types'
import { DEFAULT_ENCODE_OPTIONS, INDEFINITE_SYMBOL } from '../types'
import { bytesToHex, concatenateUint8Arrays, writeUint, writeBigUint } from '../utils'
import { useCborByteString, useCborTextString } from '../../parser/composables/useCborStringTypes'

interface StringEncodeOptions {
  indefinite?: boolean
}

/**
 * CBOR String Encoder Composable
 *
 * Provides functions to encode byte strings and text strings:
 * - Major Type 2: Byte strings (Uint8Array)
 * - Major Type 3: Text strings (UTF-8 encoded)
 *
 * Supports both definite-length and indefinite-length encoding.
 *
 * @param options - Global encoder options
 *
 * @example
 * ```ts
 * const { encodeByteString, encodeTextString } = useCborStringEncoder()
 *
 * // Encode byte string
 * const bytes = new Uint8Array([0x01, 0x02, 0x03])
 * const result1 = encodeByteString(bytes)
 * // result1: { bytes: Uint8Array([0x43, 0x01, 0x02, 0x03]), hex: '43010203' }
 *
 * // Encode text string
 * const result2 = encodeTextString('Hello')
 * // result2: { bytes: Uint8Array([0x65, 0x48, 0x65, 0x6c, 0x6c, 0x6f]), hex: '6548656c6c6f' }
 *
 * // Indefinite-length encoding
 * const chunks = [new Uint8Array([0xaa]), new Uint8Array([0xbb])]
 * const result3 = encodeByteStringIndefinite(chunks)
 * // result3: { bytes: Uint8Array([0x5f, 0x41, 0xaa, 0x41, 0xbb, 0xff]), hex: '5f41aa41bbff' }
 * ```
 */
export function useCborStringEncoder(globalOptions?: Partial<EncodeOptions>) {
  const options = { ...DEFAULT_ENCODE_OPTIONS, ...globalOptions }
  const { isCborByteString } = useCborByteString()
  const { isCborTextString } = useCborTextString()

  /**
   * Encode the length header for a string
   *
   * @param majorType - Major type (2 for bytes, 3 for text)
   * @param length - Length of the string in bytes
   * @returns Encoded length header
   */
  const encodeLengthHeader = (majorType: number, length: number): Uint8Array => {
    const baseValue = majorType << 5

    // Direct encoding (0-23)
    if (length <= 23) {
      return new Uint8Array([baseValue | length])
    }
    // 1-byte length (24-255)
    else if (length <= 255) {
      return new Uint8Array([baseValue | 24, length])
    }
    // 2-byte length (256-65535)
    else if (length <= 65535) {
      const lengthBytes = writeUint(length, 2)
      return new Uint8Array([baseValue | 25, ...lengthBytes])
    }
    // 4-byte length (65536-4294967295)
    else if (length <= 4294967295) {
      const lengthBytes = writeUint(length, 4)
      return new Uint8Array([baseValue | 26, ...lengthBytes])
    }
    // 8-byte length (> 4294967295)
    else {
      const lengthBytes = length > Number.MAX_SAFE_INTEGER
        ? writeBigUint(BigInt(length), 8)
        : writeUint(length, 8)
      return new Uint8Array([baseValue | 27, ...lengthBytes])
    }
  }

  /**
   * Encode byte string (Major Type 2)
   *
   * Can encode either:
   * - Definite-length: Single Uint8Array
   * - Indefinite-length: Array of Uint8Array chunks (if indefinite option is set)
   *
   * @param data - Byte data or array of chunks
   * @param encodeOptions - Encoding options
   * @returns Encoded CBOR bytes and hex string
   * @throws Error if indefinite encoding is used in canonical mode
   */
  const encodeByteString = (
    data: Uint8Array | Uint8Array[] | CborByteString,
    encodeOptions?: StringEncodeOptions
  ): EncodeResult => {
    // Check if it's a CborByteString with indefinite marker
    const isIndefinite = isCborByteString(data) && (data as any)[INDEFINITE_SYMBOL] === true

    // Handle indefinite-length encoding
    if (encodeOptions?.indefinite || Array.isArray(data) || isIndefinite) {
      if (options.canonical) {
        throw new Error('Indefinite-length encoding not allowed in canonical mode')
      }

      // If it's a CborByteString with chunks, use the original chunks
      if (isCborByteString(data) && data.chunks) {
        return encodeByteStringIndefinite(data.chunks)
      }

      // Otherwise, get the actual bytes and encode as single chunk
      const bytes = isCborByteString(data) ? data.bytes : (Array.isArray(data) ? data : [data])
      return encodeByteStringIndefinite(Array.isArray(bytes) ? bytes : [bytes])
    }

    // Definite-length encoding - extract bytes from CborByteString if needed
    const bytes = isCborByteString(data) ? data.bytes : (data as Uint8Array)
    const header = encodeLengthHeader(2, bytes.length)
    const result = concatenateUint8Arrays([header, bytes])

    // Check output size limit
    if (result.length > options.maxOutputSize) {
      throw new Error('Encoded output exceeds maximum size')
    }

    return {
      bytes: result,
      hex: bytesToHex(result)
    }
  }

  /**
   * Encode byte string with indefinite length (Major Type 2)
   *
   * Format: 0x5f + chunk1 + chunk2 + ... + 0xff
   * Each chunk is a definite-length byte string.
   *
   * @param chunks - Array of byte string chunks
   * @returns Encoded CBOR bytes and hex string
   */
  const encodeByteStringIndefinite = (chunks: Uint8Array[]): EncodeResult => {
    if (options.canonical) {
      throw new Error('Indefinite-length encoding not allowed in canonical mode')
    }

    const parts: Uint8Array[] = [new Uint8Array([0x5f])]  // Start marker

    // Encode each chunk as definite-length byte string
    for (const chunk of chunks) {
      const header = encodeLengthHeader(2, chunk.length)
      parts.push(header)
      parts.push(chunk)
    }

    parts.push(new Uint8Array([0xff]))  // Break marker

    const result = concatenateUint8Arrays(parts)

    return {
      bytes: result,
      hex: bytesToHex(result)
    }
  }

  /**
   * Encode text string (Major Type 3)
   *
   * Text strings are encoded as UTF-8 bytes.
   *
   * @param text - Text string to encode
   * @param _encodeOptions - Encoding options (reserved for future use)
   * @returns Encoded CBOR bytes and hex string
   */
  const encodeTextString = (
    text: string | CborTextString,
    encodeOptions?: StringEncodeOptions
  ): EncodeResult => {
    // Check if it's a CborTextString with indefinite marker
    const isIndefinite = isCborTextString(text) && (text as any)[INDEFINITE_SYMBOL] === true

    // Handle indefinite-length encoding
    if (encodeOptions?.indefinite || isIndefinite) {
      if (options.canonical) {
        throw new Error('Indefinite-length encoding not allowed in canonical mode')
      }

      // If it's a CborTextString with chunks, use the original chunks
      if (isCborTextString(text) && text.chunks) {
        return encodeTextStringIndefinite(text.chunks)
      }

      // Otherwise, get the actual text and encode as single chunk
      const textStr = isCborTextString(text) ? text.text : text
      return encodeTextStringIndefinite([textStr])
    }

    // Definite-length encoding - extract text from CborTextString if needed
    const textStr = isCborTextString(text) ? text.text : text

    // Convert string to UTF-8 bytes
    const encoder = new TextEncoder()
    const utf8Bytes = encoder.encode(textStr)

    const header = encodeLengthHeader(3, utf8Bytes.length)
    const result = concatenateUint8Arrays([header, utf8Bytes])

    // Check output size limit
    if (result.length > options.maxOutputSize) {
      throw new Error('Encoded output exceeds maximum size')
    }

    return {
      bytes: result,
      hex: bytesToHex(result)
    }
  }

  /**
   * Encode text string with indefinite length (Major Type 3)
   *
   * Format: 0x7f + chunk1 + chunk2 + ... + 0xff
   * Each chunk is a definite-length text string.
   *
   * @param chunks - Array of text string chunks
   * @returns Encoded CBOR bytes and hex string
   */
  const encodeTextStringIndefinite = (chunks: string[]): EncodeResult => {
    if (options.canonical) {
      throw new Error('Indefinite-length encoding not allowed in canonical mode')
    }

    const parts: Uint8Array[] = [new Uint8Array([0x7f])]  // Start marker

    // Encode each chunk as definite-length text string
    const encoder = new TextEncoder()
    for (const chunk of chunks) {
      const utf8Bytes = encoder.encode(chunk)
      const header = encodeLengthHeader(3, utf8Bytes.length)
      parts.push(header)
      parts.push(utf8Bytes)
    }

    parts.push(new Uint8Array([0xff]))  // Break marker

    const result = concatenateUint8Arrays(parts)

    return {
      bytes: result,
      hex: bytesToHex(result)
    }
  }

  return {
    encodeByteString,
    encodeByteStringIndefinite,
    encodeTextString,
    encodeTextStringIndefinite
  }
}
