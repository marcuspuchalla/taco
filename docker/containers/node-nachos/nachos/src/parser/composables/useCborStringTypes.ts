/**
 * CBOR String Type Helpers
 * Composables for working with CborByteString and CborTextString
 */

import type { CborByteString, CborTextString } from '../types'
import { INDEFINITE_SYMBOL } from '../types'

/**
 * Composable for creating and working with CBOR byte strings
 */
export function useCborByteString() {
  /**
   * Create a CBOR byte string
   *
   * @param bytes - The byte data
   * @param indefinite - Whether this was encoded with indefinite length
   * @param chunks - Original chunks for indefinite byte strings
   * @returns CborByteString object
   */
  const create = (bytes: Uint8Array, indefinite = false, chunks?: Uint8Array[]): CborByteString => {
    const result: CborByteString = {
      type: 'cbor-byte-string',
      bytes,
      ...(chunks && { chunks })
    }

    if (indefinite) {
      (result as any)[INDEFINITE_SYMBOL] = true
    }

    return result
  }

  /**
   * Check if a byte string was encoded with indefinite length
   */
  const isIndefinite = (value: CborByteString | Uint8Array): boolean => {
    return (value as any)[INDEFINITE_SYMBOL] === true
  }

  /**
   * Extract raw bytes from a CborByteString or Uint8Array
   */
  const toBytes = (value: CborByteString | Uint8Array): Uint8Array => {
    if (value instanceof Uint8Array) {
      return value
    }
    return value.bytes
  }

  /**
   * Check if a value is a CborByteString
   */
  const isCborByteString = (value: any): value is CborByteString => {
    return typeof value === 'object' &&
           value !== null &&
           value.type === 'cbor-byte-string' &&
           value.bytes instanceof Uint8Array
  }

  return {
    create,
    isIndefinite,
    toBytes,
    isCborByteString
  }
}

/**
 * Composable for creating and working with CBOR text strings
 */
export function useCborTextString() {
  /**
   * Create a CBOR text string
   *
   * @param text - The text data
   * @param indefinite - Whether this was encoded with indefinite length
   * @param chunks - Original chunks for indefinite text strings
   * @returns CborTextString object
   */
  const create = (text: string, indefinite = false, chunks?: string[]): CborTextString => {
    const result: CborTextString = {
      type: 'cbor-text-string',
      text,
      ...(chunks && { chunks })
    }

    if (indefinite) {
      (result as any)[INDEFINITE_SYMBOL] = true
    }

    return result
  }

  /**
   * Check if a text string was encoded with indefinite length
   */
  const isIndefinite = (value: CborTextString | string): boolean => {
    return (value as any)[INDEFINITE_SYMBOL] === true
  }

  /**
   * Extract raw string from a CborTextString or string
   */
  const toString = (value: CborTextString | string): string => {
    if (typeof value === 'string') {
      return value
    }
    return value.text
  }

  /**
   * Check if a value is a CborTextString
   */
  const isCborTextString = (value: any): value is CborTextString => {
    return typeof value === 'object' &&
           value !== null &&
           value.type === 'cbor-text-string' &&
           typeof value.text === 'string'
  }

  return {
    create,
    isIndefinite,
    toString,
    isCborTextString
  }
}
