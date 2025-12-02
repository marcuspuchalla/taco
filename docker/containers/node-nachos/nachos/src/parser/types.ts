/**
 * CBOR Parser Type Definitions
 * Following RFC 8949 specification
 */

/**
 * Parser resource limits for DoS protection
 */
export interface ParserLimits {
  /** Maximum input size in bytes (default: 10 MB) */
  maxInputSize?: number
  /** Maximum output size in bytes (default: 100 MB) */
  maxOutputSize?: number
  /** Maximum string length in bytes (default: 1 MB) */
  maxStringLength?: number
  /** Maximum array length (default: 10,000) */
  maxArrayLength?: number
  /** Maximum map size (default: 10,000) */
  maxMapSize?: number
  /** Maximum nesting depth for arrays/maps (default: 100) */
  maxDepth?: number
  /** Maximum tag nesting depth (default: 100) - Prevents RUSTSEC-2019-0025 */
  maxTagDepth?: number
  /** Maximum bignum size in bytes for tags 2/3 (default: 1024 bytes = 8192 bits) - Prevents CVE-2020-28491 */
  maxBignumBytes?: number
  /** Maximum parse time in milliseconds (default: 1000) */
  maxParseTime?: number
}

/**
 * Duplicate map key handling modes
 * Following RFC 8949 Section 5.6 guidance
 */
export type DupMapKeyMode = 'allow' | 'warn' | 'reject'

/**
 * Parser options for controlling behavior
 */
export interface ParseOptions {
  /** Enable strict Cardano mode (all validations) */
  strict?: boolean
  /** Validate canonical encoding (shortest form, sorted maps) */
  validateCanonical?: boolean
  /** Allow indefinite-length encoding (false in strict mode) */
  allowIndefinite?: boolean
  /**
   * Duplicate map key handling (RFC 8949 Section 5.6)
   * - 'allow': Allow duplicates (default, permissive)
   * - 'warn': Warn on duplicates but continue parsing
   * - 'reject': Throw error on duplicate keys (strict mode)
   */
  dupMapKeyMode?: DupMapKeyMode
  /** Validate UTF-8 strictly (reject overlongs) */
  validateUtf8Strict?: boolean
  /** Validate set uniqueness (Tag 258 - reject duplicates) */
  validateSetUniqueness?: boolean
  /** Validate semantic tag constraints (Tag 4, Tag 5 array structure) */
  validateTagSemantics?: boolean
  /** Validate Plutus constructor semantics (Tags 102, 121-127, 1280-1400) */
  validatePlutusSemantics?: boolean
  /** Resource limits */
  limits?: ParserLimits
}

/**
 * Default resource limits for parser
 */
export const DEFAULT_LIMITS: Required<ParserLimits> = {
  maxInputSize: 10 * 1024 * 1024,      // 10 MB
  maxOutputSize: 100 * 1024 * 1024,    // 100 MB
  maxStringLength: 1024 * 1024,        // 1 MB
  maxArrayLength: 10000,
  maxMapSize: 10000,
  maxDepth: 100,                       // Collection nesting depth (increased for compatibility)
  maxTagDepth: 100,                    // Tag nesting depth (RUSTSEC-2019-0025 mitigation)
  maxBignumBytes: 1024,                // 1 KB = 8192 bits (CVE-2020-28491 mitigation)
  maxParseTime: 1000                   // 1 second
}

/**
 * Default parse options
 */
export const DEFAULT_OPTIONS: Required<ParseOptions> = {
  strict: false,
  validateCanonical: false,
  allowIndefinite: true,
  dupMapKeyMode: 'allow',
  validateUtf8Strict: false,
  validateSetUniqueness: false,
  validateTagSemantics: false,
  validatePlutusSemantics: false,
  limits: DEFAULT_LIMITS
}

/**
 * Parsing context that tracks state during CBOR decoding
 */
export interface CborContext {
  /** Raw byte buffer */
  buffer: Uint8Array
  /** Current byte offset */
  offset: number
  /** Source map entries for visualization */
  sourceMap: SourceMapEntry[]
  /** Current nesting depth for arrays/maps (for limit checking) */
  currentDepth?: number
  /** Current tag nesting depth (for tag limit checking) */
  currentTagDepth?: number
  /** Parse start time (for timeout checking) */
  startTime?: number
  /** Bytes allocated (for output size tracking) */
  bytesAllocated?: number
  /** Parser options */
  options?: ParseOptions
}

/**
 * Result of parsing a CBOR value
 */
export interface ParseResult {
  /** Decoded CBOR value */
  value: CborValue
  /** Number of bytes consumed */
  bytesRead: number
}

/**
 * Parse result with source mapping information
 */
export interface ParseResultWithMap extends ParseResult {
  /** Source map for hex/JSON linking */
  sourceMap: SourceMapEntry[]
}

/**
 * Source map entry for bi-directional visualization
 */
export interface SourceMapEntry {
  /** JSON Pointer path (RFC 6901) */
  path: string
  /** Starting byte offset */
  start: number
  /** Ending byte offset (exclusive) */
  end: number
  /** CBOR major type (0-7) */
  majorType: number
  /** Human-readable type description */
  type: string
  /** Parent entry path (for nested structures like tags) */
  parent?: string
  /** Child entry paths (for container types) */
  children?: string[]
  /** Whether this entry represents a header (initial byte + length info) */
  isHeader?: boolean
  /** Whether this entry represents content (payload data) */
  isContent?: boolean
  /** Byte offset where header ends and content begins */
  headerEnd?: number
  /** JSON Pointer path to the content portion (for split header/content entries) */
  contentPath?: string
}

/**
 * CBOR byte string (can be definite or indefinite length)
 */
export interface CborByteString {
  readonly type: 'cbor-byte-string'
  readonly bytes: Uint8Array
  readonly chunks?: Uint8Array[]  // Original chunks for indefinite byte strings
  [INDEFINITE_SYMBOL]?: boolean
}

/**
 * CBOR text string (can be definite or indefinite length)
 */
export interface CborTextString {
  readonly type: 'cbor-text-string'
  readonly text: string
  readonly chunks?: string[]  // Original chunks for indefinite text strings
  [INDEFINITE_SYMBOL]?: boolean
}

/**
 * All possible CBOR values
 */
export type CborValue =
  | number
  | bigint
  | string
  | boolean
  | null
  | undefined
  | Uint8Array
  | CborByteString
  | CborTextString
  | CborValue[]
  | CborMap
  | TaggedValue
  | SimpleValue

/**
 * Symbol to mark arrays/maps as indefinite-length encoded
 * This allows round-trip preservation of encoding style
 */
export const INDEFINITE_SYMBOL = Symbol('cbor.indefinite')

/**
 * Symbol used to store all map entries including duplicates
 * This allows byte-perfect round-trip when CBOR maps have duplicate keys
 * Stores: Array<[key: CborValue, value: CborValue]>
 */
export const ALL_ENTRIES_SYMBOL = Symbol('cbor.allEntries')

/**
 * CBOR map type (Map with any CBOR value as keys)
 *
 * Uses JavaScript Map to preserve key types (integers, Uint8Arrays, etc.)
 * This is essential for:
 * - Cardano transactions (use integer keys 0-18)
 * - Round-trip encoding (must preserve exact key types)
 * - CBOR specification compliance (maps can have any type as keys)
 *
 * @example
 * ```typescript
 * // Cardano transaction body
 * new Map([
 *   [0, inputs],      // Integer key
 *   [1, outputs],     // Integer key
 *   [2, 1000000]      // Integer key (fee)
 * ])
 * ```
 */
export type CborMap = Map<CborValue, CborValue> & { [INDEFINITE_SYMBOL]?: boolean }

/**
 * CBOR array type with optional indefinite-length marker
 */
export type CborArray = CborValue[] & { [INDEFINITE_SYMBOL]?: boolean }

/**
 * Tagged CBOR value (Major Type 6)
 */
export interface TaggedValue {
  tag: number
  value: CborValue
  plutus?: PlutusConstr  // Decoded Plutus constructor (for tags 102, 121-127, 1280-1400)
}

/**
 * Simple CBOR value (Major Type 7, unassigned simple values)
 */
export interface SimpleValue {
  simpleValue: number
}

/**
 * Plutus Data types for Cardano smart contracts
 */
export type PlutusData =
  | PlutusConstr
  | PlutusMap
  | PlutusList
  | PlutusInt
  | PlutusBytes

/**
 * Plutus Constructor (algebraic data type)
 */
export interface PlutusConstr {
  constructor: number
  fields: PlutusData[]
}

/**
 * Plutus Map (key-value pairs)
 */
export interface PlutusMap {
  entries: Array<[PlutusData, PlutusData]>
}

/**
 * Plutus List (sequential collection)
 */
export type PlutusList = PlutusData[]

/**
 * Plutus Integer (arbitrary precision)
 */
export type PlutusInt = number | bigint

/**
 * Plutus Bytes (bounded byte string, max 64 bytes)
 */
export type PlutusBytes = Uint8Array

/**
 * CBOR Major Types (0-7)
 */
export enum CborMajorType {
  UNSIGNED_INT = 0,
  NEGATIVE_INT = 1,
  BYTE_STRING = 2,
  TEXT_STRING = 3,
  ARRAY = 4,
  MAP = 5,
  TAG = 6,
  SIMPLE = 7
}

/**
 * Additional Information values
 */
export enum CborAdditionalInfo {
  DIRECT = 23,          // Values 0-23
  ONE_BYTE = 24,        // 1 byte follows
  TWO_BYTES = 25,       // 2 bytes follow
  FOUR_BYTES = 26,      // 4 bytes follow
  EIGHT_BYTES = 27,     // 8 bytes follow
  INDEFINITE = 31       // Indefinite length
}

/**
 * Simple values (Major Type 7)
 */
export enum CborSimpleValue {
  FALSE = 20,
  TRUE = 21,
  NULL = 22,
  UNDEFINED = 23,
  FLOAT16 = 25,
  FLOAT32 = 26,
  FLOAT64 = 27,
  BREAK = 31
}

/**
 * Common semantic tags (RFC 8949)
 */
export enum CborTag {
  DATE_TIME_STRING = 0,
  EPOCH_DATE_TIME = 1,
  POSITIVE_BIGNUM = 2,
  NEGATIVE_BIGNUM = 3,
  DECIMAL_FRACTION = 4,
  BIGFLOAT = 5,
  BASE64URL = 21,
  BASE64 = 22,
  BASE16 = 23,
  CBOR_ENCODED = 24,
  URI = 32,
  BASE64URL_NO_PAD = 33,
  BASE64_NO_PAD = 34,
  REGEXP = 35,
  MIME_MESSAGE = 36,
  SELF_DESCRIBE_CBOR = 55799,
  SET = 258
}

/**
 * Cardano Plutus constructor tags
 */
export enum CardanoTag {
  /** Alternative constructor: 102([index, fields]) */
  ALTERNATIVE_CONSTR = 102,
  /** Compact constructor 0 (tag 121 = constr 0) */
  CONSTR_0 = 121,
  /** Compact constructor 1 (tag 122 = constr 1) */
  CONSTR_1 = 122,
  /** Compact constructor 2 (tag 123 = constr 2) */
  CONSTR_2 = 123,
  /** Compact constructor 3 (tag 124 = constr 3) */
  CONSTR_3 = 124,
  /** Compact constructor 4 (tag 125 = constr 4) */
  CONSTR_4 = 125,
  /** Compact constructor 5 (tag 126 = constr 5) */
  CONSTR_5 = 126,
  /** Compact constructor 6 (tag 127 = constr 6) */
  CONSTR_6 = 127,
  /** Extended constructor base (1280-1400 = constr 7-127) */
  EXTENDED_CONSTR_BASE = 1280
}

/**
 * Parser option presets for common use cases
 */
export const PRESET_STRICT: Required<ParseOptions> = {
  strict: true,
  validateCanonical: true,
  allowIndefinite: false,
  dupMapKeyMode: 'reject',
  validateUtf8Strict: true,
  validateSetUniqueness: true,
  validateTagSemantics: true,
  validatePlutusSemantics: true,
  limits: DEFAULT_LIMITS
}

/**
 * Cardano-specific preset (validates Plutus semantics, allows indefinite)
 */
export const PRESET_CARDANO: Required<ParseOptions> = {
  strict: false,
  validateCanonical: false,
  allowIndefinite: true,
  dupMapKeyMode: 'allow',
  validateUtf8Strict: false,
  validateSetUniqueness: false,
  validateTagSemantics: false,
  validatePlutusSemantics: true,
  limits: DEFAULT_LIMITS
}

/**
 * Permissive preset (no validation, maximum compatibility)
 */
export const PRESET_PERMISSIVE: Required<ParseOptions> = {
  strict: false,
  validateCanonical: false,
  allowIndefinite: true,
  dupMapKeyMode: 'allow',
  validateUtf8Strict: false,
  validateSetUniqueness: false,
  validateTagSemantics: false,
  validatePlutusSemantics: false,
  limits: DEFAULT_LIMITS
}

/**
 * Parse error types
 */
export interface ParseError {
  type: 'INVALID_HEX' | 'UNEXPECTED_EOF' | 'INVALID_CBOR' | 'UNSUPPORTED_TYPE'
  message: string
  offset?: number
}

/**
 * Result type for operations that can fail
 */
export type Result<T, E> =
  | { success: true; value: T }
  | { success: false; error: E }
