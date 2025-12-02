/**
 * NACHOS Parser (Decoder) Module
 *
 * @module @marcuspuchalla/nachos/parser
 */

// Export parser composables
export { useCborParser } from './composables/useCborParser'
export { useCborInteger } from './composables/useCborInteger'
export { useCborString } from './composables/useCborString'
export { useCborCollection } from './composables/useCborCollection'
export { useCborFloat } from './composables/useCborFloat'
export { useCborTag } from './composables/useCborTag'

// Export types
export type {
  ParseResult,
  ParseResultWithMap,
  ParseOptions,
  ParseError,
  ParserLimits,
  CborContext,
  CborValue,
  CborMap,
  TaggedValue,
  PlutusData,
  PlutusConstr,
  PlutusMap,
  PlutusList,
  PlutusInt,
  PlutusBytes,
  SourceMapEntry,
  Result,
  DupMapKeyMode
} from './types'

// Export constants and enums
export {
  DEFAULT_OPTIONS,
  DEFAULT_LIMITS,
  CborMajorType,
  CborAdditionalInfo,
  CborSimpleValue,
  CborTag
} from './types'

// Export utility functions
export {
  hexToBytes,
  bytesToHex,
  readByte,
  readUint,
  readBigUint,
  extractCborHeader,
  validateUtf8Strict
} from './utils'
