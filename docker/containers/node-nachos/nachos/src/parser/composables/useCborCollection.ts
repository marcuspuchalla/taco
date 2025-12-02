/**
 * CBOR Collection Parser Composable
 * Handles Major Types 4 (Arrays) and 5 (Maps)
 * Supports definite and indefinite length encoding
 */

import type { ParseResult, CborValue, CborMap, ParseOptions } from '../types'
import { INDEFINITE_SYMBOL, ALL_ENTRIES_SYMBOL } from '../types'
import { hexToBytes, readByte, readUint, readBigUint, extractCborHeader, compareBytes, bytesToHex } from '../utils'
import { useCborInteger } from './useCborInteger'
import { useCborString } from './useCborString'
import { useCborFloat } from './useCborFloat'
import { useCborTag } from './useCborTag'
import { logger } from '../../utils/logger'

/**
 * Composable for parsing CBOR collections (Major Types 4 and 5)
 *
 * @returns Object with parseArray and parseMap functions
 *
 * @example
 * ```ts
 * const { parseArray } = useCborCollection()
 * const result = parseArray('83010203') // [1, 2, 3]
 * ```
 */
export function useCborCollection() {
  const { parseInteger } = useCborInteger()
  const { parseByteString, parseTextString } = useCborString()
  const { parse: parseFloatOrSimple } = useCborFloat()
  const { parseTag } = useCborTag()

  /**
   * Convert a CBOR value to a string key for use in JavaScript objects
   * Handles Uint8Array keys by converting them to hex strings
   */
  const convertKeyToString = (key: CborValue): string => {
    if (key instanceof Uint8Array) {
      return bytesToHex(key)
    }
    return String(key)
  }

  /**
   * Internal parser dispatcher for CBOR items
   * Handles recursive parsing of nested structures
   *
   * @param buffer - Data buffer
   * @param offset - Current offset
   * @param options - Parser options
   * @param depth - Current nesting depth
   * @returns Parsed value and bytes consumed
   */
  const parseItem = (buffer: Uint8Array, offset: number, options?: ParseOptions, depth: number = 0): ParseResult => {
    if (offset >= buffer.length) {
      throw new Error(`Unexpected end of buffer at offset ${offset}`)
    }

    const initialByte = readByte(buffer, offset)
    const { majorType } = extractCborHeader(initialByte)

    switch (majorType) {
      case 0: // Unsigned integer
      case 1: // Negative integer
        {
          // Create a hex string from the buffer starting at offset
          const intHex = Array.from(buffer.slice(offset))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')
          const result = parseInteger(intHex, options)
          return { value: result.value, bytesRead: result.bytesRead }
        }

      case 2: // Byte string
        return parseByteString(buffer, offset, options)

      case 3: // Text string
        return parseTextString(buffer, offset, options)

      case 4: // Array
        return parseArrayFromBuffer(buffer, offset, options, depth)

      case 5: // Map
        return parseMapFromBuffer(buffer, offset, options, depth)

      case 6: // Tag
        {
          const tagHex = Array.from(buffer.slice(offset))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')
          const result = parseTag(tagHex, options)
          return { value: result.value, bytesRead: result.bytesRead }
        }

      case 7: // Simple/Float
        {
          const floatHex = Array.from(buffer.slice(offset))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')
          const result = parseFloatOrSimple(floatHex, options)
          return { value: result.value, bytesRead: result.bytesRead }
        }

      default:
        throw new Error(`Unknown major type: ${majorType}`)
    }
  }

  /**
   * Parses the length from CBOR additional info field
   *
   * @param buffer - Data buffer
   * @param offset - Current offset (after initial byte)
   * @param ai - Additional info field (0-31)
   * @returns Object with length and bytes consumed, or null for indefinite
   */
  const parseLength = (
    buffer: Uint8Array,
    offset: number,
    ai: number,
    options?: ParseOptions
  ): { length: number | null; bytesConsumed: number } => {
    if (ai < 24) {
      // Direct encoding (0-23)
      return { length: ai, bytesConsumed: 0 }
    } else if (ai === 24) {
      // 1 byte follows
      const length = readByte(buffer, offset)

      // RFC 8949 Section 4.2.1: Canonical encoding requires shortest form
      if (options?.validateCanonical && length < 24) {
        throw new Error(`Non-canonical length encoding: ${length} should use direct encoding (AI < 24), not AI=24`)
      }

      return { length, bytesConsumed: 1 }
    } else if (ai === 25) {
      // 2 bytes follow
      const length = readUint(buffer, offset, 2)

      // RFC 8949 Section 4.2.1: Value must be >= 256 to justify 2-byte encoding
      if (options?.validateCanonical && length < 256) {
        throw new Error(`Non-canonical length encoding: ${length} should use ${length < 24 ? 'direct encoding' : '1-byte encoding (AI=24)'}, not AI=25`)
      }

      return { length, bytesConsumed: 2 }
    } else if (ai === 26) {
      // 4 bytes follow
      const length = readUint(buffer, offset, 4)

      // RFC 8949 Section 4.2.1: Value must be >= 65536 to justify 4-byte encoding
      if (options?.validateCanonical && length < 65536) {
        throw new Error(`Non-canonical length encoding: ${length} should use shorter encoding, not AI=26`)
      }

      return { length, bytesConsumed: 4 }
    } else if (ai === 27) {
      // 8 bytes follow
      const lengthBigInt = readBigUint(buffer, offset, 8)

      // Check if value fits in safe integer range
      if (lengthBigInt > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new Error(`Collection length ${lengthBigInt} exceeds maximum safe integer`)
      }
      const length = Number(lengthBigInt)

      // RFC 8949 Section 4.2.1: Value must be >= 2^32 to justify 8-byte encoding
      if (options?.validateCanonical && length < 4294967296) {
        throw new Error(`Non-canonical length encoding: ${length} should use shorter encoding, not AI=27`)
      }

      return { length, bytesConsumed: 8 }
    } else if (ai === 31) {
      // Indefinite length (break-terminated)
      return { length: null, bytesConsumed: 0 }
    } else {
      throw new Error(`Invalid additional info: ${ai}`)
    }
  }

  /**
   * Internal array parser that works with buffers
   *
   * @param buffer - Data buffer
   * @param offset - Current offset
   * @param options - Parser options
   * @param depth - Current nesting depth
   * @returns Parsed array and bytes read
   */
  const parseArrayFromBuffer = (buffer: Uint8Array, offset: number, options?: ParseOptions, depth: number = 0): ParseResult => {
    const initialByte = readByte(buffer, offset)
    const { majorType, additionalInfo } = extractCborHeader(initialByte)

    if (majorType !== 4) {
      throw new Error(`Expected major type 4 (array), got ${majorType}`)
    }

    // Check if indefinite length is allowed
    // RFC 8949: Deterministic encoding MUST NOT use indefinite-length
    const isIndefiniteAllowed = options?.allowIndefinite ?? !(options?.validateCanonical || options?.strict)
    if (additionalInfo === 31 && !isIndefiniteAllowed) {
      throw new Error('Indefinite-length encoding is not allowed (strict/canonical mode)')
    }

    // Check depth limit before descending
    if (options?.limits?.maxDepth && depth >= options.limits.maxDepth) {
      throw new Error(`Maximum nesting depth ${options.limits.maxDepth} exceeded`)
    }

    const { length, bytesConsumed } = parseLength(buffer, offset + 1, additionalInfo, options)
    let currentOffset = offset + 1 + bytesConsumed
    const items: CborValue[] = []

    if (length === null) {
      // Indefinite-length array - read until break (0xff)
      let index = 0
      let foundBreak = false

      while (currentOffset < buffer.length) {
        const nextByte = readByte(buffer, currentOffset)

        // Check for break marker (0xff)
        if (nextByte === 0xff) {
          currentOffset++ // Consume the break byte
          foundBreak = true
          break
        }

        // Check array length limit
        if (options?.limits?.maxArrayLength && index >= options.limits.maxArrayLength) {
          throw new Error(`Array length exceeds limit of ${options.limits.maxArrayLength}`)
        }

        const itemResult = parseItem(buffer, currentOffset, options, depth + 1)
        items.push(itemResult.value)
        currentOffset += itemResult.bytesRead
        index++
      }

      // Ensure we found a break code
      if (!foundBreak) {
        throw new Error('Indefinite-length array missing break code (0xFF)')
      }

      // Mark as indefinite-length for round-trip preservation
      ;(items as any)[INDEFINITE_SYMBOL] = true
    } else {
      // Definite-length array
      // Check array length limit before parsing
      if (options?.limits?.maxArrayLength && length > options.limits.maxArrayLength) {
        throw new Error(`Array length ${length} exceeds limit of ${options.limits.maxArrayLength}`)
      }

      for (let i = 0; i < length; i++) {
        if (currentOffset >= buffer.length) {
          throw new Error(`Unexpected end of buffer while parsing array element ${i}/${length}`)
        }

        const itemResult = parseItem(buffer, currentOffset, options, depth + 1)
        items.push(itemResult.value)
        currentOffset += itemResult.bytesRead
      }
    }

    return {
      value: items,
      bytesRead: currentOffset - offset
    }
  }

  /**
   * Converts a CBOR value to its canonical byte representation for comparison
   * Note: Currently unused but kept for future canonical encoding validation
   */
  // const valueToBytes = (value: CborValue, buffer: Uint8Array, start: number, end: number): Uint8Array => {
  //   // For canonical comparison, we use the raw bytes from the buffer
  //   return buffer.slice(start, end)
  // }

  /**
   * Internal map parser that works with buffers
   *
   * @param buffer - Data buffer
   * @param offset - Current offset
   * @param options - Parser options
   * @param depth - Current nesting depth
   * @returns Parsed map and bytes read
   */
  const parseMapFromBuffer = (buffer: Uint8Array, offset: number, options?: ParseOptions, depth: number = 0): ParseResult => {
    const initialByte = readByte(buffer, offset)
    const { majorType, additionalInfo } = extractCborHeader(initialByte)

    if (majorType !== 5) {
      throw new Error(`Expected major type 5 (map), got ${majorType}`)
    }

    // Check if indefinite length is allowed
    // RFC 8949: Deterministic encoding MUST NOT use indefinite-length
    const isIndefiniteAllowed = options?.allowIndefinite ?? !(options?.validateCanonical || options?.strict)
    if (additionalInfo === 31 && !isIndefiniteAllowed) {
      throw new Error('Indefinite-length encoding is not allowed (strict/canonical mode)')
    }

    // Check depth limit before descending
    if (options?.limits?.maxDepth && depth >= options.limits.maxDepth) {
      throw new Error(`Maximum nesting depth ${options.limits.maxDepth} exceeded`)
    }

    const { length, bytesConsumed } = parseLength(buffer, offset + 1, additionalInfo, options)
    let currentOffset = offset + 1 + bytesConsumed
    const map: CborMap = new Map()

    // For duplicate key detection - store serialized keys
    const seenKeys = new Set<string>()

    // For canonical ordering validation
    const keyBytes: Uint8Array[] = []

    // Store ALL entries including duplicates for byte-perfect round-trips
    const allEntries: Array<[CborValue, CborValue]> = []

    if (length === null) {
      // Indefinite-length map - read until break (0xff)
      let index = 0
      let foundBreak = false

      while (currentOffset < buffer.length) {
        const nextByte = readByte(buffer, currentOffset)

        // Check for break marker (0xff)
        if (nextByte === 0xff) {
          currentOffset++ // Consume the break byte
          foundBreak = true
          break
        }

        // Check map size limit
        if (options?.limits?.maxMapSize && index >= options.limits.maxMapSize) {
          throw new Error(`Map size exceeds limit of ${options.limits.maxMapSize}`)
        }

        // Parse key
        const keyStart = currentOffset
        const keyResult = parseItem(buffer, currentOffset, options, depth + 1)
        const keyEnd = currentOffset + keyResult.bytesRead
        currentOffset += keyResult.bytesRead

        // Store key bytes for canonical validation
        if (options?.validateCanonical) {
          keyBytes.push(buffer.slice(keyStart, keyEnd))
        }

        // Parse value
        if (currentOffset >= buffer.length) {
          throw new Error('Unexpected end of buffer while parsing map value')
        }
        const valueResult = parseItem(buffer, currentOffset, options, depth + 1)
        currentOffset += valueResult.bytesRead

        // For duplicate key detection, serialize the key
        const keyString = convertKeyToString(keyResult.value)

        // Check for duplicate keys based on dupMapKeyMode
        // RFC 8949: Deterministic encoding SHOULD reject duplicate keys
        // Auto-enable rejection in canonical or strict mode (handled in mergeOptions)
        if (seenKeys.has(keyString)) {
          const mode: 'allow' | 'warn' | 'reject' = options?.dupMapKeyMode || 'allow'

          if (mode === 'reject') {
            throw new Error(`Duplicate map key detected: ${keyString} at offset ${keyStart}`)
          } else if (mode === 'warn') {
            logger.warn(`Duplicate map key detected: ${keyString} at offset ${keyStart}`)
          }
          // 'allow' mode: silently continue
        }
        seenKeys.add(keyString)

        // Store in Map with original key type (not string!)
        map.set(keyResult.value, valueResult.value)

        // Also store in allEntries to preserve order and duplicates
        allEntries.push([keyResult.value, valueResult.value])

        index++
      }

      // Ensure we found a break code
      if (!foundBreak) {
        throw new Error('Indefinite-length map missing break code (0xFF)')
      }

      // Mark as indefinite-length for round-trip preservation
      ;(map as any)[INDEFINITE_SYMBOL] = true
    } else {
      // Definite-length map
      // Check map size limit before parsing
      if (options?.limits?.maxMapSize && length > options.limits.maxMapSize) {
        throw new Error(`Map size ${length} exceeds limit of ${options.limits.maxMapSize}`)
      }

      for (let i = 0; i < length; i++) {
        if (currentOffset >= buffer.length) {
          throw new Error(`Unexpected end of buffer while parsing map entry ${i}/${length}`)
        }

        // Parse key
        const keyStart = currentOffset
        const keyResult = parseItem(buffer, currentOffset, options, depth + 1)
        const keyEnd = currentOffset + keyResult.bytesRead
        currentOffset += keyResult.bytesRead

        // Store key bytes for canonical validation
        if (options?.validateCanonical) {
          keyBytes.push(buffer.slice(keyStart, keyEnd))
        }

        // Parse value
        if (currentOffset >= buffer.length) {
          throw new Error(`Unexpected end of buffer while parsing map value for entry ${i}/${length}`)
        }
        const valueResult = parseItem(buffer, currentOffset, options, depth + 1)
        currentOffset += valueResult.bytesRead

        // For duplicate key detection, serialize the key
        const keyString = convertKeyToString(keyResult.value)

        // Check for duplicate keys based on dupMapKeyMode
        // RFC 8949: Deterministic encoding SHOULD reject duplicate keys
        // Auto-enable rejection in canonical or strict mode (handled in mergeOptions)
        if (seenKeys.has(keyString)) {
          const mode: 'allow' | 'warn' | 'reject' = options?.dupMapKeyMode || 'allow'

          if (mode === 'reject') {
            throw new Error(`Duplicate map key detected: ${keyString} at offset ${keyStart}`)
          } else if (mode === 'warn') {
            logger.warn(`Duplicate map key detected: ${keyString} at offset ${keyStart}`)
          }
          // 'allow' mode: silently continue
        }
        seenKeys.add(keyString)

        // Store in Map with original key type (not string!)
        map.set(keyResult.value, valueResult.value)

        // Also store in allEntries to preserve order and duplicates
        allEntries.push([keyResult.value, valueResult.value])
      }
    }

    // Attach allEntries to map for byte-perfect round-trips with duplicates
    ;(map as any)[ALL_ENTRIES_SYMBOL] = allEntries

    // Validate canonical key ordering (keys must be sorted by byte representation)
    if (options?.validateCanonical && keyBytes.length > 1) {
      for (let i = 1; i < keyBytes.length; i++) {
        const prevKey = keyBytes[i - 1]
        const currKey = keyBytes[i]
        if (prevKey && currKey) {
          const cmp = compareBytes(prevKey, currKey)
          if (cmp > 0) {
            throw new Error(
              `Map keys are not in canonical order: key at index ${i} should come before key at index ${i - 1}`
            )
          }
          if (cmp === 0) {
            throw new Error(`Duplicate map keys detected in canonical validation`)
          }
        }
      }
    }

    return {
      value: map,
      bytesRead: currentOffset - offset
    }
  }

  /**
   * Parses CBOR array (Major Type 4) from hex string
   *
   * @param hexString - CBOR hex string
   * @param options - Parser options (optional)
   * @returns Parsed array and bytes read
   */
  const parseArray = (hexString: string, options?: ParseOptions): ParseResult => {
    // Remove spaces from hex string
    const cleanHex = hexString.replace(/\s+/g, '')
    const buffer = hexToBytes(cleanHex)
    return parseArrayFromBuffer(buffer, 0, options, 0)
  }

  /**
   * Parses CBOR map (Major Type 5) from hex string
   *
   * @param hexString - CBOR hex string
   * @param options - Parser options (optional)
   * @returns Parsed map and bytes read
   */
  const parseMap = (hexString: string, options?: ParseOptions): ParseResult => {
    // Remove spaces from hex string
    const cleanHex = hexString.replace(/\s+/g, '')
    const buffer = hexToBytes(cleanHex)
    return parseMapFromBuffer(buffer, 0, options, 0)
  }

  return {
    parseArray,
    parseMap
  }
}
