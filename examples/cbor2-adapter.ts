/**
 * cbor2 Adapter for CBOR Test Suite
 * Implements the CBOREncoder interface for cbor2 (successor to node-cbor)
 */

import { CBOREncoder } from '../src/test-runner/types';
const cbor2 = require('cbor2');

/**
 * Adapter for cbor2 library
 */
export class Cbor2Adapter implements CBOREncoder {
  name = 'cbor2';
  version = '2.0.1';
  features = ['bigint', 'maps', 'typed-arrays', 'dates', 'tags', 'streaming'];

  /**
   * Encode value to CBOR bytes
   */
  encode(value: unknown): Uint8Array {
    try {
      const buffer = cbor2.encode(value);
      return new Uint8Array(buffer);
    } catch (error) {
      throw new Error(`cbor2 encode error: ${(error as Error).message}`);
    }
  }

  /**
   * Decode CBOR bytes to value
   */
  decode(bytes: Uint8Array): unknown {
    try {
      const buffer = Buffer.from(bytes);
      const decoded = cbor2.decode(buffer);
      return this.convertTypes(decoded);
    } catch (error) {
      throw new Error(`cbor2 decode error: ${(error as Error).message}`);
    }
  }

  /**
   * Convert cbor2 types to expected test format
   */
  private convertTypes(value: any): any {
    if (value === null || value === undefined) {
      return value;
    }

    // Handle BigInt - convert to string
    if (typeof value === 'bigint') {
      return value.toString();
    }

    // Handle Buffer - convert to hex string
    if (Buffer.isBuffer(value)) {
      return value.toString('hex');
    }

    // Handle Uint8Array - convert to hex string
    if (value instanceof Uint8Array) {
      return Array.from(value)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    }

    // Handle Tagged values (cbor2 uses Tagged class)
    if (value && value.constructor && value.constructor.name === 'Tagged') {
      return this.convertTag(value.tag, this.convertTypes(value.value));
    }

    // Handle Maps - convert to plain objects with string keys
    if (value instanceof Map) {
      const result: any = {};
      for (const [k, v] of value) {
        let key: string;
        if (typeof k === 'number' || typeof k === 'bigint') {
          key = String(k);
        } else if (Buffer.isBuffer(k) || k instanceof Uint8Array) {
          key = Buffer.from(k).toString('hex');
        } else {
          key = this.convertTypes(k);
        }
        result[key] = this.convertTypes(v);
      }
      return result;
    }

    // Handle Sets - convert to arrays
    if (value instanceof Set) {
      return Array.from(value).map(v => this.convertTypes(v));
    }

    // Handle arrays
    if (Array.isArray(value)) {
      return value.map(v => this.convertTypes(v));
    }

    // Handle Date objects
    if (value instanceof Date) {
      return value.toISOString();
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
   */
  private convertTag(tag: number, value: any): any {
    // Plutus Data constructor tags (121-127 for constructors 0-6)
    if (tag >= 121 && tag <= 127) {
      const constructor = tag - 121;
      return {
        constructor,
        fields: value
      };
    }

    // General constructor tag 102
    if (tag === 102 && Array.isArray(value) && value.length === 2) {
      return {
        constructor: value[0],
        fields: value[1]
      };
    }

    // Set tag (258) - convert to array
    if (tag === 258) {
      return value;
    }

    // Self-describe CBOR tag (55799) - return inner value
    if (tag === 55799) {
      return value;
    }

    // CBOR-in-CBOR tag (24)
    if (tag === 24) {
      return value;
    }

    // Bignum tags (2 and 3)
    if (tag === 2 || tag === 3) {
      return value;
    }

    // Date/time tags (0 and 1)
    if (tag === 0 || tag === 1) {
      return value;
    }

    // Unknown tags - return the value as-is
    return value;
  }

  /**
   * cbor2 supports canonical encoding
   */
  encodeCanonical?(value: unknown): Uint8Array {
    // cbor2 encodes canonically by default (following RFC 8949)
    return this.encode(value);
  }
}

// Example usage
if (require.main === module) {
  const adapter = new Cbor2Adapter();

  console.log('Testing cbor2 adapter...\n');

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

  // Test 3: Map with integer key
  console.log('\nTest 3: Encode/decode Map {1: 2}');
  const mapData = new Map([[1, 2]]);
  const bytes3 = adapter.encode(mapData);
  console.log('  Encoded:', Array.from(bytes3).map(b => b.toString(16).padStart(2, '0')).join(''));
  const decoded3 = adapter.decode(bytes3);
  console.log('  Decoded:', JSON.stringify(decoded3));
  console.log('  Success:', JSON.stringify(decoded3) === '{"1":2}');

  console.log('\n✓ Adapter tests complete!');
}
