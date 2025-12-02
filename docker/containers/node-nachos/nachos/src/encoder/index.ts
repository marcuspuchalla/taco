/**
 * NACHOS Encoder Module
 *
 * @module @marcuspuchalla/nachos/encoder
 */

// Export encoder composables
export { useCborEncoder } from './composables/useCborEncoder'
export { useCborIntegerEncoder } from './composables/useCborIntegerEncoder'
export { useCborStringEncoder } from './composables/useCborStringEncoder'
export { useCborCollectionEncoder } from './composables/useCborCollectionEncoder'
export { useCborSimpleEncoder } from './composables/useCborSimpleEncoder'
export { useCborTagEncoder } from './composables/useCborTagEncoder'

// Export types
export type {
  EncodeResult,
  EncodeOptions,
  EncodableValue,
  EncodeContext
} from './types'

// Export constants
export {
  DEFAULT_ENCODE_OPTIONS
} from './types'

// Export utility functions
export {
  bytesToHex,
  concatenateUint8Arrays,
  compareBytes,
  writeUint,
  writeBigUint
} from './utils'
