/**
 * CBOR Encoder Utility Functions
 */

/**
 * Convert Uint8Array to hex string
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Concatenate multiple Uint8Arrays
 */
export function concatenateUint8Arrays(arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0)
  const result = new Uint8Array(totalLength)

  let offset = 0
  for (const arr of arrays) {
    result.set(arr, offset)
    offset += arr.length
  }

  return result
}

/**
 * Compare two Uint8Arrays bytewise (for canonical map sorting)
 */
export function compareBytes(a: Uint8Array, b: Uint8Array): number {
  // First, compare lengths
  if (a.length !== b.length) {
    return a.length - b.length
  }

  // Then, compare bytewise
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

  return 0
}

/**
 * Write unsigned integer to bytes (big-endian)
 */
export function writeUint(value: number, bytes: number): Uint8Array {
  const result = new Uint8Array(bytes)

  for (let i = bytes - 1; i >= 0; i--) {
    result[i] = value & 0xff
    value = value >>> 8
  }

  return result
}

/**
 * Write BigInt to bytes (big-endian)
 */
export function writeBigUint(value: bigint, bytes: number): Uint8Array {
  const result = new Uint8Array(bytes)

  for (let i = bytes - 1; i >= 0; i--) {
    result[i] = Number(value & 0xffn)
    value = value >> 8n
  }

  return result
}
