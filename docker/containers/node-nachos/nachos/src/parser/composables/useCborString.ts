/**
 * CBOR String Parser Composable
 * Handles Major Types 2 (Byte Strings) and 3 (Text Strings)
 * Supports definite and indefinite length encoding
 */

import type { ParseResult, ParseOptions } from '../types'
import { hexToBytes, readByte, readUint, readBigUint, extractCborHeader, validateUtf8Strict } from '../utils'
import { useCborByteString, useCborTextString } from './useCborStringTypes'

/**
 * Composable for parsing CBOR strings (Major Types 2 and 3)
 * 
 * @returns Object with string parsing functions
 * 
 * @example
 * ```ts
 * const { parseString } = useCborString()
 * const result = parseString('6449455446') // "IETF"
 * ```
 */
export function useCborString() {
  const { create: createByteString } = useCborByteString()
  const { create: createTextString } = useCborTextString()

  /**
   * Parses the length from CBOR additional info field
   *
   * @param buffer - Data buffer
   * @param offset - Current offset (after initial byte)
   * @param ai - Additional info field (0-31)
   * @returns Object with length and bytes consumed
   */
  const parseLength = (buffer: Uint8Array, offset: number, ai: number, options?: ParseOptions): { length: number; bytesConsumed: number } => {
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
      // 8 bytes follow - rare for strings, but supported
      const lengthBigInt = readBigUint(buffer, offset, 8)

      // Check if value fits in safe integer range
      if (lengthBigInt > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new Error(`String length ${lengthBigInt} exceeds maximum safe integer`)
      }
      const length = Number(lengthBigInt)

      // RFC 8949 Section 4.2.1: Value must be >= 2^32 to justify 8-byte encoding
      if (options?.validateCanonical && length < 4294967296) {
        throw new Error(`Non-canonical length encoding: ${length} should use shorter encoding, not AI=27`)
      }

      return { length, bytesConsumed: 8 }
    } else if (ai === 31) {
      // Indefinite length (break-terminated) - special marker
      return { length: -1, bytesConsumed: 0 }
    } else {
      throw new Error(`Invalid additional info: ${ai}`)
    }
  }

  /**
   * Parses CBOR byte string (Major Type 2)
   *
   * @param buffer - Data buffer
   * @param offset - Current offset
   * @param options - Parser options (optional)
   * @returns Parsed byte array and bytes read
   */
  const parseByteString = (buffer: Uint8Array, offset: number = 0, options?: ParseOptions): ParseResult => {
    const initialByte = readByte(buffer, offset)
    const { majorType, additionalInfo } = extractCborHeader(initialByte)

    if (majorType !== 2) {
      throw new Error(`Expected major type 2 (byte string), got ${majorType}`)
    }

    // Check if indefinite length is allowed
    if (additionalInfo === 31 && options?.allowIndefinite === false) {
      throw new Error('Indefinite-length encoding is not allowed in strict mode')
    }

    // Parse the length
    const { length, bytesConsumed } = parseLength(buffer, offset + 1, additionalInfo, options)

    // Handle indefinite-length byte string
    if (length === -1) {
      const chunks: Uint8Array[] = []
      let currentOffset = offset + 1 + bytesConsumed
      let totalLength = 0

      while (currentOffset < buffer.length) {
        // Peek at next byte to check for break marker
        if (currentOffset >= buffer.length) {
          throw new Error(`Incomplete indefinite byte string: missing break marker`)
        }

        const nextByte = buffer[currentOffset]

        // Check for break marker (0xff)
        if (nextByte === 0xff) {
          currentOffset++ // Consume break byte
          break
        }

        // Parse chunk (must be definite-length byte string)
        // Use try-catch to provide better error context for indefinite strings
        let chunkResult
        try {
          chunkResult = parseByteString(buffer, currentOffset, options)
        } catch (error) {
          throw new Error(`Error parsing indefinite byte string chunk at offset ${currentOffset}: ${(error as Error).message}`)
        }

        // Validate chunk is a byte string
        if (!(chunkResult.value instanceof Uint8Array)) {
          throw new Error('Indefinite byte string must contain only byte string chunks')
        }

        chunks.push(chunkResult.value)
        totalLength += chunkResult.value.length
        currentOffset += chunkResult.bytesRead

        // Check length limit during accumulation
        if (options?.limits?.maxStringLength && totalLength > options.limits.maxStringLength) {
          throw new Error(`Byte string length ${totalLength} exceeds limit of ${options.limits.maxStringLength} bytes`)
        }
      }

      // Concatenate all chunks
      const bytes = new Uint8Array(totalLength)
      let destOffset = 0
      for (const chunk of chunks) {
        bytes.set(chunk, destOffset)
        destOffset += chunk.length
      }

      // Return CborByteString with indefinite marker and original chunks
      return {
        value: createByteString(bytes, true, chunks),
        bytesRead: currentOffset - offset
      }
    }

    // Definite-length byte string
    // Check length limit before allocating
    if (options?.limits?.maxStringLength && length > options.limits.maxStringLength) {
      throw new Error(`Byte string length ${length} exceeds limit of ${options.limits.maxStringLength} bytes`)
    }

    const payloadOffset = offset + 1 + bytesConsumed

    // Validate buffer has enough bytes
    if (payloadOffset + length > buffer.length) {
      throw new Error(`Insufficient data: expected ${length} bytes at offset ${payloadOffset}, but only ${buffer.length - payloadOffset} bytes available`)
    }

    const payload = buffer.slice(payloadOffset, payloadOffset + length)

    return {
      value: payload,
      bytesRead: 1 + bytesConsumed + length
    }
  }

  /**
   * Parses CBOR text string (Major Type 3)
   *
   * @param buffer - Data buffer
   * @param offset - Current offset
   * @param options - Parser options (optional)
   * @returns Parsed text string and bytes read
   */
  const parseTextString = (buffer: Uint8Array, offset: number = 0, options?: ParseOptions): ParseResult => {
    const initialByte = readByte(buffer, offset)
    const { majorType, additionalInfo } = extractCborHeader(initialByte)

    if (majorType !== 3) {
      throw new Error(`Expected major type 3 (text string), got ${majorType}`)
    }

    // Check if indefinite length is allowed
    if (additionalInfo === 31 && options?.allowIndefinite === false) {
      throw new Error('Indefinite-length encoding is not allowed in strict mode')
    }

    // Parse the length
    const { length, bytesConsumed } = parseLength(buffer, offset + 1, additionalInfo, options)

    // Handle indefinite-length text string
    if (length === -1) {
      const chunks: string[] = []
      let currentOffset = offset + 1 + bytesConsumed
      let totalLength = 0

      while (currentOffset < buffer.length) {
        // Peek at next byte to check for break marker
        if (currentOffset >= buffer.length) {
          throw new Error(`Incomplete indefinite text string: missing break marker`)
        }

        const nextByte = buffer[currentOffset]

        // Check for break marker (0xff)
        if (nextByte === 0xff) {
          currentOffset++ // Consume break byte
          break
        }

        // Parse chunk (must be definite-length text string)
        // Use try-catch to provide better error context for indefinite strings
        let chunkResult
        try {
          chunkResult = parseTextString(buffer, currentOffset, options)
        } catch (error) {
          throw new Error(`Error parsing indefinite text string chunk at offset ${currentOffset}: ${(error as Error).message}`)
        }

        // Validate chunk is a text string
        if (typeof chunkResult.value !== 'string') {
          throw new Error('Indefinite text string must contain only text string chunks')
        }

        chunks.push(chunkResult.value)
        totalLength += chunkResult.value.length
        currentOffset += chunkResult.bytesRead

        // Check length limit during accumulation
        if (options?.limits?.maxStringLength && totalLength > options.limits.maxStringLength) {
          throw new Error(`Text string length ${totalLength} exceeds limit of ${options.limits.maxStringLength} characters`)
        }
      }

      // Concatenate all chunks
      const text = chunks.join('')

      // Return CborTextString with indefinite marker and original chunks
      return {
        value: createTextString(text, true, chunks),
        bytesRead: currentOffset - offset
      }
    }

    // Definite-length text string
    // Check length limit before allocating
    if (options?.limits?.maxStringLength && length > options.limits.maxStringLength) {
      throw new Error(`Text string length ${length} bytes exceeds limit of ${options.limits.maxStringLength} bytes`)
    }

    const payloadOffset = offset + 1 + bytesConsumed

    // Validate buffer has enough bytes
    if (payloadOffset + length > buffer.length) {
      throw new Error(`Insufficient data: expected ${length} bytes at offset ${payloadOffset}, but only ${buffer.length - payloadOffset} bytes available`)
    }

    const payload = buffer.slice(payloadOffset, payloadOffset + length)

    // Validate UTF-8 if strict validation is enabled
    if (options?.validateUtf8Strict) {
      validateUtf8Strict(payload)
    }

    // Decode UTF-8 bytes to string
    const decoder = new TextDecoder('utf-8')
    const text = decoder.decode(payload)

    return {
      value: text,
      bytesRead: 1 + bytesConsumed + length
    }
  }

  /**
   * Parses CBOR string (auto-detects byte or text string)
   *
   * @param hexString - CBOR hex string
   * @param options - Parser options (optional)
   * @returns Parsed string (Uint8Array for MT 2, string for MT 3) and bytes read
   */
  const parseString = (hexString: string, options?: ParseOptions): ParseResult => {
    const buffer = hexToBytes(hexString)
    const initialByte = readByte(buffer, 0)
    const { majorType } = extractCborHeader(initialByte)

    if (majorType === 2) {
      return parseByteString(buffer, 0, options)
    } else if (majorType === 3) {
      return parseTextString(buffer, 0, options)
    } else {
      throw new Error(`Expected major type 2 or 3 (string), got ${majorType}`)
    }
  }

  return {
    parseString,
    parseByteString,
    parseTextString
  }
}
