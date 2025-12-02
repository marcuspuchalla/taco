/**
 * Common utility functions for CBOR parsing
 */

/**
 * Converts hex string to Uint8Array
 *
 * @param hex - Hex string (e.g., "1864")
 * @returns Byte array
 */
export const hexToBytes = (hex: string): Uint8Array => {
  const bytes = hex.match(/.{1,2}/g)
  if (!bytes) return new Uint8Array(0)
  return new Uint8Array(bytes.map(byte => parseInt(byte, 16)))
}

/**
 * Converts Uint8Array to hex string
 *
 * @param bytes - Byte array
 * @returns Hex string (e.g., "1864")
 */
export const bytesToHex = (bytes: Uint8Array): string => {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Reads a single byte from buffer at offset
 * 
 * @param buffer - Data buffer
 * @param offset - Byte offset
 * @returns Byte value (0-255)
 */
export const readByte = (buffer: Uint8Array, offset: number): number => {
  if (offset >= buffer.length) {
    throw new Error(`Offset ${offset} is out of bounds (buffer length: ${buffer.length})`)
  }
  const byte = buffer[offset]
  if (byte === undefined) {
    throw new Error(`Unexpected undefined byte at offset ${offset}`)
  }
  return byte
}

/**
 * Reads unsigned integer of specified byte length (big-endian)
 * 
 * @param buffer - Data buffer
 * @param offset - Starting byte offset
 * @param length - Number of bytes to read (1-8)
 * @returns Integer value
 */
export const readUint = (buffer: Uint8Array, offset: number, length: number): number => {
  if (length < 1 || length > 8) {
    throw new Error(`Invalid length: ${length} (must be 1-8)`)
  }
  if (offset + length > buffer.length) {
    throw new Error(`Cannot read ${length} bytes at offset ${offset} (buffer length: ${buffer.length})`)
  }
  
  let result = 0
  for (let i = 0; i < length; i++) {
    result = result * 256 + readByte(buffer, offset + i)
  }
  return result
}

/**
 * Reads unsigned BigInt of specified byte length (big-endian)
 * 
 * @param buffer - Data buffer
 * @param offset - Starting byte offset
 * @param length - Number of bytes to read (1-8)
 * @returns BigInt value
 */
export const readBigUint = (buffer: Uint8Array, offset: number, length: number): bigint => {
  if (length < 1 || length > 8) {
    throw new Error(`Invalid length: ${length} (must be 1-8)`)
  }
  if (offset + length > buffer.length) {
    throw new Error(`Cannot read ${length} bytes at offset ${offset} (buffer length: ${buffer.length})`)
  }
  
  let result = 0n
  for (let i = 0; i < length; i++) {
    result = result * 256n + BigInt(readByte(buffer, offset + i))
  }
  return result
}

/**
 * Extracts major type and additional info from initial byte
 *
 * @param initialByte - First byte of CBOR item
 * @returns Object with majorType (0-7) and additionalInfo (0-31)
 */
export const extractCborHeader = (initialByte: number): { majorType: number; additionalInfo: number } => {
  return {
    majorType: initialByte >> 5,
    additionalInfo: initialByte & 0x1f
  }
}

/**
 * Strictly validate UTF-8 encoding
 *
 * Rejects:
 * - Overlong encodings (security vulnerability)
 * - Surrogate halves (U+D800-U+DFFF)
 * - Values beyond U+10FFFF
 * - Invalid start bytes (0xC0, 0xC1, 0xF5-0xFF)
 * - Incomplete sequences
 *
 * @param bytes - UTF-8 bytes to validate
 * @throws Error if validation fails
 */
export function validateUtf8Strict(bytes: Uint8Array): void {
  let i = 0

  while (i < bytes.length) {
    const byte = bytes[i]
    if (byte === undefined) {
      throw new Error(`Unexpected undefined byte at position ${i}`)
    }

    // Invalid start bytes
    if (byte === 0xC0 || byte === 0xC1 || byte >= 0xF5) {
      throw new Error(
        `Invalid UTF-8 start byte 0x${byte.toString(16).padStart(2, '0')} at position ${i}`
      )
    }

    // 1-byte sequence (ASCII: 0x00-0x7F)
    if (byte < 0x80) {
      i++
      continue
    }

    // 2-byte sequence (0xC2-0xDF)
    if (byte >= 0xC2 && byte <= 0xDF) {
      if (i + 1 >= bytes.length) {
        throw new Error(`Incomplete UTF-8 sequence at position ${i}`)
      }

      const byte2 = bytes[i + 1]
      if (byte2 === undefined) {
        throw new Error(`Incomplete UTF-8 sequence at position ${i}`)
      }
      if ((byte2 & 0xC0) !== 0x80) {
        throw new Error(`Invalid UTF-8 continuation byte at position ${i + 1}`)
      }

      // Check for overlong encoding
      const codepoint = ((byte & 0x1F) << 6) | (byte2 & 0x3F)
      if (codepoint < 0x80) {
        throw new Error(
          `Overlong UTF-8 encoding at position ${i}: ` +
          `U+${codepoint.toString(16).padStart(4, '0').toUpperCase()} ` +
          `encoded as 2 bytes (should be 1 byte)`
        )
      }

      i += 2
      continue
    }

    // 3-byte sequence (0xE0-0xEF)
    if (byte >= 0xE0 && byte <= 0xEF) {
      if (i + 2 >= bytes.length) {
        throw new Error(`Incomplete UTF-8 sequence at position ${i}`)
      }

      const byte2 = bytes[i + 1]
      const byte3 = bytes[i + 2]

      if (byte2 === undefined || byte3 === undefined) {
        throw new Error(`Incomplete UTF-8 sequence at position ${i}`)
      }

      if ((byte2 & 0xC0) !== 0x80 || (byte3 & 0xC0) !== 0x80) {
        throw new Error(
          `Invalid UTF-8 continuation byte at position ${i + 1} or ${i + 2}`
        )
      }

      const codepoint = ((byte & 0x0F) << 12) | ((byte2 & 0x3F) << 6) | (byte3 & 0x3F)

      // Check for overlong encoding
      if (codepoint < 0x800) {
        throw new Error(
          `Overlong UTF-8 encoding at position ${i}: ` +
          `U+${codepoint.toString(16).padStart(4, '0').toUpperCase()} ` +
          `encoded as 3 bytes (should be 2 bytes or less)`
        )
      }

      // Check for surrogate range (U+D800-U+DFFF are invalid)
      if (codepoint >= 0xD800 && codepoint <= 0xDFFF) {
        throw new Error(
          `Invalid UTF-8 surrogate codepoint U+${codepoint.toString(16).padStart(4, '0').toUpperCase()} ` +
          `at position ${i} (surrogates are not valid Unicode scalar values)`
        )
      }

      i += 3
      continue
    }

    // 4-byte sequence (0xF0-0xF4)
    if (byte >= 0xF0 && byte <= 0xF4) {
      if (i + 3 >= bytes.length) {
        throw new Error(`Incomplete UTF-8 sequence at position ${i}`)
      }

      const byte2 = bytes[i + 1]
      const byte3 = bytes[i + 2]
      const byte4 = bytes[i + 3]

      if (byte2 === undefined || byte3 === undefined || byte4 === undefined) {
        throw new Error(`Incomplete UTF-8 sequence at position ${i}`)
      }

      if ((byte2 & 0xC0) !== 0x80 || (byte3 & 0xC0) !== 0x80 || (byte4 & 0xC0) !== 0x80) {
        throw new Error(
          `Invalid UTF-8 continuation byte at position ${i + 1}, ${i + 2}, or ${i + 3}`
        )
      }

      const codepoint =
        ((byte & 0x07) << 18) |
        ((byte2 & 0x3F) << 12) |
        ((byte3 & 0x3F) << 6) |
        (byte4 & 0x3F)

      // Check for overlong encoding
      if (codepoint < 0x10000) {
        throw new Error(
          `Overlong UTF-8 encoding at position ${i}: ` +
          `U+${codepoint.toString(16).padStart(6, '0').toUpperCase()} ` +
          `encoded as 4 bytes (should be 3 bytes or less)`
        )
      }

      // Check maximum codepoint (U+10FFFF)
      if (codepoint > 0x10FFFF) {
        throw new Error(
          `UTF-8 codepoint U+${codepoint.toString(16).padStart(6, '0').toUpperCase()} ` +
          `exceeds maximum U+10FFFF at position ${i}`
        )
      }

      i += 4
      continue
    }

    // If we get here, it's an invalid byte
    throw new Error(
      `Invalid UTF-8 byte 0x${byte.toString(16).padStart(2, '0')} at position ${i}`
    )
  }
}

/**
 * Validate integer is in canonical (shortest) form
 */
export function validateCanonicalInteger(value: number | bigint, ai: number): void {
  const v = typeof value === 'bigint' ? value : BigInt(value)

  // Values 0-23 must use direct encoding (AI = value)
  if (v >= 0n && v <= 23n && ai !== Number(v)) {
    throw new Error(
      `Non-canonical integer: value ${v} must use AI ${v}, not AI ${ai}`
    )
  }

  // Values 24-255 must use 1-byte encoding (AI = 24)
  if (v >= 24n && v <= 255n && ai !== 24) {
    throw new Error(
      `Non-canonical integer: value ${v} must use AI 24 (1-byte), not AI ${ai}`
    )
  }

  // Values 256-65535 must use 2-byte encoding (AI = 25)
  if (v >= 256n && v <= 65535n && ai !== 25) {
    throw new Error(
      `Non-canonical integer: value ${v} must use AI 25 (2-byte), not AI ${ai}`
    )
  }

  // Values 65536-4294967295 must use 4-byte encoding (AI = 26)
  if (v >= 65536n && v <= 4294967295n && ai !== 26) {
    throw new Error(
      `Non-canonical integer: value ${v} must use AI 26 (4-byte), not AI ${ai}`
    )
  }

  // Values > 4294967295 must use 8-byte encoding (AI = 27)
  if (v > 4294967295n && ai !== 27) {
    throw new Error(
      `Non-canonical integer: value ${v} must use AI 27 (8-byte), not AI ${ai}`
    )
  }
}

/**
 * Compare two byte arrays lexicographically
 * Returns: -1 if a < b, 0 if a === b, 1 if a > b
 */
export function compareBytes(a: Uint8Array, b: Uint8Array): number {
  if (!a || !b) {
    throw new Error('compareBytes: arguments cannot be null or undefined')
  }

  // Shorter arrays come first
  if (a.length !== b.length) {
    return a.length - b.length
  }

  // Same length: lexicographic comparison
  for (let i = 0; i < a.length; i++) {
    const byteA = a[i]
    const byteB = b[i]
    if (byteA === undefined || byteB === undefined) {
      throw new Error(`Unexpected undefined byte at index ${i}`)
    }
    if (byteA !== byteB) {
      return byteA - byteB
    }
  }

  return 0 // Equal
}

/**
 * Serializes a CBOR value to a normalized string for comparison
 * Used for detecting duplicates in sets and ensuring uniqueness
 *
 * @param value - CBOR value to serialize
 * @returns Normalized string representation
 */
export function serializeValueForComparison(value: unknown): string {
  // Handle primitives
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'boolean') return value.toString()
  if (typeof value === 'number') return `num:${value}`
  if (typeof value === 'bigint') return `bigint:${value.toString()}`
  if (typeof value === 'string') return `str:${value}`

  // Handle Uint8Array (byte strings)
  if (value instanceof Uint8Array) {
    return `bytes:${Array.from(value).map(b => b.toString(16).padStart(2, '0')).join('')}`
  }

  // Handle arrays
  if (Array.isArray(value)) {
    return `array:[${value.map(v => serializeValueForComparison(v)).join(',')}]`
  }

  // Handle objects (maps and tagged values)
  if (typeof value === 'object') {
    // Check if it's a tagged value
    if ('tag' in value && 'value' in value) {
      return `tag:${(value as any).tag}:${serializeValueForComparison((value as any).value)}`
    }

    // Regular object (map)
    const keys = Object.keys(value).sort()
    const pairs = keys.map(k => `${k}:${serializeValueForComparison((value as any)[k])}`)
    return `map:{${pairs.join(',')}}`
  }

  // Fallback for unknown types
  return String(value)
}

/**
 * Checks if a set (array) contains duplicate values
 * Uses serialization-based comparison to handle nested structures
 *
 * @param items - Array of CBOR values
 * @returns True if duplicates found, false otherwise
 */
export function hasDuplicates(items: unknown[]): boolean {
  const seen = new Set<string>()

  for (const item of items) {
    const serialized = serializeValueForComparison(item)
    if (seen.has(serialized)) {
      return true
    }
    seen.add(serialized)
  }

  return false
}
