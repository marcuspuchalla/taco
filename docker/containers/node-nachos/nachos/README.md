# NACHOS

**Not Another CBOR Handling Object System**

> RFC 8949 CBOR encoder/decoder with full source map support for interactive debugging

[![npm version](https://img.shields.io/npm/v/@marcuspuchalla/nachos.svg)](https://www.npmjs.com/package/@marcuspuchalla/nachos)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Test Coverage](https://img.shields.io/badge/coverage-99.4%25-brightgreen.svg)]()

A production-ready, zero-dependency CBOR (Concise Binary Object Representation) codec implementation in TypeScript. Works in Node.js and browsers.

## Features

- ✅ **RFC 8949 Compliant** - Full implementation of CBOR specification
- ✅ **Zero Dependencies** - No runtime dependencies, ~25KB minified
- ✅ **TypeScript First** - Complete type definitions with strict mode
- ✅ **Source Maps** - Bidirectional linking between hex bytes and decoded values
- ✅ **Cardano Support** - Plutus constructor tags (121-127, 1280-1400, 102)
- ✅ **Canonical Encoding** - Deterministic encoding for blockchain use cases
- ✅ **Tree-Shakeable** - Import only what you need
- ✅ **Browser & Node.js** - Works everywhere with ES2020 support

## Installation

```bash
npm install @marcuspuchalla/nachos
```

## Quick Start

### Decoding CBOR

```typescript
import { decode } from '@marcuspuchalla/nachos'

// Decode integer
const result = decode('1864')
console.log(result.value)  // 100

// Decode string
decode('6449455446')  // { value: "IETF", bytesRead: 5 }

// Decode array
decode('83010203')  // { value: [1, 2, 3], bytesRead: 4 }

// Decode map
decode('a16161 01')  // { value: { a: 1 }, bytesRead: 4 }

// Decode tagged value (Cardano)
decode('d87980')  // { value: { tag: 121, value: [] }, bytesRead: 3 }
```

### Encoding CBOR

```typescript
import { encode } from '@marcuspuchalla/nachos'

// Encode number
encode(100)  // { hex: "1864", bytes: Uint8Array[0x18, 0x64] }

// Encode string
encode("IETF")  // { hex: "6449455446", bytes: ... }

// Encode array
encode([1, 2, 3])  // { hex: "83010203", bytes: ... }

// Encode map with canonical ordering (sorted keys)
encode({ z: 1, a: 2 }, { canonical: true })
// Keys are sorted alphabetically: { a: 2, z: 1 }

// Encode tagged value
encode({ tag: 121, value: [] })  // { hex: "d87980", bytes: ... }
```

### Source Maps (Interactive Debugging)

```typescript
import { decodeWithSourceMap } from '@marcuspuchalla/nachos'

const { value, sourceMap } = decodeWithSourceMap('d87980')

// Source map links hex bytes to decoded values
console.log(sourceMap)
// [
//   {
//     path: '',
//     start: 0,
//     end: 3,
//     majorType: 6,
//     type: 'Tag 121',
//     children: ['.value']
//   },
//   {
//     path: '.value',
//     start: 2,
//     end: 3,
//     majorType: 4,
//     type: 'Array',
//     parent: ''
//   }
// ]

// Use for hex-to-JSON highlighting in visualizers
const entry = sourceMap.find(e => e.path === '.value')
console.log(`Array is at hex bytes ${entry.start}-${entry.end}`)
```

## API Reference

### Functional API (Recommended)

```typescript
// Decoder
import { decode, decodeWithSourceMap } from '@marcuspuchalla/nachos'

decode(hexString: string, options?: ParseOptions): ParseResult
decodeWithSourceMap(hexString: string, options?: ParseOptions): ParseResultWithMap

// Encoder
import { encode, encodeToHex, encodeToBytes, encodeSequence } from '@marcuspuchalla/nachos'

encode(value: EncodableValue, options?: EncodeOptions): EncodeResult
encodeToHex(value: EncodableValue, options?: EncodeOptions): string
encodeToBytes(value: EncodableValue, options?: EncodeOptions): Uint8Array
encodeSequence(values: EncodableValue[], options?: EncodeOptions): EncodeResult
```

### Class API (Alternative)

```typescript
import { CborDecoder, CborEncoder } from '@marcuspuchalla/nachos'

// Decoder with persistent options
const decoder = new CborDecoder({ strict: true })
const result1 = decoder.decode('1864')
const result2 = decoder.decodeWithSourceMap('d87980')

// Encoder with persistent options
const encoder = new CborEncoder({ canonical: true })
const encoded1 = encoder.encode(100)
const encoded2 = encoder.encodeToHex([1, 2, 3])
```

## Options

### Parser Options

```typescript
interface ParseOptions {
  strict?: boolean                    // Enable all validations (Cardano mode)
  validateCanonical?: boolean         // Validate canonical encoding
  allowIndefinite?: boolean           // Allow indefinite-length encoding
  rejectDuplicateKeys?: boolean       // Reject duplicate map keys
  validateUtf8Strict?: boolean        // Strict UTF-8 validation
  limits?: {
    maxInputSize?: number             // Max input bytes (default: 10 MB)
    maxOutputSize?: number            // Max output bytes (default: 100 MB)
    maxStringLength?: number          // Max string length (default: 1 MB)
    maxArrayLength?: number           // Max array length (default: 10,000)
    maxMapSize?: number               // Max map size (default: 10,000)
    maxDepth?: number                 // Max nesting depth (default: 64)
    maxParseTime?: number             // Max parse time ms (default: 1000)
  }
}
```

### Encoder Options

```typescript
interface EncodeOptions {
  canonical?: boolean                 // Canonical encoding (shortest form, sorted maps)
  allowIndefinite?: boolean           // Allow indefinite-length encoding
  rejectDuplicateKeys?: boolean       // Reject duplicate map keys
  maxDepth?: number                   // Maximum nesting depth (default: 64)
  maxOutputSize?: number              // Maximum output size bytes (default: 100 MB)
}
```

## Examples

### Cardano Transaction Decoding

```typescript
import { decode } from '@marcuspuchalla/nachos'

// Real Cardano UTXO collateral
const collateralHex = '8282582048bd01d51e580cde15afa6d28f63d89c9137b93a910e5941192e26b12906106700'
const result = decode(collateralHex)

console.log(result.value)
// [[<txHash>, <outputIndex>], ...]
```

### Canonical Encoding for Blockchain

```typescript
import { encode } from '@marcuspuchalla/nachos'

// Canonical encoding ensures deterministic output
const tx = {
  inputs: [{ txId: "abc", index: 0 }],
  outputs: [{ address: "addr1...", amount: 1000000 }]
}

const { hex } = encode(tx, { canonical: true })
// Always produces the same hex string (deterministic)
```

### Round-Trip Encoding/Decoding

```typescript
import { encode, decode } from '@marcuspuchalla/nachos'

const original = { a: 1, b: [2, 3], c: "hello" }

// Encode
const { hex } = encode(original)

// Decode
const { value } = decode(hex)

console.log(value)  // { a: 1, b: [2, 3], c: "hello" }
```

### Streaming with CBOR Sequences

```typescript
import { encodeSequence, decode } from '@marcuspuchalla/nachos'

// Encode multiple values as sequence (RFC 8742)
const { hex } = encodeSequence([1, "hello", [2, 3]])

// Decode manually (parser stops after each value)
const result1 = decode(hex)  // 1
const result2 = decode(hex.slice(result1.bytesRead * 2))  // "hello"
// ... etc
```

## Supported CBOR Types

| CBOR Type | JavaScript Type | Example |
|-----------|-----------------|---------|
| Unsigned Integer (MT 0) | `number`, `bigint` | `42`, `18446744073709551615n` |
| Negative Integer (MT 1) | `number`, `bigint` | `-1`, `-18446744073709551616n` |
| Byte String (MT 2) | `Uint8Array` | `new Uint8Array([0xff, 0x00])` |
| Text String (MT 3) | `string` | `"hello"` |
| Array (MT 4) | `Array` | `[1, 2, 3]` |
| Map (MT 5) | `Object`, `Map` | `{ a: 1 }` |
| Tagged Value (MT 6) | `{ tag, value }` | `{ tag: 121, value: [] }` |
| Simple/Float (MT 7) | `boolean`, `null`, `undefined`, `number` | `true`, `null`, `3.14` |

## Cardano Support

Full support for Cardano Plutus Data encoding:

- **Tag 121-127**: Compact constructors (0-6 fields)
- **Tag 1280-1400**: Extended constructors (7+)
- **Tag 102**: Alternative constructor encoding

```typescript
import { decode } from '@marcuspuchalla/nachos'

// Plutus constructor tag 121 (Constructor 0)
const plutusData = decode('d87980')  // Constructor 0, []

// Tag 122 (Constructor 1, 1 field)
decode('d87a81182a')  // Constructor 1, [42]

// Tag 102 (Alternative encoding)
decode('d8668218c8811863')  // Constructor 200, [[99]]
```

## Performance

Benchmarked on M1 MacBook Pro:

- **Small messages (<1KB):** < 0.1ms
- **Medium messages (1-100KB):** < 10ms
- **Large messages (1MB):** < 100ms
- **Cardano transactions (2-5KB):** ~0.2ms

Memory usage:
- **Parser:** < 1MB base
- **Source maps:** ~2x input size
- **Encoder:** < 500KB base

## Browser Compatibility

Requires ES2020+ for BigInt support:

- ✅ Chrome 67+
- ✅ Firefox 68+
- ✅ Safari 14+
- ✅ Edge 79+
- ✅ Node.js 16+

## Security

Security features:
- ✅ **Depth limits** - Prevents stack overflow (default: 64)
- ✅ **Size limits** - Prevents memory exhaustion
- ✅ **Timeout protection** - Prevents infinite loops
- ✅ **UTF-8 validation** - Rejects invalid sequences
- ✅ **Overflow detection** - Safe integer arithmetic

Report security issues to: marcus.puchalla@googlemail.com

## Development

```bash
# Install dependencies
npm install

# Build library
npm run build

# Run tests
npm test

# Type check
npm run type-check

# Watch mode
npm run build:watch
```

## License

GPL-3.0 © 2025 Marcus Puchalla

## Related

- [RFC 8949 - CBOR Specification](https://datatracker.ietf.org/doc/html/rfc8949)
- [RFC 8742 - CBOR Sequences](https://datatracker.ietf.org/doc/html/rfc8742)
- [Cardano Plutus Data Encoding](https://cips.cardano.org/)

## Contributing

Contributions welcome! Please open an issue or PR.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for release history.
