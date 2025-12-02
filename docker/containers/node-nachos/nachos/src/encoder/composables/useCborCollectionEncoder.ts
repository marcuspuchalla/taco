/**
 * CBOR Collection Encoder Composable
 * Handles Major Type 4 (Arrays) and Major Type 5 (Maps)
 * Following RFC 8949 specification
 */

import type { EncodeResult, EncodeOptions, EncodeContext, EncodableValue } from '../types'
import { DEFAULT_ENCODE_OPTIONS, INDEFINITE_SYMBOL, ALL_ENTRIES_SYMBOL } from '../types'
import { bytesToHex, concatenateUint8Arrays, compareBytes } from '../utils'
import { useCborIntegerEncoder } from './useCborIntegerEncoder'
import { useCborStringEncoder } from './useCborStringEncoder'
import { useCborByteString, useCborTextString } from '../../parser/composables/useCborStringTypes'

interface CollectionEncodeOptions {
  indefinite?: boolean
}

/**
 * CBOR Collection Encoder Composable
 *
 * Provides functions to encode arrays and maps:
 * - Major Type 4: Arrays
 * - Major Type 5: Maps (objects or Map instances)
 *
 * Supports both definite-length and indefinite-length encoding.
 * Handles canonical encoding with sorted map keys.
 * Enforces depth and size limits.
 *
 * @param options - Global encoder options
 *
 * @example
 * ```ts
 * const { encodeArray, encodeMap } = useCborCollectionEncoder()
 *
 * // Encode array
 * const arr = [1, 2, 3]
 * const result1 = encodeArray(arr)
 * // result1: { bytes: Uint8Array([0x83, 0x01, 0x02, 0x03]), hex: '83010203' }
 *
 * // Encode map
 * const map = { amount: 1000000 }
 * const result2 = encodeMap(map)
 * // result2: { bytes: ..., hex: 'a166616d6f756e741a000f4240' }
 * ```
 */
export function useCborCollectionEncoder(globalOptions?: Partial<EncodeOptions>) {
  const options = { ...DEFAULT_ENCODE_OPTIONS, ...globalOptions }

  // Get other encoders
  const { encodeInteger } = useCborIntegerEncoder()
  const { encodeTextString, encodeByteString } = useCborStringEncoder(globalOptions)
  const { isCborByteString } = useCborByteString()
  const { isCborTextString } = useCborTextString()

  /**
   * Encode a single value (recursive)
   *
   * NOTE: This is set by the main encoder to enable recursive encoding of all types
   * including tagged values. This avoids circular dependencies.
   */
  let mainEncode: ((value: EncodableValue) => EncodeResult) | null = null

  /**
   * Set the main encode function for recursive encoding
   * This must be called by useCborEncoder before encoding collections
   */
  const setMainEncode = (encodeFn: (value: EncodableValue) => EncodeResult) => {
    mainEncode = encodeFn
  }

  /**
   * Encode a single value (recursive)
   *
   * @param value - Value to encode
   * @param ctx - Encoding context for depth tracking
   * @returns Encoded CBOR bytes
   */
  const encodeValue = (value: EncodableValue, ctx: EncodeContext): Uint8Array => {
    // Check depth limit
    if (ctx.depth > ctx.options.maxDepth) {
      throw new Error('Maximum nesting depth exceeded')
    }

    // Encode based on type
    if (value === null || value === undefined) {
      // null/undefined -> CBOR null (0xf6)
      return new Uint8Array([0xf6])
    }
    else if (typeof value === 'boolean') {
      // true: 0xf5, false: 0xf4
      return new Uint8Array([value ? 0xf5 : 0xf4])
    }
    else if (typeof value === 'number' || typeof value === 'bigint') {
      return encodeInteger(value).bytes
    }
    else if (typeof value === 'string' || isCborTextString(value)) {
      return encodeTextString(value).bytes
    }
    else if (value instanceof Uint8Array || isCborByteString(value)) {
      return encodeByteString(value).bytes
    }
    else if (Array.isArray(value)) {
      // Recursive array encoding - check for indefinite marker
      const isIndefinite = (value as any)[INDEFINITE_SYMBOL] === true
      const newCtx = { ...ctx, depth: ctx.depth + 1 }

      if (isIndefinite) {
        // Use indefinite encoding - but need to recursively encode items
        const parts: Uint8Array[] = [new Uint8Array([0x9f])]  // Start marker
        for (const item of value) {
          const encoded = encodeValue(item, newCtx)
          parts.push(encoded)
        }
        parts.push(new Uint8Array([0xff]))  // Break marker
        return concatenateUint8Arrays(parts)
      } else {
        return encodeArrayInternal(value, newCtx).bytes
      }
    }
    else if (typeof value === 'object' && value !== null && 'tag' in value && 'value' in value) {
      // Tagged value - delegate to main encoder if available
      if (mainEncode) {
        return mainEncode(value).bytes
      }
      throw new Error('Tagged value encoding requires main encoder to be set')
    }
    else if (value instanceof Map || (typeof value === 'object' && value !== null)) {
      // Recursive map encoding - check for indefinite marker
      const isIndefinite = (value as any)[INDEFINITE_SYMBOL] === true
      const newCtx = { ...ctx, depth: ctx.depth + 1 }

      if (isIndefinite) {
        // Use indefinite encoding
        const entries: Array<[EncodableValue, EncodableValue]> =
          value instanceof Map
            ? Array.from(value.entries())
            : Object.entries(value)

        const parts: Uint8Array[] = [new Uint8Array([0xbf])]  // Start marker
        for (const [key, val] of entries) {
          const encodedKey = encodeValue(key, newCtx)
          const encodedValue = encodeValue(val, newCtx)
          parts.push(encodedKey)
          parts.push(encodedValue)
        }
        parts.push(new Uint8Array([0xff]))  // Break marker
        return concatenateUint8Arrays(parts)
      } else {
        return encodeMapInternal(value as Map<EncodableValue, EncodableValue> | { [key: string]: EncodableValue }, newCtx).bytes
      }
    }
    else {
      throw new Error(`Unsupported value type: ${typeof value}`)
    }
  }

  /**
   * Encode length header for arrays and maps
   *
   * @param majorType - Major type (4 for arrays, 5 for maps)
   * @param length - Number of elements
   * @returns Encoded length header
   */
  const encodeLengthHeader = (majorType: number, length: number): Uint8Array => {
    const baseValue = majorType << 5

    if (length <= 23) {
      return new Uint8Array([baseValue | length])
    }
    else if (length <= 255) {
      return new Uint8Array([baseValue | 24, length])
    }
    else if (length <= 65535) {
      return new Uint8Array([baseValue | 25, length >> 8, length & 0xff])
    }
    else if (length <= 4294967295) {
      return new Uint8Array([
        baseValue | 26,
        (length >> 24) & 0xff,
        (length >> 16) & 0xff,
        (length >> 8) & 0xff,
        length & 0xff
      ])
    }
    else {
      throw new Error('Collection too large to encode')
    }
  }

  /**
   * Internal array encoding (used by recursive calls)
   */
  const encodeArrayInternal = (
    array: EncodableValue[],
    ctx: EncodeContext
  ): EncodeResult => {
    const header = encodeLengthHeader(4, array.length)
    const parts: Uint8Array[] = [header]

    // Encode each element
    for (const item of array) {
      const encoded = encodeValue(item, ctx)
      parts.push(encoded)
    }

    const result = concatenateUint8Arrays(parts)

    // Check output size
    ctx.bytesWritten += result.length
    if (ctx.bytesWritten > ctx.options.maxOutputSize) {
      throw new Error('Encoded output exceeds maximum size')
    }

    return {
      bytes: result,
      hex: bytesToHex(result)
    }
  }

  /**
   * Encode array (Major Type 4)
   *
   * @param array - Array of encodable values
   * @param encodeOptions - Encoding options
   * @returns Encoded CBOR bytes and hex string
   */
  const encodeArray = (
    array: EncodableValue[],
    encodeOptions?: CollectionEncodeOptions
  ): EncodeResult => {
    // Check if array was originally encoded with indefinite length
    const isIndefinite = (array as any)[INDEFINITE_SYMBOL] === true

    // Handle indefinite-length encoding
    if (encodeOptions?.indefinite || isIndefinite) {
      if (options.canonical) {
        throw new Error('Indefinite-length encoding not allowed in canonical mode')
      }
      return encodeArrayIndefinite(array)
    }

    // Definite-length encoding
    const ctx: EncodeContext = {
      depth: 0,
      bytesWritten: 0,
      options
    }

    return encodeArrayInternal(array, ctx)
  }

  /**
   * Encode array with indefinite length
   *
   * @param array - Array of encodable values
   * @returns Encoded CBOR bytes and hex string
   */
  const encodeArrayIndefinite = (array: EncodableValue[]): EncodeResult => {
    if (options.canonical) {
      throw new Error('Indefinite-length encoding not allowed in canonical mode')
    }

    const parts: Uint8Array[] = [new Uint8Array([0x9f])]  // Start marker

    const ctx: EncodeContext = {
      depth: 0,
      bytesWritten: 0,
      options
    }

    // Encode each element
    for (const item of array) {
      const encoded = encodeValue(item, ctx)
      parts.push(encoded)
    }

    parts.push(new Uint8Array([0xff]))  // Break marker

    const result = concatenateUint8Arrays(parts)

    return {
      bytes: result,
      hex: bytesToHex(result)
    }
  }

  /**
   * Internal map encoding (used by recursive calls)
   */
  const encodeMapInternal = (
    map: Map<EncodableValue, EncodableValue> | { [key: string]: EncodableValue },
    ctx: EncodeContext
  ): EncodeResult => {
    // Check for ALL_ENTRIES_SYMBOL for byte-perfect preservation with duplicates
    let entries: Array<[EncodableValue, EncodableValue]>

    if ((map as any)[ALL_ENTRIES_SYMBOL]) {
      // Use the preserved entries (includes duplicates and original order)
      entries = (map as any)[ALL_ENTRIES_SYMBOL]
    } else {
      // Convert object to Map if needed
      entries = map instanceof Map
        ? Array.from(map.entries())
        : Object.entries(map)
    }

    // In canonical mode, sort entries by encoded key (unless using allEntries for byte-perfect)
    if (ctx.options.canonical && !(map as any)[ALL_ENTRIES_SYMBOL]) {
      entries.sort((a, b) => {
        const keyA = encodeValue(a[0], { ...ctx, depth: ctx.depth + 1 })
        const keyB = encodeValue(b[0], { ...ctx, depth: ctx.depth + 1 })
        return compareBytes(keyA, keyB)
      })
    }

    const header = encodeLengthHeader(5, entries.length)
    const parts: Uint8Array[] = [header]

    // Encode each key-value pair
    for (const [key, value] of entries) {
      const encodedKey = encodeValue(key, ctx)
      const encodedValue = encodeValue(value, ctx)
      parts.push(encodedKey)
      parts.push(encodedValue)
    }

    const result = concatenateUint8Arrays(parts)

    // Check output size
    ctx.bytesWritten += result.length
    if (ctx.bytesWritten > ctx.options.maxOutputSize) {
      throw new Error('Encoded output exceeds maximum size')
    }

    return {
      bytes: result,
      hex: bytesToHex(result)
    }
  }

  /**
   * Encode map (Major Type 5)
   *
   * @param map - Map or plain object
   * @param encodeOptions - Encoding options
   * @returns Encoded CBOR bytes and hex string
   */
  const encodeMap = (
    map: Map<EncodableValue, EncodableValue> | { [key: string]: EncodableValue },
    encodeOptions?: CollectionEncodeOptions
  ): EncodeResult => {
    // Check if map was originally encoded with indefinite length
    const isIndefinite = (map as any)[INDEFINITE_SYMBOL] === true

    // Handle indefinite-length encoding
    if (encodeOptions?.indefinite || isIndefinite) {
      if (options.canonical) {
        throw new Error('Indefinite-length encoding not allowed in canonical mode')
      }
      return encodeMapIndefinite(map)
    }

    // Definite-length encoding
    const ctx: EncodeContext = {
      depth: 0,
      bytesWritten: 0,
      options
    }

    return encodeMapInternal(map, ctx)
  }

  /**
   * Encode map with indefinite length
   *
   * @param map - Map or plain object
   * @returns Encoded CBOR bytes and hex string
   */
  const encodeMapIndefinite = (
    map: Map<EncodableValue, EncodableValue> | { [key: string]: EncodableValue }
  ): EncodeResult => {
    if (options.canonical) {
      throw new Error('Indefinite-length encoding not allowed in canonical mode')
    }

    const entries: Array<[EncodableValue, EncodableValue]> =
      map instanceof Map
        ? Array.from(map.entries())
        : Object.entries(map)

    const parts: Uint8Array[] = [new Uint8Array([0xbf])]  // Start marker

    const ctx: EncodeContext = {
      depth: 0,
      bytesWritten: 0,
      options
    }

    // Encode each key-value pair
    for (const [key, value] of entries) {
      const encodedKey = encodeValue(key, ctx)
      const encodedValue = encodeValue(value, ctx)
      parts.push(encodedKey)
      parts.push(encodedValue)
    }

    parts.push(new Uint8Array([0xff]))  // Break marker

    const result = concatenateUint8Arrays(parts)

    return {
      bytes: result,
      hex: bytesToHex(result)
    }
  }

  return {
    encodeArray,
    encodeArrayIndefinite,
    encodeMap,
    encodeMapIndefinite,
    setMainEncode
  }
}
