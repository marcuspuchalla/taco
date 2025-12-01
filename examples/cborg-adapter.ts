/**
 * cborg Adapter for CBOR Test Suite
 * Implements the CBOREncoder interface for cborg (IPLD deterministic CBOR)
 */

import { CBOREncoder } from '../src/test-runner/types';
const { encode, decode } = require('cborg');

/**
 * Adapter for cborg library
 */
export class CborgAdapter implements CBOREncoder {
  name = 'cborg';
  version = '4.2.18';
  features = ['bigint', 'maps', 'typed-arrays', 'tags', 'deterministic'];

  /**
   * Encode value to CBOR bytes
   */
  encode(value: unknown): Uint8Array {
    try {
      return encode(value);
    } catch (error) {
      throw new Error(`cborg encode error: ${(error as Error).message}`);
    }
  }

  /**
   * Decode CBOR bytes to value
   */
  decode(bytes: Uint8Array): unknown {
    try {
      const decoded = decode(bytes);
      return this.convertTypes(decoded);
    } catch (error) {
      throw new Error(`cborg decode error: ${(error as Error).message}`);
    }
  }

  /**
   * Convert cborg types to expected test format
   */
  private convertTypes(value: any): any {
    if (value === null || value === undefined) {
      return value;
    }

    // Handle BigInt - convert to string
    if (typeof value === 'bigint') {
      return value.toString();
    }

    // Handle Uint8Array - convert to hex string
    if (value instanceof Uint8Array) {
      return Array.from(value)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
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
        if (typeof k === 'number' || typeof k === 'bigint') {
          key = String(k);
        } else if (k instanceof Uint8Array) {
          key = Array.from(k).map(b => b.toString(16).padStart(2, '0')).join('');
        } else {
          key = this.convertTypes(k);
        }
        result[key] = this.convertTypes(v);
      }
      return result;
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
   * cborg always encodes deterministically
   */
  encodeCanonical?(value: unknown): Uint8Array {
    return this.encode(value);
  }
}

// Example usage
if (require.main === module) {
  const adapter = new CborgAdapter();

  console.log('Testing cborg adapter...\n');

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
