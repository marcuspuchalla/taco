/**
 * CBOR Encoder Type Definitions
 * Following RFC 8949 specification
 */

import type { PlutusConstr, CborByteString, CborTextString } from '../parser/types'
import { INDEFINITE_SYMBOL, ALL_ENTRIES_SYMBOL } from '../parser/types'

// Re-export symbols and types for use in encoder
export { INDEFINITE_SYMBOL, ALL_ENTRIES_SYMBOL }
export type { CborByteString, CborTextString }

/**
 * Encoder options for controlling behavior
 */
export interface EncodeOptions {
  /** Enable canonical encoding (shortest form, sorted maps) */
  canonical?: boolean
  /** Allow indefinite-length encoding (false in canonical mode) */
  allowIndefinite?: boolean
  /** Reject duplicate map keys */
  rejectDuplicateKeys?: boolean
  /** Maximum nesting depth */
  maxDepth?: number
  /** Maximum output size in bytes */
  maxOutputSize?: number
}

/**
 * Default encode options
 */
export const DEFAULT_ENCODE_OPTIONS: Required<EncodeOptions> = {
  canonical: false,
  allowIndefinite: true,
  rejectDuplicateKeys: false,
  maxDepth: 64,
  maxOutputSize: 100 * 1024 * 1024  // 100 MB
}

/**
 * Result of encoding operation
 */
export interface EncodeResult {
  /** Encoded CBOR bytes */
  bytes: Uint8Array
  /** Hex string representation */
  hex: string
}

/**
 * Values that can be encoded to CBOR
 *
 * Supports both plain objects (for convenience) and Maps (for type preservation).
 * Map<any, any> is preferred for maps with non-string keys (integers, Uint8Arrays, etc.)
 */
export type EncodableValue =
  | number
  | bigint
  | string
  | boolean
  | null
  | undefined
  | Uint8Array
  | EncodableValue[]
  | { [key: string]: EncodableValue }  // Plain object (legacy/convenience)
  | Map<EncodableValue, EncodableValue>  // Map (preserves key types)
  | TaggedValue

/**
 * Tagged CBOR value (Major Type 6)
 */
export interface TaggedValue {
  tag: number
  value: EncodableValue
  plutus?: PlutusConstr
}

/**
 * Encoding context that tracks state during CBOR encoding
 */
export interface EncodeContext {
  /** Current nesting depth */
  depth: number
  /** Bytes written so far */
  bytesWritten: number
  /** Encoder options */
  options: Required<EncodeOptions>
}
