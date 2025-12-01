/**
 * cbor_decoder Adapter for CBOR Test Suite - Phase 1 Optimized
 * Implements the CBOREncoder interface for the custom cbor_decoder library
 *
 * PHASE 1 FIXES APPLIED:
 * ✅ BigInt handling (convert to string for JSON test compatibility)
 * ✅ Uint8Array to hex conversion
 * ✅ Indefinite string object unwrapping
 * ✅ Extended Plutus constructor tags (1280-1400)
 * ✅ Proper type conversion for test compatibility
 */

import { CBOREncoder } from '../src/test-runner/types';

// Import from built cbor_decoder library using correct path
const cborDecoderPath = '/home/cb0/projects/cbor/cbor_decoder/lib/dist/index.js';
const { decode, encode } = require(cborDecoderPath);

/**
 * Adapter for custom cbor_decoder library
 */
export class CborDecoderAdapter implements CBOREncoder {
  name = 'cbor_decoder';
  version = '1.0.0';
  features = [
    'bigint',
    'maps',
    'typed-arrays',
    'dates',
    'tags',
    'plutus-data',
    'cardano',
    'duplicate-keys',
    'indefinite-length'
  ];

  /**
   * Encode value to CBOR bytes
   */
  encode(value: unknown): Uint8Array {
    try {
      const result = encode(value);
      // encode returns { hex: string, bytes: Uint8Array }
      return result.bytes;
    } catch (error) {
      throw new Error(`cbor_decoder encode error: ${(error as Error).message}`);
    }
  }

  /**
   * Decode CBOR bytes to value
   */
  decode(bytes: Uint8Array): unknown {
    try {
      // Convert Uint8Array to hex string
      const hex = Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      const result = decode(hex);
      // decode returns { value: any, bytesRead: number }
      return this.convertTypes(result.value);
    } catch (error) {
      throw new Error(`cbor_decoder decode error: ${(error as Error).message}`);
    }
  }

  /**
   * Convert cbor_decoder types to expected test format
   *
   * PHASE 1 IMPROVEMENTS:
   * - Keep BigInt as bigint (not string) for proper comparison
   * - Always convert Uint8Array to hex strings
   * - Unwrap indefinite string objects
   * - Handle extended constructor tags
   */
  private convertTypes(value: any): any {
    // Handle null/undefined
    if (value === null || value === undefined) {
      return value;
    }

    // Handle primitives
    if (typeof value === 'string' || typeof value === 'boolean') {
      return value;
    }

    // Handle numbers - convert special float values to sentinel strings for test compatibility
    if (typeof value === 'number') {
      if (Number.isNaN(value)) {
        return '::NAN::';
      }
      if (value === Infinity) {
        return '::INFINITY::';
      }
      if (value === -Infinity) {
        return '::NEG_INFINITY::';
      }

      // For integers, convert to string if beyond the test suite's threshold
      if (Number.isInteger(value)) {
        // Test suite uses asymmetric thresholds (based on exact representability):
        // - Positive: > 2^53-1 (9007199254740991) becomes string
        // - Negative: < -2^53 (-9007199254740992) becomes string
        // Don't convert very large floats (like Number.MAX_VALUE) to strings
        const MAX_CBOR_INT = 18446744073709551615;
        const isOutsideTestRange = value > 9007199254740991 || value < -9007199254740992;
        if (isOutsideTestRange && Math.abs(value) <= MAX_CBOR_INT) {
          return value.toString();
        }
      }

      return value;
    }

    // Handle BigInt - Convert to string for test compatibility
    // JSON test data stores large integers as strings since JSON doesn't support BigInt
    if (typeof value === 'bigint') {
      // Use same asymmetric threshold as regular numbers
      // - Positive: <= 2^53-1 (9007199254740991) stays as number
      // - Negative: >= -2^53 (-9007199254740992) stays as number
      if (value >= -9007199254740992n && value <= 9007199254740991n) {
        return Number(value);
      }
      // Values beyond threshold become strings
      return value.toString();
    }

    // Handle Uint8Array - ALWAYS convert to hex string for test compatibility
    if (value instanceof Uint8Array) {
      return Array.from(value)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    }

    // PHASE 1 FIX: Handle indefinite string objects
    // Library may return {type: 'cbor-text-string', text: 'hello', chunks: [...]}
    if (value && typeof value === 'object') {
      if (value.type === 'cbor-text-string' && 'text' in value) {
        return value.text; // Return final concatenated string
      }
      if (value.type === 'cbor-byte-string' && 'bytes' in value) {
        // Convert bytes to hex
        if (value.bytes instanceof Uint8Array) {
          const bytes = value.bytes as Uint8Array;
          return Array.from(bytes)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
        }
        return value.bytes;
      }
    }

    // Handle tagged values - cbor_decoder returns { tag: number, value: any }
    if (value && typeof value === 'object' && 'tag' in value && 'value' in value) {
      return this.convertTag(value.tag, value.value);
    }

    // Handle arrays
    if (Array.isArray(value)) {
      return value.map(v => this.convertTypes(v));
    }

    // Handle Maps - convert to plain objects with string keys
    if (value instanceof Map) {
      const result: any = {};
      for (const [k, v] of value) {
        let key: string;

        // Convert different key types to strings
        if (typeof k === 'string') {
          key = k;
        } else if (typeof k === 'number') {
          key = String(k);
        } else if (typeof k === 'bigint') {
          key = k.toString();
        } else if (k instanceof Uint8Array) {
          // Convert Uint8Array keys to hex strings
          key = Array.from(k).map(b => b.toString(16).padStart(2, '0')).join('');
        } else if (Array.isArray(k)) {
          // For array keys, use JSON representation
          key = JSON.stringify(this.convertTypes(k));
        } else if (k instanceof Map) {
          // For map keys, use JSON representation
          key = JSON.stringify(this.convertTypes(k));
        } else if (typeof k === 'object' && k !== null) {
          // For other objects, use JSON representation
          key = JSON.stringify(this.convertTypes(k));
        } else {
          key = String(k);
        }

        result[key] = this.convertTypes(v);
      }
      return result;
    }

    // Handle Sets - convert to arrays
    if (value instanceof Set) {
      return Array.from(value).map(v => this.convertTypes(v));
    }

    // Handle plain objects
    if (value && typeof value === 'object' && value.constructor === Object) {
      const result: any = {};
      for (const [k, v] of Object.entries(value)) {
        result[k] = this.convertTypes(v);
      }
      return result;
    }

    return value;
  }

  /**
   * Convert CBOR tags to expected format for Cardano tests
   *
   * PHASE 1 IMPROVEMENTS:
   * - Added extended constructor tags (1280-1400)
   * - Better tag handling for all Plutus data types
   */
  private convertTag(tag: number, value: any): any {
    // Plutus Data constructor tags (121-127 for constructors 0-6)
    if (tag >= 121 && tag <= 127) {
      const constructor = tag - 121;
      return {
        constructor,
        fields: this.convertTypes(value)
      };
    }

    // PHASE 1 FIX: Extended constructor tags (1280-1400 for constructors 7+)
    if (tag >= 1280 && tag <= 1400) {
      const constructor = tag - 1280 + 7;
      return {
        constructor,
        fields: this.convertTypes(value)
      };
    }

    // General constructor tag 102
    if (tag === 102) {
      if (Array.isArray(value) && value.length === 2) {
        const constructorIndex = value[0];
        const fields = value[1];

        // Fields should be an array
        if (!Array.isArray(fields)) {
          throw new Error(`Tag 102 (constructor) fields must be an array, got ${typeof fields}`);
        }

        return {
          constructor: constructorIndex,
          fields: fields.map(f => this.convertTypes(f))
        };
      }
      // Invalid format - return as-is
      return { tag: 102, value: this.convertTypes(value) };
    }

    // Set tag (258) - convert to array
    if (tag === 258) {
      return this.convertTypes(value);
    }

    // Self-describe CBOR tag (55799) - return inner value transparently
    if (tag === 55799) {
      return this.convertTypes(value);
    }

    // CBOR-in-CBOR tag (24) - return just the hex string value
    if (tag === 24) {
      // If value is a Uint8Array or hex string, just return it
      if (value instanceof Uint8Array) {
        // Convert to hex string
        return Array.from(value).map(b => b.toString(16).padStart(2, '0')).join('');
      }
      // If already a string (hex), return as-is
      if (typeof value === 'string') {
        return value;
      }
      return this.convertTypes(value);
    }

    // Bignum tags (2 and 3) - convert bytes to BigInt, then to decimal string
    if (tag === 2 || tag === 3) {
      // If value is Uint8Array, convert to BigInt
      if (value instanceof Uint8Array) {
        let bigintValue = 0n;

        // Convert bytes to BigInt (big-endian)
        for (let i = 0; i < value.length; i++) {
          bigintValue = (bigintValue << 8n) | BigInt(value[i]);
        }

        // Tag 2: Positive bignum - return as decimal string
        // Tag 3: Negative bignum - apply formula: -1 - n, return as decimal string
        if (tag === 2) {
          return bigintValue.toString();
        } else {
          return (-1n - bigintValue).toString();
        }
      }

      // If already converted by library, just pass through
      return this.convertTypes(value);
    }

    // Date/time tags (0 and 1) - convert to ISO 8601 strings
    if (tag === 0) {
      // Tag 0: RFC 3339 date-time string - normalize to ISO 8601 with milliseconds
      if (typeof value !== 'string') {
        throw new Error(`Tag 0 (date-time string) must contain a text string, got ${typeof value}`);
      }
      // Parse and convert to ISO 8601 format with milliseconds
      try {
        const date = new Date(value);
        return date.toISOString(); // Returns format: "2024-10-26T12:00:00.000Z"
      } catch (error) {
        throw new Error(`Invalid RFC 3339 date string: ${value}`);
      }
    }
    if (tag === 1) {
      // Tag 1: Unix epoch timestamp - convert to ISO 8601 string
      if (typeof value !== 'number' && typeof value !== 'bigint') {
        throw new Error(`Tag 1 (epoch timestamp) must contain a number or bigint, got ${typeof value}`);
      }
      // Convert epoch (seconds) to ISO 8601 string
      const milliseconds = typeof value === 'bigint' ? Number(value) * 1000 : value * 1000;
      const date = new Date(milliseconds);
      return date.toISOString(); // Returns format: "2023-10-27T00:00:00.000Z"
    }

    // Unknown/unsupported tags - return just the inner value (transparent)
    // Tests expect unknown tags to be transparent and return just the value
    return this.convertTypes(value);
  }

  /**
   * cbor_decoder supports canonical encoding via options
   */
  encodeCanonical?(value: unknown): Uint8Array {
    try {
      const result = encode(value, { canonical: true });
      return result.bytes;
    } catch (error) {
      throw new Error(`cbor_decoder canonical encode error: ${(error as Error).message}`);
    }
  }

  /**
   * Round-trip test helper
   */
  roundTrip(value: unknown): unknown {
    const encoded = this.encode(value);
    return this.decode(encoded);
  }
}

// Example usage and testing
if (require.main === module) {
  const adapter = new CborDecoderAdapter();

  console.log('Testing cbor_decoder adapter with Phase 1 fixes...\n');

  // Test 1: Simple integer
  console.log('Test 1: Encode/decode integer 42');
  const bytes1 = adapter.encode(42);
  console.log('  Encoded:', Array.from(bytes1).map(b => b.toString(16).padStart(2, '0')).join(''));
  const decoded1 = adapter.decode(bytes1);
  console.log('  Decoded:', decoded1);
  console.log('  Success:', decoded1 === 42);

  // Test 2: String
  console.log('\nTest 2: Encode/decode string "hello"');
  const bytes2 = adapter.encode('hello');
  console.log('  Encoded:', Array.from(bytes2).map(b => b.toString(16).padStart(2, '0')).join(''));
  const decoded2 = adapter.decode(bytes2);
  console.log('  Decoded:', decoded2);
  console.log('  Success:', decoded2 === 'hello');

  // Test 3: BigInt (Phase 1 fix - convert to string)
  console.log('\nTest 3: Encode/decode BigInt');
  const bigValue = BigInt('18446744073709551615'); // 2^64 - 1
  const bigBytes = adapter.encode(bigValue);
  console.log('  Encoded:', Array.from(bigBytes).map(b => b.toString(16).padStart(2, '0')).join(''));
  const bigDecoded = adapter.decode(bigBytes);
  console.log('  Decoded:', bigDecoded, 'Type:', typeof bigDecoded);
  console.log('  Success:', bigDecoded === '18446744073709551615');

  // Test 4: Uint8Array (Phase 1 fix - convert to hex)
  console.log('\nTest 4: Encode/decode Uint8Array');
  const byteArray = new Uint8Array([0x00, 0x10, 0x20, 0x30]);
  const arrayBytes = adapter.encode(byteArray);
  console.log('  Encoded:', Array.from(arrayBytes).map(b => b.toString(16).padStart(2, '0')).join(''));
  const arrayDecoded = adapter.decode(arrayBytes);
  console.log('  Decoded:', arrayDecoded);
  console.log('  Expected: "00102030"');
  console.log('  Success:', arrayDecoded === '00102030');

  // Test 5: Plutus Data constructor
  console.log('\nTest 5: Encode/decode Plutus Data tag 121');
  const plutusBytes = new Uint8Array([0xd8, 0x79, 0x82, 0x01, 0x02]);
  const plutusDecoded = adapter.decode(plutusBytes);
  console.log('  Decoded:', JSON.stringify(plutusDecoded));
  console.log('  Expected: {"constructor":0,"fields":[1,2]}');
  console.log('  Success:', JSON.stringify(plutusDecoded) === '{"constructor":0,"fields":[1,2]}');

  // Test 6: Map with integer keys
  console.log('\nTest 6: Decode map with integer key');
  const mapBytes = new Uint8Array([0xa1, 0x01, 0x02]); // {1: 2}
  const mapDecoded = adapter.decode(mapBytes);
  console.log('  Decoded:', JSON.stringify(mapDecoded));
  console.log('  Expected: {"1":2}');
  console.log('  Success:', JSON.stringify(mapDecoded) === '{"1":2}');

  // Test 7: Extended constructor tag (Phase 1 fix)
  console.log('\nTest 7: Extended Plutus constructor tag 1280');
  const extBytes = new Uint8Array([0xd9, 0x05, 0x00, 0x81, 0x01]); // tag(1280)[1]
  const extDecoded = adapter.decode(extBytes);
  console.log('  Decoded:', JSON.stringify(extDecoded));
  console.log('  Expected: {"constructor":7,"fields":[1]}');

  console.log('\n✓ Adapter Phase 1 tests complete!');
}