/**
 * CBOR Main Parser Composable
 * Orchestrates all CBOR parsers and provides a unified parse interface
 * Auto-detects major type and dispatches to appropriate parser
 */

import type { ParseResult, ParseResultWithMap, SourceMapEntry, ParseOptions, CborContext, CborValue } from '../types'
import { DEFAULT_OPTIONS, DEFAULT_LIMITS } from '../types'
import { hexToBytes, readByte, readUint, readBigUint, extractCborHeader } from '../utils'
import { useCborInteger } from './useCborInteger'
import { useCborString } from './useCborString'
import { useCborCollection } from './useCborCollection'
import { useCborTag } from './useCborTag'
import { useCborFloat } from './useCborFloat'
import { logger } from '../../utils/logger'

/**
 * Main CBOR parser composable
 * Provides a unified interface for parsing any CBOR data
 *
 * @returns Object with parse function
 *
 * @example
 * ```ts
 * const { parse } = useCborParser()
 * const result = parse('1864') // { value: 100, bytesRead: 2 }
 * ```
 */
export function useCborParser() {
  /**
   * Merges user options with defaults
   */
  const mergeOptions = (options?: ParseOptions): Required<ParseOptions> => {
    if (!options) return DEFAULT_OPTIONS

    // Determine if canonical validation is enabled
    const isCanonical = options.validateCanonical ?? (options.strict ? true : false)

    return {
      strict: options.strict ?? DEFAULT_OPTIONS.strict,
      validateCanonical: isCanonical,
      // RFC 8949 Section 4.2: Deterministic encoding MUST NOT use indefinite-length
      allowIndefinite: options.allowIndefinite ?? (isCanonical || options.strict ? false : DEFAULT_OPTIONS.allowIndefinite),
      // Auto-enable duplicate key rejection for canonical or strict mode
      dupMapKeyMode: options.dupMapKeyMode ?? (isCanonical || options.strict ? 'reject' : DEFAULT_OPTIONS.dupMapKeyMode),
      validateUtf8Strict: options.validateUtf8Strict ?? (options.strict ? true : DEFAULT_OPTIONS.validateUtf8Strict),
      validateSetUniqueness: options.validateSetUniqueness ?? (options.strict ? true : DEFAULT_OPTIONS.validateSetUniqueness),
      validateTagSemantics: options.validateTagSemantics ?? (options.strict ? true : DEFAULT_OPTIONS.validateTagSemantics),
      validatePlutusSemantics: options.validatePlutusSemantics ?? (options.strict ? true : DEFAULT_OPTIONS.validatePlutusSemantics),
      limits: {
        maxInputSize: options.limits?.maxInputSize ?? DEFAULT_LIMITS.maxInputSize,
        maxOutputSize: options.limits?.maxOutputSize ?? DEFAULT_LIMITS.maxOutputSize,
        maxStringLength: options.limits?.maxStringLength ?? DEFAULT_LIMITS.maxStringLength,
        maxArrayLength: options.limits?.maxArrayLength ?? DEFAULT_LIMITS.maxArrayLength,
        maxMapSize: options.limits?.maxMapSize ?? DEFAULT_LIMITS.maxMapSize,
        maxDepth: options.limits?.maxDepth ?? DEFAULT_LIMITS.maxDepth,
        maxTagDepth: options.limits?.maxTagDepth ?? DEFAULT_LIMITS.maxTagDepth,
        maxBignumBytes: options.limits?.maxBignumBytes ?? DEFAULT_LIMITS.maxBignumBytes,
        maxParseTime: options.limits?.maxParseTime ?? DEFAULT_LIMITS.maxParseTime
      }
    }
  }

  /**
   * Checks if max parse time has been exceeded
   */
  const checkTimeout = (ctx: CborContext): void => {
    if (!ctx.startTime || !ctx.options?.limits?.maxParseTime) return

    const elapsed = Date.now() - ctx.startTime
    if (elapsed > ctx.options.limits.maxParseTime) {
      throw new Error(`Parse timeout: exceeded ${ctx.options.limits.maxParseTime}ms limit (elapsed: ${elapsed}ms)`)
    }
  }

  const { parseInteger } = useCborInteger()
  const { parseString } = useCborString()
  const { parseArray, parseMap } = useCborCollection()
  const { parseTag } = useCborTag()
  const { parse: parseFloatOrSimple } = useCborFloat()

  /**
   * Parses a CBOR hex string, auto-detecting the type
   *
   * @param hexString - CBOR data as hex string
   * @param options - Parser options (optional)
   * @returns Parsed value and bytes read
   *
   * @example
   * ```ts
   * parse('00')              // 0
   * parse('6449455446')      // "IETF"
   * parse('83010203')        // [1, 2, 3]
   * parse('a16161 01')       // { a: 1 }
   * parse('c11a514b67b0')    // { tag: 1, value: 1363896240 }
   * parse('f5')              // true
   *
   * // With options
   * parse('1864', { validateCanonical: true })
   * parse('6449455446', { strict: true })
   * ```
   */
  const parse = (hexString: string, options?: ParseOptions): ParseResult => {
    // Remove spaces from hex string
    const cleanHex = hexString.replace(/\s+/g, '')

    // Validate hex string
    if (!cleanHex || cleanHex.length === 0) {
      throw new Error('Empty hex string')
    }

    if (cleanHex.length % 2 !== 0) {
      throw new Error('Hex string must have even length')
    }

    if (!/^[0-9a-fA-F]+$/.test(cleanHex)) {
      throw new Error(`Invalid hex character in: ${cleanHex}`)
    }

    // Merge options with defaults
    const mergedOptions = mergeOptions(options)

    // Check input size limit
    const inputSize = cleanHex.length / 2 // Convert hex chars to bytes
    if (mergedOptions.limits?.maxInputSize && inputSize > mergedOptions.limits.maxInputSize) {
      throw new Error(`Input size ${inputSize} bytes exceeds limit of ${mergedOptions.limits.maxInputSize} bytes`)
    }

    // Convert to buffer and extract major type
    const buffer = hexToBytes(cleanHex)
    const initialByte = readByte(buffer, 0)
    const { majorType } = extractCborHeader(initialByte)

    // Dispatch to appropriate parser based on major type
    switch (majorType) {
      case 0: // Unsigned integer
      case 1: // Negative integer
        return parseInteger(cleanHex, mergedOptions)

      case 2: // Byte string
      case 3: // Text string
        return parseString(cleanHex, mergedOptions)

      case 4: // Array
        return parseArray(cleanHex, mergedOptions)

      case 5: // Map
        return parseMap(cleanHex, mergedOptions)

      case 6: // Tagged value
        return parseTag(cleanHex, mergedOptions)

      case 7: // Floating-point or simple value
        return parseFloatOrSimple(cleanHex, mergedOptions)

      default:
        throw new Error(`Unknown major type: ${majorType}`)
    }
  }

  /**
   * Parses CBOR with source map generation for visualization
   *
   * @param hexString - CBOR data as hex string
   * @param options - Parser options (optional)
   * @returns Parsed value, bytes read, and source map
   */
  const parseWithSourceMap = (hexString: string, options?: ParseOptions): ParseResultWithMap => {
    const cleanHex = hexString.replace(/\s+/g, '')

    // Validate hex string
    if (!cleanHex || cleanHex.length === 0) {
      throw new Error('Empty hex string')
    }
    if (cleanHex.length % 2 !== 0) {
      throw new Error('Hex string must have even length')
    }
    if (!/^[0-9a-fA-F]+$/.test(cleanHex)) {
      throw new Error(`Invalid hex character in: ${cleanHex}`)
    }

    // Merge options with defaults
    const mergedOptions = mergeOptions(options)

    // Check input size limit
    const inputSize = cleanHex.length / 2
    if (mergedOptions.limits?.maxInputSize && inputSize > mergedOptions.limits.maxInputSize) {
      throw new Error(`Input size ${inputSize} bytes exceeds limit of ${mergedOptions.limits.maxInputSize} bytes`)
    }

    const buffer = hexToBytes(cleanHex)
    const sourceMap: SourceMapEntry[] = []

    // Create context with tracking
    const ctx: CborContext = {
      buffer,
      offset: 0,
      sourceMap,
      currentDepth: 0,
      startTime: Date.now(),
      bytesAllocated: 0,
      options: mergedOptions
    }

    // Parse with source map tracking
    const result = parseValueWithMap(ctx, 0, '', sourceMap)

    return {
      value: result.value,
      bytesRead: result.bytesRead,
      sourceMap
    }
  }

  /**
   * Internal recursive parser that builds source map
   */
  const parseValueWithMap = (
    ctx: CborContext,
    offset: number,
    path: string,
    sourceMap: SourceMapEntry[]
  ): ParseResult => {
    // Check timeout periodically
    checkTimeout(ctx)

    const initialByte = readByte(ctx.buffer, offset)
    const { majorType, additionalInfo } = extractCborHeader(initialByte)
    const startOffset = offset

    let result: ParseResult
    let typeDescription: string

    switch (majorType) {
      case 0: // Unsigned integer
        typeDescription = 'Unsigned Integer'
        result = parseIntegerFromBuffer(ctx.buffer, offset, ctx.options)
        // Add entry for simple values
        sourceMap.push({
          path,
          start: startOffset,
          end: startOffset + result.bytesRead,
          majorType,
          type: typeDescription
        })
        break

      case 1: // Negative integer
        typeDescription = 'Negative Integer'
        result = parseIntegerFromBuffer(ctx.buffer, offset, ctx.options)
        sourceMap.push({
          path,
          start: startOffset,
          end: startOffset + result.bytesRead,
          majorType,
          type: typeDescription
        })
        break

      case 2: // Byte string
        {
          result = parseStringFromBuffer(ctx.buffer, offset, ctx.options)
          // Track bytes allocated
          if (ctx.bytesAllocated !== undefined && result.value instanceof Uint8Array) {
            ctx.bytesAllocated += result.value.length
            if (ctx.options?.limits?.maxOutputSize && ctx.bytesAllocated > ctx.options.limits.maxOutputSize) {
              throw new Error(`Output size ${ctx.bytesAllocated} bytes exceeds limit of ${ctx.options.limits.maxOutputSize} bytes`)
            }
          }

          // Calculate header length (type byte + length encoding)
          const headerBytes = additionalInfo < 24 ? 1 :
                             additionalInfo === 24 ? 2 :
                             additionalInfo === 25 ? 3 :
                             additionalInfo === 26 ? 5 :
                             additionalInfo === 27 ? 9 : 1
          const headerEnd = startOffset + headerBytes
          const contentLength = result.value instanceof Uint8Array ? result.value.length : 0

          // Add header entry
          typeDescription = `bytes(${contentLength})`
          sourceMap.push({
            path,
            start: startOffset,
            end: headerEnd,
            majorType,
            type: typeDescription,
            isHeader: true,
            headerEnd,
            contentPath: contentLength > 0 ? `${path}#content` : undefined,
            children: contentLength > 0 ? [`${path}#content`] : []
          })

          // Add content entry (if non-empty)
          if (contentLength > 0) {
            sourceMap.push({
              path: `${path}#content`,
              start: headerEnd,
              end: startOffset + result.bytesRead,
              majorType: 2,
              type: `→ ${contentLength} bytes`,
              isContent: true,
              parent: path
            })
          }
        }
        break

      case 3: // Text string
        {
          result = parseStringFromBuffer(ctx.buffer, offset, ctx.options)
          // Track bytes allocated
          if (ctx.bytesAllocated !== undefined && typeof result.value === 'string') {
            ctx.bytesAllocated += result.value.length
            if (ctx.options?.limits?.maxOutputSize && ctx.bytesAllocated > ctx.options.limits.maxOutputSize) {
              throw new Error(`Output size ${ctx.bytesAllocated} bytes exceeds limit of ${ctx.options.limits.maxOutputSize} bytes`)
            }
          }

          // Calculate header length (type byte + length encoding)
          const headerBytes = additionalInfo < 24 ? 1 :
                             additionalInfo === 24 ? 2 :
                             additionalInfo === 25 ? 3 :
                             additionalInfo === 26 ? 5 :
                             additionalInfo === 27 ? 9 : 1
          const headerEnd = startOffset + headerBytes
          const contentLength = typeof result.value === 'string' ? result.value.length : 0

          // Add header entry
          typeDescription = `text(${contentLength})`
          sourceMap.push({
            path,
            start: startOffset,
            end: headerEnd,
            majorType,
            type: typeDescription,
            isHeader: true,
            headerEnd,
            contentPath: contentLength > 0 ? `${path}#content` : undefined,
            children: contentLength > 0 ? [`${path}#content`] : []
          })

          // Add content entry (if non-empty)
          if (contentLength > 0) {
            sourceMap.push({
              path: `${path}#content`,
              start: headerEnd,
              end: startOffset + result.bytesRead,
              majorType: 3,
              type: `→ "${result.value}"`,
              isContent: true,
              parent: path
            })
          }
        }
        break

      case 4: // Array
        typeDescription = 'Array'
        // For arrays and maps, the recursive function handles source map entries
        result = parseArrayWithMap(ctx, offset, path, sourceMap)
        break

      case 5: // Map
        typeDescription = 'Map'
        result = parseMapWithMap(ctx, offset, path, sourceMap)
        break

      case 6: // Tag
        // parseTagWithMap handles source map creation internally (with parent/child relationships)
        result = parseTagWithMap(ctx, offset, path, sourceMap)
        break

      case 7: // Float/Simple
        typeDescription = getSimpleTypeDescription(additionalInfo)
        result = parseFloatFromBuffer(ctx.buffer, offset, ctx.options)
        sourceMap.push({
          path,
          start: startOffset,
          end: startOffset + result.bytesRead,
          majorType,
          type: typeDescription
        })
        break

      default:
        throw new Error(`Unknown major type: ${majorType}`)
    }

    return result
  }

  /**
   * Helper to parse integer from buffer
   */
  const parseIntegerFromBuffer = (buffer: Uint8Array, offset: number, options?: ParseOptions): ParseResult => {
    const hexString = Array.from(buffer.slice(offset))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
    return parseInteger(hexString, options)
  }

  /**
   * Helper to parse string from buffer
   */
  const parseStringFromBuffer = (buffer: Uint8Array, offset: number, options?: ParseOptions): ParseResult => {
    const hexString = Array.from(buffer.slice(offset))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
    return parseString(hexString, options)
  }

  /**
   * Helper to parse float from buffer
   */
  const parseFloatFromBuffer = (buffer: Uint8Array, offset: number, options?: ParseOptions): ParseResult => {
    const hexString = Array.from(buffer.slice(offset))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
    return parseFloatOrSimple(hexString, options)
  }

  /**
   * Parse array with source map tracking
   */
  const parseArrayWithMap = (
    ctx: CborContext,
    offset: number,
    path: string,
    sourceMap: SourceMapEntry[]
  ): ParseResult => {
    const startOffset = offset
    const initialByte = readByte(ctx.buffer, offset)
    const { additionalInfo } = extractCborHeader(initialByte)

    let currentOffset = offset + 1
    const items: any[] = []

    // Determine array length
    let length: number
    let isIndefinite = false

    if (additionalInfo < 24) {
      length = additionalInfo
    } else if (additionalInfo === 24) {
      length = readByte(ctx.buffer, currentOffset)
      currentOffset += 1
    } else if (additionalInfo === 25) {
      length = readUint(ctx.buffer, currentOffset, 2)
      currentOffset += 2
    } else if (additionalInfo === 26) {
      length = readUint(ctx.buffer, currentOffset, 4)
      currentOffset += 4
    } else if (additionalInfo === 27) {
      const bigLength = readBigUint(ctx.buffer, currentOffset, 8)
      if (bigLength > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new Error('Array length exceeds maximum safe integer')
      }
      length = Number(bigLength)
      currentOffset += 8
    } else if (additionalInfo === 31) {
      isIndefinite = true
      length = 0
    } else {
      throw new Error(`Invalid additional info: ${additionalInfo}`)
    }

    // Calculate header length (where content starts)
    const headerEnd = currentOffset

    // Add header entry for array
    const arrayEntryIndex = sourceMap.length
    sourceMap.push({
      path,
      start: startOffset,
      end: headerEnd,
      majorType: 4,
      type: isIndefinite ? 'array(indefinite)' : `array(${length})`,
      isHeader: true,
      headerEnd
    })

    // Parse array elements
    const childPaths: string[] = []
    if (isIndefinite) {
      let index = 0
      while (currentOffset < ctx.buffer.length) {
        const nextByte = readByte(ctx.buffer, currentOffset)
        if (nextByte === 0xff) {
          currentOffset++
          break
        }
        const elementPath = `${path}[${index}]`
        childPaths.push(elementPath)
        const entryIndex = sourceMap.length // Track where element entry will be added
        const elementResult = parseValueWithMap(ctx, currentOffset, elementPath, sourceMap)
        items.push(elementResult.value)
        currentOffset += elementResult.bytesRead

        // Mark element as child of this array (O(1) lookup by index)
        if (sourceMap[entryIndex]) {
          sourceMap[entryIndex].parent = path
        }

        index++
      }
    } else {
      for (let i = 0; i < length; i++) {
        const elementPath = `${path}[${i}]`
        childPaths.push(elementPath)
        const entryIndex = sourceMap.length // Track where element entry will be added
        const elementResult = parseValueWithMap(ctx, currentOffset, elementPath, sourceMap)
        items.push(elementResult.value)
        currentOffset += elementResult.bytesRead

        // Mark element as child of this array (O(1) lookup by index)
        if (sourceMap[entryIndex]) {
          sourceMap[entryIndex].parent = path
        }
      }
    }

    const bytesRead = currentOffset - offset

    // Only set children if array is non-empty
    if (childPaths.length > 0 && sourceMap[arrayEntryIndex]) {
      sourceMap[arrayEntryIndex].children = childPaths
    }

    return {
      value: items,
      bytesRead
    }
  }

  /**
   * Parse map with source map tracking
   */
  const parseMapWithMap = (
    ctx: CborContext,
    offset: number,
    path: string,
    sourceMap: SourceMapEntry[]
  ): ParseResult => {
    const startOffset = offset
    const initialByte = readByte(ctx.buffer, offset)
    const { additionalInfo } = extractCborHeader(initialByte)

    let currentOffset = offset + 1
    const map = new Map()

    // Determine map length
    let length: number
    let isIndefinite = false

    if (additionalInfo < 24) {
      length = additionalInfo
    } else if (additionalInfo === 24) {
      length = readByte(ctx.buffer, currentOffset)
      currentOffset += 1
    } else if (additionalInfo === 25) {
      length = readUint(ctx.buffer, currentOffset, 2)
      currentOffset += 2
    } else if (additionalInfo === 26) {
      length = readUint(ctx.buffer, currentOffset, 4)
      currentOffset += 4
    } else if (additionalInfo === 27) {
      const bigLength = readBigUint(ctx.buffer, currentOffset, 8)
      if (bigLength > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new Error('Map length exceeds maximum safe integer')
      }
      length = Number(bigLength)
      currentOffset += 8
    } else if (additionalInfo === 31) {
      isIndefinite = true
      length = 0
    } else {
      throw new Error(`Invalid additional info: ${additionalInfo}`)
    }

    // Calculate header length (where content starts)
    const headerEnd = currentOffset

    // Add header entry for map
    const mapEntryIndex = sourceMap.length
    sourceMap.push({
      path,
      start: startOffset,
      end: headerEnd,
      majorType: 5,
      type: isIndefinite ? 'map(indefinite)' : `map(${length})`,
      isHeader: true,
      headerEnd
    })

    // Parse map entries
    const childPaths: string[] = []
    const seenKeys = new Set<string>()

    if (isIndefinite) {
      while (currentOffset < ctx.buffer.length) {
        const nextByte = readByte(ctx.buffer, currentOffset)
        if (nextByte === 0xff) {
          currentOffset++
          break
        }

        // Parse key with path suffix to indicate it's a key
        const keyPath = `${path}${path ? '.' : ''}#key`
        const keyResult = parseValueWithMap(ctx, currentOffset, keyPath, sourceMap)
        currentOffset += keyResult.bytesRead

        // For duplicate detection and path generation, stringify the key
        const keyString = keyResult.value instanceof Uint8Array
          ? Array.from(keyResult.value).map(b => b.toString(16).padStart(2, '0')).join('')
          : String(keyResult.value)

        // Check for duplicate keys based on dupMapKeyMode
        if (seenKeys.has(keyString)) {
          const mode = ctx.options?.dupMapKeyMode || 'allow'
          if (mode === 'reject') {
            throw new Error(`Duplicate map key detected: ${keyString} at offset ${currentOffset}`)
          } else if (mode === 'warn') {
            logger.warn(`Duplicate map key detected: ${keyString} at offset ${currentOffset}`)
          }
        }
        seenKeys.add(keyString)

        // Parse value
        const valuePath = path ? `${path}.${keyString}` : `.${keyString}`
        childPaths.push(valuePath)
        const valueEntryIndex = sourceMap.length // Track where value entry will be added
        const valueResult = parseValueWithMap(ctx, currentOffset, valuePath, sourceMap)
        map.set(keyResult.value, valueResult.value)
        currentOffset += valueResult.bytesRead

        // Mark value entry as child of this map (O(1) lookup by index)
        if (sourceMap[valueEntryIndex]) {
          sourceMap[valueEntryIndex].parent = path
        }
      }
    } else {
      for (let i = 0; i < length; i++) {
        // Parse key with path suffix to indicate it's a key
        const keyPath = `${path}${path ? '.' : ''}#key${i}`
        const keyResult = parseValueWithMap(ctx, currentOffset, keyPath, sourceMap)
        currentOffset += keyResult.bytesRead

        // For duplicate detection and path generation, stringify the key
        const keyString = keyResult.value instanceof Uint8Array
          ? Array.from(keyResult.value).map(b => b.toString(16).padStart(2, '0')).join('')
          : String(keyResult.value)

        // Check for duplicate keys based on dupMapKeyMode
        if (seenKeys.has(keyString)) {
          const mode = ctx.options?.dupMapKeyMode || 'allow'
          if (mode === 'reject') {
            throw new Error(`Duplicate map key detected: ${keyString} at offset ${currentOffset}`)
          } else if (mode === 'warn') {
            logger.warn(`Duplicate map key detected: ${keyString} at offset ${currentOffset}`)
          }
        }
        seenKeys.add(keyString)

        // Parse value
        const valuePath = path ? `${path}.${keyString}` : `.${keyString}`
        childPaths.push(valuePath)
        const valueEntryIndex = sourceMap.length // Track where value entry will be added
        const valueResult = parseValueWithMap(ctx, currentOffset, valuePath, sourceMap)
        map.set(keyResult.value, valueResult.value)
        currentOffset += valueResult.bytesRead

        // Mark value entry as child of this map (O(1) lookup by index)
        if (sourceMap[valueEntryIndex]) {
          sourceMap[valueEntryIndex].parent = path
        }
      }
    }

    const bytesRead = currentOffset - offset

    // Set children for the map entry
    if (sourceMap[mapEntryIndex]) {
      sourceMap[mapEntryIndex].children = childPaths
    }

    return {
      value: map,
      bytesRead
    }
  }

  /**
   * Helper to parse tag number from buffer
   */
  const parseTagNumberHelper = (
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
   * Parse tag with source map tracking (RECURSIVE)
   * Creates source map entries for both the tag and its nested value
   */
  const parseTagWithMap = (
    ctx: CborContext,
    offset: number,
    path: string,
    sourceMap: SourceMapEntry[]
  ): ParseResult => {
    const startOffset = offset
    const initialByte = readByte(ctx.buffer, offset)
    const { additionalInfo } = extractCborHeader(initialByte)

    // Parse tag number
    const { tagNumber, bytesConsumed } = parseTagNumberHelper(
      ctx.buffer,
      offset + 1,
      additionalInfo
    )

    let currentOffset = offset + 1 + bytesConsumed
    const headerEnd = currentOffset

    // Add header entry for this tag
    const tagEntryIndex = sourceMap.length
    sourceMap.push({
      path,
      start: startOffset,
      end: headerEnd,
      majorType: 6,
      type: `tag(${tagNumber})`,
      isHeader: true,
      headerEnd,
      children: []
    })

    // Parse the tagged value WITH source map tracking (RECURSIVE CALL)
    const valuePath = `${path}.value`
    const valueEntryIndex = sourceMap.length // Track where value entry will be added
    const valueResult = parseValueWithMap(ctx, currentOffset, valuePath, sourceMap)
    currentOffset += valueResult.bytesRead

    // Set child path for the tag
    if (sourceMap[tagEntryIndex]) {
      sourceMap[tagEntryIndex].children = [valuePath]
    }

    // Mark value entry as child of this tag (O(1) lookup by index)
    if (sourceMap[valueEntryIndex]) {
      sourceMap[valueEntryIndex].parent = path
    }

    // Build TaggedValue object (call parseTag to get validation and plutus decoding)
    const hexString = Array.from(ctx.buffer.slice(startOffset, currentOffset))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
    const tagResult = parseTag(hexString, ctx.options)

    return {
      value: tagResult.value,
      bytesRead: currentOffset - startOffset
    }
  }

  /**
   * Get tag number for description
   * Note: Reserved for future tag description features
   */
  // const getTagNumber = (buffer: Uint8Array, offset: number): number => {
  //   const initialByte = readByte(buffer, offset)
  //   const { additionalInfo } = extractCborHeader(initialByte)
  //
  //   if (additionalInfo < 24) return additionalInfo
  //   if (additionalInfo === 24) return readByte(buffer, offset + 1)
  //   if (additionalInfo === 25) return readUint(buffer, offset + 1, 2)
  //   if (additionalInfo === 26) return readUint(buffer, offset + 1, 4)
  //   if (additionalInfo === 27) {
  //     const bigNum = readBigUint(buffer, offset + 1, 8)
  //     return bigNum <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(bigNum) : -1
  //   }
  //   return -1
  // }

  /**
   * Get simple type description
   */
  const getSimpleTypeDescription = (ai: number): string => {
    if (ai === 20) return 'Simple: false'
    if (ai === 21) return 'Simple: true'
    if (ai === 22) return 'Simple: null'
    if (ai === 23) return 'Simple: undefined'
    if (ai === 25) return 'Float16'
    if (ai === 26) return 'Float32'
    if (ai === 27) return 'Float64'
    if (ai < 20) return `Simple Value ${ai}`
    return 'Simple Value'
  }

  /**
   * Parses a CBOR Sequence (RFC 8742)
   * A CBOR sequence is a concatenation of zero or more CBOR data items
   *
   * @param hexString - CBOR sequence data as hex string
   * @param options - Parser options (optional)
   * @returns Array of parsed CBOR values
   *
   * @example
   * ```ts
   * const { parseSequence } = useCborParser()
   * parseSequence('010203')        // [1, 2, 3] - three separate integers
   * parseSequence('83010203 05')   // [[1,2,3], 5] - array followed by integer
   * parseSequence('')              // [] - empty sequence
   * ```
   */
  const parseSequence = (hexString: string, options?: ParseOptions): CborValue[] => {
    const cleanHex = hexString.replace(/\s+/g, '')

    // Empty sequence is valid
    if (!cleanHex || cleanHex.length === 0) {
      return []
    }

    if (cleanHex.length % 2 !== 0) {
      throw new Error('Hex string must have even length')
    }

    if (!/^[0-9a-fA-F]+$/.test(cleanHex)) {
      throw new Error(`Invalid hex character in: ${cleanHex}`)
    }

    const mergedOptions = mergeOptions(options)
    const buffer = hexToBytes(cleanHex)
    const results: CborValue[] = []
    let offset = 0

    while (offset < buffer.length) {
      // Check for break code outside indefinite context (invalid in sequence)
      const byte = readByte(buffer, offset)
      if (byte === 0xff) {
        throw new Error(`Unexpected break code (0xff) at offset ${offset} - not inside indefinite-length item`)
      }

      // Parse next item from remaining hex
      const remainingHex = Array.from(buffer.slice(offset))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')

      const result = parse(remainingHex, mergedOptions)
      results.push(result.value)
      offset += result.bytesRead
    }

    return results
  }

  /**
   * Parses a CBOR Sequence with source maps for each item
   *
   * @param hexString - CBOR sequence data as hex string
   * @param options - Parser options (optional)
   * @returns Object with values array and sourceMaps array
   */
  const parseSequenceWithSourceMap = (hexString: string, options?: ParseOptions): {
    values: CborValue[]
    sourceMaps: SourceMapEntry[][]
  } => {
    const cleanHex = hexString.replace(/\s+/g, '')

    if (!cleanHex || cleanHex.length === 0) {
      return { values: [], sourceMaps: [] }
    }

    if (cleanHex.length % 2 !== 0) {
      throw new Error('Hex string must have even length')
    }

    if (!/^[0-9a-fA-F]+$/.test(cleanHex)) {
      throw new Error(`Invalid hex character in: ${cleanHex}`)
    }

    const mergedOptions = mergeOptions(options)
    const buffer = hexToBytes(cleanHex)
    const values: CborValue[] = []
    const sourceMaps: SourceMapEntry[][] = []
    let offset = 0

    while (offset < buffer.length) {
      const byte = readByte(buffer, offset)
      if (byte === 0xff) {
        throw new Error(`Unexpected break code (0xff) at offset ${offset}`)
      }

      const remainingHex = Array.from(buffer.slice(offset))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')

      const result = parseWithSourceMap(remainingHex, mergedOptions)

      // Adjust source map offsets to account for sequence position
      const adjustedSourceMap = result.sourceMap.map(entry => ({
        ...entry,
        start: entry.start + offset,
        end: entry.end + offset
      }))

      values.push(result.value)
      sourceMaps.push(adjustedSourceMap)
      offset += result.bytesRead
    }

    return { values, sourceMaps }
  }

  return {
    parse,
    parseWithSourceMap,
    parseSequence,
    parseSequenceWithSourceMap
  }
}
