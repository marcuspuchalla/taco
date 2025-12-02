/**
 * CBOR Tag Parser Composable
 * Handles Major Type 6 (Semantic Tags)
 * Supports standard tags (0-5), encoding hints (21-36), self-describe (55799), and Cardano tags
 */

import type { ParseResult, CborValue, TaggedValue, CborMap, ParseOptions, PlutusConstr } from '../types'
import { INDEFINITE_SYMBOL } from '../types'
import { hexToBytes, readByte, readUint, readBigUint, extractCborHeader, hasDuplicates } from '../utils'
import { useCborInteger } from './useCborInteger'
import { useCborString } from './useCborString'
import { useCborFloat } from './useCborFloat'

/**
 * Composable for parsing CBOR tags (Major Type 6)
 *
 * @returns Object with parseTag and parse functions
 *
 * @example
 * ```ts
 * const { parseTag } = useCborTag()
 * const result = parseTag('c11a514b67b0') // 1(1363896240) - epoch timestamp
 * ```
 */
export function useCborTag() {
  const { parseInteger } = useCborInteger()
  const { parseByteString, parseTextString } = useCborString()
  const { parseFloat, parseSimple } = useCborFloat()

  /**
   * Internal parser dispatcher for CBOR items
   * Handles recursive parsing of tagged values
   *
   * @param buffer - Data buffer
   * @param offset - Current offset
   * @param options - Parser options
   * @param tagDepth - Current tag nesting depth (for limit checking)
   * @returns Parsed value and bytes consumed
   */
  const parseItem = (buffer: Uint8Array, offset: number, options?: ParseOptions, tagDepth: number = 0): ParseResult => {
    if (offset >= buffer.length) {
      throw new Error(`Unexpected end of buffer at offset ${offset}`)
    }

    const initialByte = readByte(buffer, offset)
    const { majorType, additionalInfo } = extractCborHeader(initialByte)

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
        return parseArrayInternal(buffer, offset, options)

      case 5: // Map
        return parseMapInternal(buffer, offset, options)

      case 6: // Tag (recursive)
        return parseTagFromBuffer(buffer, offset, options, tagDepth)

      case 7: // Simple/Float
        {
          const simpleHex = Array.from(buffer.slice(offset))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')

          // Try to parse as simple value or float
          if (additionalInfo >= 25 && additionalInfo <= 27) {
            // Float16, Float32, Float64
            const result = parseFloat(simpleHex, options)
            return { value: result.value, bytesRead: result.bytesRead }
          } else {
            // Simple value (boolean, null, undefined, etc.)
            const result = parseSimple(simpleHex, options)
            return { value: result.value, bytesRead: result.bytesRead }
          }
        }

      default:
        throw new Error(`Unknown major type: ${majorType}`)
    }
  }

  /**
   * Internal array parser that uses the tag-aware parseItem
   */
  const parseArrayInternal = (buffer: Uint8Array, offset: number, options?: ParseOptions): ParseResult => {
    const initialByte = readByte(buffer, offset)
    const { majorType, additionalInfo } = extractCborHeader(initialByte)

    if (majorType !== 4) {
      throw new Error(`Expected major type 4 (array), got ${majorType}`)
    }

    // Parse length
    let length: number | null
    let bytesConsumed: number

    if (additionalInfo < 24) {
      length = additionalInfo
      bytesConsumed = 0
    } else if (additionalInfo === 24) {
      length = readByte(buffer, offset + 1)
      bytesConsumed = 1
    } else if (additionalInfo === 25) {
      length = readUint(buffer, offset + 1, 2)
      bytesConsumed = 2
    } else if (additionalInfo === 26) {
      length = readUint(buffer, offset + 1, 4)
      bytesConsumed = 4
    } else if (additionalInfo === 27) {
      const lengthBigInt = readBigUint(buffer, offset + 1, 8)
      if (lengthBigInt > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new Error(`Array length ${lengthBigInt} exceeds maximum safe integer`)
      }
      length = Number(lengthBigInt)
      bytesConsumed = 8
    } else if (additionalInfo === 31) {
      length = null // Indefinite
      bytesConsumed = 0
    } else {
      throw new Error(`Invalid additional info for array: ${additionalInfo}`)
    }

    let currentOffset = offset + 1 + bytesConsumed
    const items: CborValue[] = []

    if (length === null) {
      // Indefinite-length array
      while (currentOffset < buffer.length) {
        const nextByte = readByte(buffer, currentOffset)
        if (nextByte === 0xff) {
          currentOffset++
          break
        }
        const itemResult = parseItem(buffer, currentOffset, options)
        items.push(itemResult.value)
        currentOffset += itemResult.bytesRead
      }

      // Mark as indefinite-length for round-trip preservation
      ;(items as any)[INDEFINITE_SYMBOL] = true
    } else {
      // Definite-length array
      for (let i = 0; i < length; i++) {
        const itemResult = parseItem(buffer, currentOffset, options)
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
   * Internal map parser that uses the tag-aware parseItem
   */
  const parseMapInternal = (buffer: Uint8Array, offset: number, options?: ParseOptions): ParseResult => {
    const initialByte = readByte(buffer, offset)
    const { majorType, additionalInfo } = extractCborHeader(initialByte)

    if (majorType !== 5) {
      throw new Error(`Expected major type 5 (map), got ${majorType}`)
    }

    // Parse length
    let length: number | null
    let bytesConsumed: number

    if (additionalInfo < 24) {
      length = additionalInfo
      bytesConsumed = 0
    } else if (additionalInfo === 24) {
      length = readByte(buffer, offset + 1)
      bytesConsumed = 1
    } else if (additionalInfo === 25) {
      length = readUint(buffer, offset + 1, 2)
      bytesConsumed = 2
    } else if (additionalInfo === 26) {
      length = readUint(buffer, offset + 1, 4)
      bytesConsumed = 4
    } else if (additionalInfo === 27) {
      const lengthBigInt = readBigUint(buffer, offset + 1, 8)
      if (lengthBigInt > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new Error(`Map length ${lengthBigInt} exceeds maximum safe integer`)
      }
      length = Number(lengthBigInt)
      bytesConsumed = 8
    } else if (additionalInfo === 31) {
      length = null // Indefinite
      bytesConsumed = 0
    } else {
      throw new Error(`Invalid additional info for map: ${additionalInfo}`)
    }

    let currentOffset = offset + 1 + bytesConsumed
    const map: CborMap = new Map()

    if (length === null) {
      // Indefinite-length map
      while (currentOffset < buffer.length) {
        const nextByte = readByte(buffer, currentOffset)
        if (nextByte === 0xff) {
          currentOffset++
          break
        }
        const keyResult = parseItem(buffer, currentOffset, options)
        currentOffset += keyResult.bytesRead

        const valueResult = parseItem(buffer, currentOffset, options)
        currentOffset += valueResult.bytesRead

        // Store with original key type (not string!)
        map.set(keyResult.value, valueResult.value)
      }

      // Mark as indefinite-length for round-trip preservation
      ;(map as any)[INDEFINITE_SYMBOL] = true
    } else {
      // Definite-length map
      for (let i = 0; i < length; i++) {
        const keyResult = parseItem(buffer, currentOffset, options)
        currentOffset += keyResult.bytesRead

        const valueResult = parseItem(buffer, currentOffset, options)
        currentOffset += valueResult.bytesRead

        // Store with original key type (not string!)
        map.set(keyResult.value, valueResult.value)
      }
    }

    return {
      value: map,
      bytesRead: currentOffset - offset
    }
  }

  /**
   * Parses a tag number from the buffer
   *
   * @param buffer - Data buffer
   * @param offset - Current offset (at initial byte)
   * @param ai - Additional info field
   * @returns Tag number and bytes consumed for the tag number
   */
  const parseTagNumber = (
    buffer: Uint8Array,
    offset: number,
    ai: number
  ): { tagNumber: number, bytesConsumed: number } => {
    if (ai < 24) {
      // Direct encoding (tags 0-23)
      return { tagNumber: ai, bytesConsumed: 0 }
    } else if (ai === 24) {
      // 1 byte follows (tags 24-255)
      const tagNumber = readByte(buffer, offset)
      return { tagNumber, bytesConsumed: 1 }
    } else if (ai === 25) {
      // 2 bytes follow (tags 256-65535)
      const tagNumber = readUint(buffer, offset, 2)
      return { tagNumber, bytesConsumed: 2 }
    } else if (ai === 26) {
      // 4 bytes follow (tags 65536-4294967295)
      const tagNumber = readUint(buffer, offset, 4)
      return { tagNumber, bytesConsumed: 4 }
    } else if (ai === 27) {
      // 8 bytes follow (very large tag numbers)
      const tagBigInt = readBigUint(buffer, offset, 8)

      // Convert to number if it fits
      if (tagBigInt <= BigInt(Number.MAX_SAFE_INTEGER)) {
        return { tagNumber: Number(tagBigInt), bytesConsumed: 8 }
      } else {
        throw new Error(`Tag number ${tagBigInt} exceeds maximum safe integer`)
      }
    } else if (ai >= 28 && ai <= 30) {
      throw new Error(`Reserved additional info ${ai} for major type 6`)
    } else {
      throw new Error(`Invalid additional info ${ai} for tags`)
    }
  }

  /**
   * Validates semantic constraints for specific CBOR tags
   *
   * @param tagNumber - The tag number
   * @param value - The tagged value
   * @param options - Parser options
   * @throws Error if validation fails
   */
  /**
   * Validates RFC 3339 date/time string format
   */
  const isValidRfc3339 = (dateStr: string): boolean => {
    // RFC 3339 format: YYYY-MM-DDTHH:MM:SS[.fraction][Z|+/-HH:MM]
    const rfc3339Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/i
    return rfc3339Regex.test(dateStr)
  }

  /**
   * Validates URI format (basic check for scheme)
   */
  const isValidUri = (uri: string): boolean => {
    // Basic URI validation: must have scheme followed by colon
    // RFC 3986: scheme = ALPHA *( ALPHA / DIGIT / "+" / "-" / "." )
    const uriRegex = /^[a-zA-Z][a-zA-Z0-9+.-]*:/
    return uriRegex.test(uri)
  }

  /**
   * Checks if a value is a text string (CborTextString or plain string)
   */
  const isTextString = (value: CborValue): value is string => {
    if (typeof value === 'string') return true
    if (value && typeof value === 'object' && 'type' in value && (value as any).type === 'cbor-text-string') {
      return true
    }
    return false
  }

  /**
   * Gets string value from CborTextString or plain string
   */
  const getTextStringValue = (value: CborValue): string => {
    if (typeof value === 'string') return value
    if (value && typeof value === 'object' && 'text' in value) {
      return (value as any).text
    }
    return String(value)
  }

  const validateTagSemantics = (tagNumber: number, value: CborValue, options?: ParseOptions): void => {
    // Check different validation types separately
    // Standard tag semantics (Tags 0, 1, 4, 5, 32, 35, 36, 258)
    const shouldValidateStandard = options?.strict || options?.validateTagSemantics

    switch (tagNumber) {
      case 0: // Date/Time String (RFC 3339)
        if (!shouldValidateStandard) break

        if (!isTextString(value)) {
          throw new Error(`Tag 0 (date/time string) must contain a text string, got ${typeof value}`)
        }
        const dateStr = getTextStringValue(value)
        if (!isValidRfc3339(dateStr)) {
          throw new Error(`Tag 0 (date/time string) contains invalid RFC 3339 date format: "${dateStr}"`)
        }
        break

      case 1: // Epoch-Based Date/Time
        if (!shouldValidateStandard) break

        if (typeof value !== 'number' && typeof value !== 'bigint') {
          throw new Error(`Tag 1 (epoch time) must contain a number (integer or float), got ${typeof value}`)
        }
        break

      case 4: // Decimal Fraction
        if (!shouldValidateStandard) break

        if (!Array.isArray(value)) {
          throw new Error(`Tag 4 (decimal fraction) must contain an array, got ${typeof value}`)
        }
        if (value.length !== 2) {
          throw new Error(`Tag 4 (decimal fraction) array must have exactly 2 elements [exponent, mantissa], got ${value.length}`)
        }
        if (typeof value[0] !== 'number' && typeof value[0] !== 'bigint') {
          throw new Error(`Tag 4 (decimal fraction) exponent must be an integer, got ${typeof value[0]}`)
        }
        if (typeof value[1] !== 'number' && typeof value[1] !== 'bigint') {
          throw new Error(`Tag 4 (decimal fraction) mantissa must be an integer, got ${typeof value[1]}`)
        }
        break

      case 5: // Bigfloat
        if (!shouldValidateStandard) break

        if (!Array.isArray(value)) {
          throw new Error(`Tag 5 (bigfloat) must contain an array, got ${typeof value}`)
        }
        if (value.length !== 2) {
          throw new Error(`Tag 5 (bigfloat) array must have exactly 2 elements [exponent, mantissa], got ${value.length}`)
        }
        if (typeof value[0] !== 'number' && typeof value[0] !== 'bigint') {
          throw new Error(`Tag 5 (bigfloat) exponent must be an integer, got ${typeof value[0]}`)
        }
        if (typeof value[1] !== 'number' && typeof value[1] !== 'bigint') {
          throw new Error(`Tag 5 (bigfloat) mantissa must be an integer, got ${typeof value[1]}`)
        }
        break

      case 32: // URI (RFC 3986)
        if (!shouldValidateStandard) break

        if (!isTextString(value)) {
          throw new Error(`Tag 32 (URI) must contain a text string, got ${typeof value}`)
        }
        const uriStr = getTextStringValue(value)
        if (!isValidUri(uriStr)) {
          throw new Error(`Tag 32 (URI) contains invalid URI format (missing scheme): "${uriStr}"`)
        }
        break

      case 33: // base64url without padding
      case 34: // base64 without padding
        if (!shouldValidateStandard) break

        if (!isTextString(value)) {
          throw new Error(`Tag ${tagNumber} (base64${tagNumber === 33 ? 'url' : ''}) must contain a text string, got ${typeof value}`)
        }
        break

      case 35: // Regular Expression
        if (!shouldValidateStandard) break

        if (!isTextString(value)) {
          throw new Error(`Tag 35 (regexp) must contain a text string, got ${typeof value}`)
        }
        break

      case 36: // MIME Message
        if (!shouldValidateStandard) break

        if (!isTextString(value)) {
          throw new Error(`Tag 36 (MIME message) must contain a text string, got ${typeof value}`)
        }
        break

      case 258: // Mathematical Finite Set
        {
          // Validate set uniqueness if enabled
          const shouldValidateUniqueness = options?.strict || options?.validateSetUniqueness

          if (shouldValidateUniqueness) {
            if (!Array.isArray(value)) {
              throw new Error(`Tag 258 (set) must contain an array, got ${typeof value}`)
            }

            if (hasDuplicates(value)) {
              throw new Error(
                `Tag 258 (set) contains duplicate items. ` +
                `Sets must contain only unique values (RFC 8949). ` +
                `Use validateSetUniqueness: false to allow duplicates.`
              )
            }
          }
        }
        break

      // Plutus Constructor tags
      case 102: // Alternative Plutus Constructor
        validatePlutusAlternativeConstructor(value, options)
        break

      // No validation needed for other tags (yet)
      default:
        // Plutus Compact Constructors (121-127)
        if (tagNumber >= 121 && tagNumber <= 127) {
          validatePlutusCompactConstructor(tagNumber, value, options)
        }
        // Plutus Extended Constructors (1280-1400)
        else if (tagNumber >= 1280 && tagNumber <= 1400) {
          validatePlutusExtendedConstructor(tagNumber, value, options)
        }
        break
    }
  }

  /**
   * Validates Plutus compact constructor (Tags 121-127)
   *
   * @param tagNumber - Tag number (121-127)
   * @param value - Tagged value (should be array)
   * @param options - Parser options
   */
  const validatePlutusCompactConstructor = (tagNumber: number, value: CborValue, options?: ParseOptions): void => {
    const shouldValidate = options?.strict || options?.validatePlutusSemantics

    if (!shouldValidate) {
      return
    }

    if (!Array.isArray(value)) {
      throw new Error(
        `Plutus constructor tag ${tagNumber} must contain an array, got ${typeof value}`
      )
    }

    // Tags 121-127 encode constructor index 0-6
    // Per Cardano CDDL: constr<tag> = #6.tag([* any])
    // The tag number encodes the constructor index, NOT the arity
    // Any number of fields (0 or more) is valid
  }

  /**
   * Validates Plutus alternative constructor (Tag 102)
   *
   * @param value - Tagged value (should be [uint, array])
   * @param options - Parser options
   */
  const validatePlutusAlternativeConstructor = (value: CborValue, options?: ParseOptions): void => {
    const shouldValidate = options?.strict || options?.validatePlutusSemantics

    if (!shouldValidate) {
      return
    }

    if (!Array.isArray(value)) {
      throw new Error(
        `Plutus alternative constructor (tag 102) must contain an array, got ${typeof value}`
      )
    }

    if (value.length !== 2) {
      throw new Error(
        `Plutus alternative constructor (tag 102) must be [constructor_index, fields], got array of length ${value.length}`
      )
    }

    const constructorIndex = value[0]
    const fields = value[1]

    if (typeof constructorIndex !== 'number' || constructorIndex < 0 || !Number.isInteger(constructorIndex)) {
      throw new Error(
        `Plutus constructor index must be non-negative integer, got ${typeof constructorIndex}`
      )
    }

    if (!Array.isArray(fields)) {
      throw new Error(
        `Plutus constructor fields must be an array, got ${typeof fields}`
      )
    }
  }

  /**
   * Validates Plutus extended constructor (Tags 1280-1400)
   *
   * @param tagNumber - Tag number (1280-1400)
   * @param value - Tagged value (should be array)
   * @param options - Parser options
   */
  const validatePlutusExtendedConstructor = (tagNumber: number, value: CborValue, options?: ParseOptions): void => {
    const shouldValidate = options?.strict || options?.validatePlutusSemantics

    if (!shouldValidate) {
      return
    }

    if (!Array.isArray(value)) {
      throw new Error(
        `Plutus constructor tag ${tagNumber} must contain an array, got ${typeof value}`
      )
    }

    const constructorIndex = (tagNumber - 1280) + 7

    // Extended constructors can have any number of fields (0 to unlimited)
    // Constructor index is 7-127
    if (constructorIndex < 7 || constructorIndex > 127) {
      throw new Error(
        `Plutus extended constructor tag ${tagNumber} produces invalid constructor index ${constructorIndex} ` +
        `(expected 7-127)`
      )
    }
  }

  /**
   * Decodes a Plutus constructor from a tag
   *
   * @param tagNumber - CBOR tag number
   * @param value - Tagged value
   * @returns PlutusConstr or null if not a Plutus constructor
   */
  const decodePlutusConstructor = (tagNumber: number, value: CborValue): PlutusConstr | null => {
    // Tag 102: Alternative constructor [index, fields]
    if (tagNumber === 102) {
      if (!Array.isArray(value) || value.length !== 2) {
        return null
      }
      const [constructorIndex, fields] = value
      if (typeof constructorIndex !== 'number' || !Array.isArray(fields)) {
        return null
      }
      return {
        constructor: constructorIndex,
        fields: fields as any[]
      }
    }

    // Tags 121-127: Compact constructors
    if (tagNumber >= 121 && tagNumber <= 127) {
      if (!Array.isArray(value)) {
        return null
      }
      const constructorIndex = tagNumber - 121
      return {
        constructor: constructorIndex,
        fields: value as any[]
      }
    }

    // Tags 1280-1400: Extended constructors
    if (tagNumber >= 1280 && tagNumber <= 1400) {
      if (!Array.isArray(value)) {
        return null
      }
      const constructorIndex = (tagNumber - 1280) + 7
      return {
        constructor: constructorIndex,
        fields: value as any[]
      }
    }

    return null
  }

  /**
   * Internal tag parser that works with buffers
   *
   * @param buffer - Data buffer
   * @param offset - Current offset
   * @param options - Parser options
   * @returns Parsed tagged value and bytes read
   */
  const parseTagFromBuffer = (buffer: Uint8Array, offset: number, options?: ParseOptions, tagDepth: number = 0): ParseResult => {
    const initialByte = readByte(buffer, offset)
    const { majorType, additionalInfo } = extractCborHeader(initialByte)

    if (majorType !== 6) {
      throw new Error(`Expected major type 6 (tag), got ${majorType}`)
    }

    // Check tag nesting depth limit (RUSTSEC-2019-0025 mitigation)
    const maxTagDepth = options?.limits?.maxTagDepth ?? 64
    if (tagDepth >= maxTagDepth) {
      throw new Error(`Tag nesting depth ${tagDepth} exceeds limit of ${maxTagDepth}`)
    }

    // Parse the tag number
    const { tagNumber, bytesConsumed } = parseTagNumber(buffer, offset + 1, additionalInfo)
    let currentOffset = offset + 1 + bytesConsumed

    // Parse the tagged value (recursively)
    if (currentOffset >= buffer.length) {
      throw new Error(`Unexpected end of buffer after tag ${tagNumber}`)
    }

    const valueResult = parseItem(buffer, currentOffset, options, tagDepth + 1)
    currentOffset += valueResult.bytesRead

    // Validate bignum size limits for tags 2 and 3 (CVE-2020-28491 mitigation)
    if ((tagNumber === 2 || tagNumber === 3) && valueResult.value instanceof Uint8Array) {
      const maxBignumBytes = options?.limits?.maxBignumBytes ?? 1024
      if (valueResult.value.length > maxBignumBytes) {
        throw new Error(
          `Bignum (tag ${tagNumber}) size ${valueResult.value.length} bytes exceeds limit of ${maxBignumBytes} bytes`
        )
      }

      // Convert bignum bytes to BigInt, then to decimal string
      // This provides the expected format for test compatibility
      const bytes = valueResult.value
      let bigintValue = 0n

      // Convert bytes to BigInt (big-endian)
      for (let i = 0; i < bytes.length; i++) {
        bigintValue = (bigintValue << 8n) | BigInt(bytes[i]!)
      }

      // Tag 2: Positive bignum - return as decimal string
      // Tag 3: Negative bignum - apply formula: -1 - n
      if (tagNumber === 2) {
        valueResult.value = bigintValue
      } else if (tagNumber === 3) {
        valueResult.value = -1n - bigintValue
      }
    }

    // Validate semantic constraints for specific tags
    validateTagSemantics(tagNumber, valueResult.value, options)

    // Decode Plutus constructor if applicable
    const plutusConstr = decodePlutusConstructor(tagNumber, valueResult.value)

    const taggedValue: TaggedValue = {
      tag: tagNumber,
      value: valueResult.value,
      ...(plutusConstr && { plutus: plutusConstr })
    }

    return {
      value: taggedValue,
      bytesRead: currentOffset - offset
    }
  }

  /**
   * Parses CBOR tag (Major Type 6) from hex string
   *
   * @param hexString - CBOR hex string
   * @param options - Parser options (optional)
   * @returns Parsed tagged value and bytes read
   */
  const parseTag = (hexString: string, options?: ParseOptions): ParseResult => {
    // Remove spaces from hex string
    const cleanHex = hexString.replace(/\s+/g, '')
    const buffer = hexToBytes(cleanHex)
    return parseTagFromBuffer(buffer, 0, options)
  }

  /**
   * Alias for parseTag (for consistency with other composables)
   */
  const parse = parseTag

  return {
    parseTag,
    parse
  }
}
