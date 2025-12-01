/**
 * @ipld/dag-cbor ESM Adapter for CBOR Test Suite
 * Uses .mjs extension for native ESM support
 */

import { encode, decode } from '@ipld/dag-cbor';

/**
 * Adapter for @ipld/dag-cbor library (ESM version)
 */
export class DagCborAdapter {
  name = 'dag-cbor';
  version = '9.2.5';
  features = ['bigint', 'maps', 'typed-arrays', 'deterministic', 'ipld'];

  /**
   * Encode value to CBOR bytes
   */
  encode(value) {
    try {
      // dag-cbor encode returns Uint8Array
      return encode(value);
    } catch (error) {
      throw new Error(`dag-cbor encode error: ${error.message}`);
    }
  }

  /**
   * Decode CBOR bytes to value
   */
  decode(bytes) {
    try {
      const decoded = decode(bytes);
      return this.convertTypes(decoded);
    } catch (error) {
      throw new Error(`dag-cbor decode error: ${error.message}`);
    }
  }

  /**
   * Convert dag-cbor types to expected test format
   */
  convertTypes(value) {
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

    // Handle Maps - convert to plain objects
    if (value instanceof Map) {
      const result = {};
      for (const [k, v] of value) {
        let key;
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

    // Handle Sets - convert to arrays
    if (value instanceof Set) {
      return Array.from(value).map(v => this.convertTypes(v));
    }

    // Handle Date objects
    if (value instanceof Date) {
      return value.toISOString();
    }

    // Handle arrays
    if (Array.isArray(value)) {
      return value.map(v => this.convertTypes(v));
    }

    // Handle plain objects
    if (value && typeof value === 'object' && value.constructor === Object) {
      const result = {};
      for (const [k, v] of Object.entries(value)) {
        result[k] = this.convertTypes(v);
      }
      return result;
    }

    return value;
  }

  /**
   * dag-cbor is deterministic by design
   */
  encodeCanonical(value) {
    return this.encode(value);
  }
}

// Example usage
const adapter = new DagCborAdapter();

console.log('Testing @ipld/dag-cbor ESM adapter...\n');

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

// Test 3: Array
console.log('\nTest 3: Encode/decode array [1, 2, 3]');
const bytes3 = adapter.encode([1, 2, 3]);
console.log('  Encoded:', Array.from(bytes3).map(b => b.toString(16).padStart(2, '0')).join(''));
const decoded3 = adapter.decode(bytes3);
console.log('  Decoded:', JSON.stringify(decoded3));
console.log('  Success:', JSON.stringify(decoded3) === '[1,2,3]');

console.log('\n✓ Adapter tests complete!');
