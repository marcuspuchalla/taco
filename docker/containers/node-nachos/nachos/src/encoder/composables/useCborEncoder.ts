/**
 * Main CBOR Encoder Composable
 * High-level API for encoding JavaScript values to CBOR
 * Following RFC 8949 specification
 */

import type { EncodeResult, EncodeOptions, EncodableValue } from '../types'
import { DEFAULT_ENCODE_OPTIONS } from '../types'
import { useCborIntegerEncoder } from './useCborIntegerEncoder'
import { useCborStringEncoder } from './useCborStringEncoder'
import { useCborCollectionEncoder } from './useCborCollectionEncoder'
import { useCborSimpleEncoder } from './useCborSimpleEncoder'
import { useCborTagEncoder } from './useCborTagEncoder'
import { useCborByteString, useCborTextString } from '../../parser/composables/useCborStringTypes'

/**
 * Main CBOR Encoder Composable
 *
 * Provides a unified interface for encoding any JavaScript value to CBOR.
 * Automatically selects the appropriate encoder based on value type.
 *
 * @param options - Global encoder options
 *
 * @example
 * ```ts
 * const { encode } = useCborEncoder()
 *
 * // Encode various types
 * encode(42)           // Integer
 * encode("hello")      // Text string
 * encode([1, 2, 3])    // Array
 * encode({ a: 1 })     // Map
 * encode(true)         // Boolean
 * encode(3.14)         // Float
 * encode(new Uint8Array([0xff]))  // Byte string
 *
 * // With options
 * const { encode: encodeCanonical } = useCborEncoder({ canonical: true })
 * encodeCanonical({ z: 1, a: 2 })  // Keys will be sorted
 * ```
 */
export function useCborEncoder(globalOptions?: Partial<EncodeOptions>) {
  const options = { ...DEFAULT_ENCODE_OPTIONS, ...globalOptions }

  // Get all specialized encoders
  const { encodeInteger } = useCborIntegerEncoder()
  const { encodeTextString, encodeByteString } = useCborStringEncoder(options)
  const { encodeArray, encodeMap, setMainEncode } = useCborCollectionEncoder(options)
  const { encodeSimple, encodeFloat } = useCborSimpleEncoder(options)
  const { encodeTaggedValue } = useCborTagEncoder()

  // Get type guards for composable string types
  const { isCborByteString } = useCborByteString()
  const { isCborTextString } = useCborTextString()

  /**
   * Encode any JavaScript value to CBOR
   *
   * Automatically detects the type and uses the appropriate encoder:
   * - number/bigint → Integer or Float
   * - string → Text string
   * - boolean/null/undefined → Simple values
   * - Uint8Array → Byte string
   * - Array → CBOR array
   * - {tag: number, value: any} → Tagged value
   * - Object/Map → CBOR map
   *
   * @param value - Value to encode
   * @returns Encoded CBOR bytes and hex string
   * @throws Error if value type is unsupported
   */
  const encode = (value: EncodableValue): EncodeResult => {
    // Handle null/undefined/boolean
    if (value === null || value === undefined || typeof value === 'boolean') {
      return encodeSimple(value)
    }

    // Handle numbers
    if (typeof value === 'number') {
      // Check if it's an integer
      if (Number.isInteger(value) && Number.isSafeInteger(value)) {
        return encodeInteger(value)
      }
      // It's a float
      return encodeFloat(value)
    }

    // Handle bigint
    if (typeof value === 'bigint') {
      return encodeInteger(value)
    }

    // Handle composable text strings (check before primitive strings)
    if (isCborTextString(value)) {
      return encodeTextString(value)
    }

    // Handle strings
    if (typeof value === 'string') {
      return encodeTextString(value)
    }

    // Handle composable byte strings (check before Uint8Array)
    if (isCborByteString(value)) {
      return encodeByteString(value)
    }

    // Handle Uint8Array (byte strings)
    if (value instanceof Uint8Array) {
      return encodeByteString(value)
    }

    // Handle arrays
    if (Array.isArray(value)) {
      return encodeArray(value)
    }

    // Handle Map
    if (value instanceof Map) {
      return encodeMap(value)
    }

    // Handle tagged values (MUST come before plain objects)
    // Check for {tag: number, value: any} structure
    if (typeof value === 'object' && value !== null && 'tag' in value && 'value' in value && typeof (value as { tag: unknown }).tag === 'number') {
      return encodeTaggedValue(value as { tag: number; value: unknown }, encode)
    }

    // Handle plain objects
    if (typeof value === 'object' && value !== null) {
      return encodeMap(value)
    }

    throw new Error(`Unsupported value type: ${typeof value}`)
  }

  // Set the main encode function for recursive collection encoding
  // This allows the collection encoder to handle nested tagged values
  setMainEncode(encode)

  /**
   * Encode value and return only the hex string
   *
   * @param value - Value to encode
   * @returns Hex string representation
   */
  const encodeToHex = (value: EncodableValue): string => {
    return encode(value).hex
  }

  /**
   * Encode value and return only the bytes
   *
   * @param value - Value to encode
   * @returns Uint8Array bytes
   */
  const encodeToBytes = (value: EncodableValue): Uint8Array => {
    return encode(value).bytes
  }

  /**
   * Encode multiple values in sequence
   *
   * Useful for CBOR sequences (RFC 8742)
   *
   * @param values - Values to encode
   * @returns Concatenated CBOR encoding
   */
  const encodeSequence = (values: EncodableValue[]): EncodeResult => {
    const allBytes: Uint8Array[] = []

    for (const value of values) {
      const result = encode(value)
      allBytes.push(result.bytes)
    }

    // Concatenate all encoded values
    const totalLength = allBytes.reduce((sum, arr) => sum + arr.length, 0)
    const concatenated = new Uint8Array(totalLength)

    let offset = 0
    for (const bytes of allBytes) {
      concatenated.set(bytes, offset)
      offset += bytes.length
    }

    const hex = Array.from(concatenated)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    return {
      bytes: concatenated,
      hex
    }
  }

  return {
    encode,
    encodeToHex,
    encodeToBytes,
    encodeSequence
  }
}
