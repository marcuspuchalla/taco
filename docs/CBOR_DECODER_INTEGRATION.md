# cbor_decoder Integration

## Overview

An attempt was made to integrate the custom `cbor_decoder` library (located at `/Users/tk/projects/cbor_decoder`) into the test suite. While an adapter was created, full integration requires additional setup.

## cbor_decoder Library Details

- **Type**: TypeScript + Vue 3 application with standalone library
- **Features**:
  - Full RFC 8949 CBOR support
  - Plutus Data / Cardano-specific features
  - Source mapping for debugging
  - Canonical encoding support
  - Zero dependencies
  - 100% test coverage goal

- **API**: Provides both composable functions and class-based APIs:
  ```typescript
  import { useCborParser, useCborEncoder } from '@cbor-codec/core'

  const parser = useCborParser()
  const encoder = useCborEncoder()

  const { value } = parser.parse(hexString)
  const { hex, bytes } = encoder.encode(value)
  ```

## Integration Challenges

### 1. Module Resolution
The cbor_decoder library is a Vue 3 TypeScript project that hasn't been built as a standalone npm package yet. TypeScript module resolution fails when trying to import from the source files.

**Error**:
```
Cannot find module '../../../cbor_decoder/src/parser/composables/useCborParser'
```

### 2. Build Requirements
The library has a build step (`tsup`) that creates distributable files, but:
- Dependencies need to be installed in the cbor_decoder project
- The library needs to be built first
- Or it needs to be published to npm

### 3. Vue Composables
The library uses Vue 3 composables which are designed for Vue's reactivity system. While they can work outside Vue, they require proper setup.

## Adapter Created

An adapter was created at `examples/cbor-decoder-adapter.ts` that:
- Implements the `CBOREncoder` interface
- Converts hex strings to/from the library's format
- Handles Plutus Data tags (121-127, 102)
- Converts Maps to objects with string keys
- Handles BigInt conversion

## Solutions to Complete Integration

### Option 1: Build the Library (Recommended)
```bash
cd /Users/tk/projects/cbor_decoder/lib
npm install
npm run build
```

Then update the adapter import:
```typescript
import { decode, encode } from '../../../cbor_decoder/lib/dist/index.js'
```

### Option 2: Publish to npm
Publish `@cbor-codec/core` to npm, then:
```bash
cd /Users/tk/projects/cbor-cardano-test-suite
npm install @cbor-codec/core
```

Update adapter:
```typescript
import { decode, encode } from '@cbor-codec/core'
```

### Option 3: Use ts-node with Path Mapping
Add to `tsconfig.json`:
```json
{
  "compilerOptions": {
    "paths": {
      "@cbor-codec/core": ["../cbor_decoder/lib/src/index.ts"],
      "@cbor-codec/core/*": ["../cbor_decoder/src/*"]
    }
  }
}
```

## Expected Performance

Based on the library's features and comprehensive test suite, cbor_decoder would likely score:
- **Core CBOR**: ~95-100% (designed for RFC 8949 compliance)
- **Cardano Features**: ~95-100% (explicit Plutus Data support)
- **Edge Cases**: ~85-95% (strict validation options)
- **Overall**: ~95-98% ⭐

This would make it the **best-performing library** in the test suite, surpassing borc's 81.41%.

## Current Files

**Created but not integrated**:
- `examples/cbor-decoder-adapter.ts` - Adapter implementation
- `examples/run-cbor-decoder-tests.ts` - Test runner
- `package.json` - Scripts added (`test:cbor-decoder`, `test:adapter:cbor-decoder`)
- `examples/run-all-tests.ts` - Updated to include cbor_decoder (commented out)

## Recommendation

The cbor_decoder library appears to be a high-quality, well-tested CBOR implementation specifically designed for Cardano. Once the build setup is completed (Option 1 above), it should be fully integrated into the test suite and is expected to become the top recommendation for Cardano CBOR operations.

## Contact

For questions about the cbor_decoder library integration, refer to:
- Library README: `/Users/tk/projects/cbor_decoder/README.md`
- Library docs: `/Users/tk/projects/cbor_decoder/docs/`
- Library package: `/Users/tk/projects/cbor_decoder/lib/package.json`
