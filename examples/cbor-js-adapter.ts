/**
 * cbor-js Adapter for CBOR Test Suite
 * Implements the CBOREncoder interface for cbor-js (pure JavaScript)
 */

import { CBOREncoder } from '../src/test-runner/types';
const CBOR = require('cbor-js');

/**
 * Adapter for cbor-js library
 */
export class CborJsAdapter implements CBOREncoder {
  name = 'cbor-js';
  version = '0.1.0';
  features = ['maps', 'typed-arrays', 'tags'];

  /**
   * Encode value to CBOR bytes
   */
  encode(value: unknown): Uint8Array {
    try {
      const arrayBuffer = CBOR.encode(value);
      return new Uint8Array(arrayBuffer);
    } catch (error) {
      throw new Error(`cbor-js encode error: ${(error as Error).message}`);
    }
  }

  /**
   * Decode CBOR bytes to value
   */
  decode(bytes: Uint8Array): unknown {
    try {
      const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      const decoded = CBOR.decode(arrayBuffer);
      return this.convertTypes(decoded);
    } catch (error) {
      throw new Error(`cbor-js decode error: ${(error as Error).message}`);
    }
  }

  /**
   * Convert cbor-js types to expected test format
   */
  private convertTypes(value: any): any {
    if (value === null || value === undefined) {
      return value;
    }

    // Handle BigInt
    if (typeof value === 'bigint') {
      return value.toString();
    }

    // Handle ArrayBuffer / Uint8Array - convert to hex string
    if (value instanceof ArrayBuffer) {
      return Array.from(new Uint8Array(value))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    }

    if (value instanceof Uint8Array) {
      return Array.from(value)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    }

    // Handle arrays
    if (Array.isArray(value)) {
      return value.map(v => this.convertTypes(v));
    }

    // Handle Maps - convert to plain objects
    if (value instanceof Map) {
      const result: any = {};
      for (const [k, v] of value) {
        const key = typeof k === 'number' || typeof k === 'bigint' ? String(k) : this.convertTypes(k);
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
}

// Example usage
if (require.main === module) {
  const adapter = new CborJsAdapter();

  console.log('Testing cbor-js adapter...\n');

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
}
