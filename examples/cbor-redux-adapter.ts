/**
 * cbor-redux Adapter for CBOR Test Suite
 * Implements the CBOREncoder interface for cbor-redux
 */

import { CBOREncoder } from '../src/test-runner/types';
const CBOR = require('cbor-redux');

/**
 * Adapter for cbor-redux library
 */
export class CborReduxAdapter implements CBOREncoder {
  name = 'cbor-redux';
  version = '1.0.0';
  features = ['maps', 'typed-arrays', 'dates', 'tags'];

  /**
   * Encode value to CBOR bytes
   */
  encode(value: unknown): Uint8Array {
    try {
      // cbor-redux encode returns ArrayBuffer
      const arrayBuffer = CBOR.encode(value);
      return new Uint8Array(arrayBuffer);
    } catch (error) {
      throw new Error(`cbor-redux encode error: ${(error as Error).message}`);
    }
  }

  /**
   * Decode CBOR bytes to value
   */
  decode(bytes: Uint8Array): unknown {
    try {
      // cbor-redux decode expects ArrayBuffer
      const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      const decoded = CBOR.decode(arrayBuffer);
      return this.convertTypes(decoded);
    } catch (error) {
      throw new Error(`cbor-redux decode error: ${(error as Error).message}`);
    }
  }

  /**
   * Convert cbor-redux types to expected test format
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

    // Handle ArrayBuffer
    if (value instanceof ArrayBuffer) {
      const bytes = new Uint8Array(value);
      return Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    }

    // Handle Maps - convert to plain objects
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
  const adapter = new CborReduxAdapter();

  console.log('Testing cbor-redux adapter...\n');

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
