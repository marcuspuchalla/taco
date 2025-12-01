/**
 * cbor-x Adapter for CBOR Test Suite
 * Implements the CBOREncoder interface for the cbor-x library
 */

import { encode, decode } from 'cbor-x';
import { CBOREncoder } from '../src/test-runner/types';

/**
 * Adapter for cbor-x library
 */
export class CborXAdapter implements CBOREncoder {
  name = 'cbor-x';
  version = '1.6.0';
  features = ['bigint', 'maps', 'typed-arrays', 'dates'];

  /**
   * Encode value to CBOR bytes
   */
  encode(value: unknown): Uint8Array {
    try {
      const result = encode(value);
      // cbor-x returns a Buffer, convert to Uint8Array
      return new Uint8Array(result);
    } catch (error) {
      throw new Error(`cbor-x encode error: ${(error as Error).message}`);
    }
  }

  /**
   * Decode CBOR bytes to value
   */
  decode(bytes: Uint8Array): unknown {
    try {
      // cbor-x expects a Buffer or Uint8Array
      const result = decode(Buffer.from(bytes));
      return this.convertCborXTypes(result);
    } catch (error) {
      throw new Error(`cbor-x decode error: ${(error as Error).message}`);
    }
  }

  /**
   * Convert cbor-x specific types to expected format
   */
  private convertCborXTypes(value: any): any {
    // Handle BigInt - convert to string
    if (typeof value === 'bigint') {
      return value.toString();
    }

    // Handle Buffer
    if (Buffer.isBuffer(value)) {
      return value.toString('hex');
    }

    // Handle Tag objects
    if (value && value.constructor && value.constructor.name === 'Tag') {
      return this.convertCBORTag(value.tag, value.value);
    }

    if (Array.isArray(value)) {
      return value.map(v => this.convertCborXTypes(v));
    }

    if (value && typeof value === 'object') {
      // Handle Maps - cbor-x might return Map objects
      if (value instanceof Map) {
        const result: any = {};
        for (const [k, v] of value) {
          const key = typeof k === 'number' || typeof k === 'bigint' ? String(k) : this.convertCborXTypes(k);
          result[key] = this.convertCborXTypes(v);
        }
        return result;
      }

      if (value instanceof Set) {
        return new Set(Array.from(value).map(v => this.convertCborXTypes(v)));
      }

      // Handle plain objects
      if (value.constructor === Object) {
        const result: any = {};
        for (const [k, v] of Object.entries(value)) {
          result[k] = this.convertCborXTypes(v);
        }
        return result;
      }
    }

    return value;
  }

  /**
   * Convert CBOR tags to expected format
   */
  private convertCBORTag(tag: number, value: any): any {
    // Plutus Data constructor tags (121-127 for constructors 0-6)
    if (tag >= 121 && tag <= 127) {
      const constructor = tag - 121;
      return {
        constructor,
        fields: this.convertCborXTypes(value)
      };
    }

    // General constructor tag 102
    if (tag === 102 && Array.isArray(value) && value.length === 2) {
      return {
        constructor: value[0],
        fields: this.convertCborXTypes(value[1])
      };
    }

    // Set tag (258)
    if (tag === 258) {
      return this.convertCborXTypes(value);
    }

    // Self-describe CBOR tag (55799)
    if (tag === 55799) {
      return this.convertCborXTypes(value);
    }

    // CBOR-in-CBOR tag (24)
    if (tag === 24 && Buffer.isBuffer(value)) {
      return value.toString('hex');
    }

    // Bignum tags (2 and 3)
    if (tag === 2 || tag === 3) {
      return this.convertCborXTypes(value);
    }

    // Date/time tags (0 and 1)
    if (tag === 0 || tag === 1) {
      return value;
    }

    // Unknown tags - return value as-is
    return this.convertCborXTypes(value);
  }

  /**
   * cbor-x doesn't have built-in canonical encoding
   * We'll skip this for now
   */
  encodeCanonical?(value: unknown): Uint8Array {
    // cbor-x doesn't have explicit canonical encoding mode
    // Just use regular encoding
    return this.encode(value);
  }
}

// Example usage
if (require.main === module) {
  const adapter = new CborXAdapter();

  console.log('Testing cbor-x adapter...\n');

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
  console.log('  Success:', JSON.stringify(decoded3) === JSON.stringify([1, 2, 3]));

  // Test 4: Map
  console.log('\nTest 4: Encode/decode map {a: 1, b: 2}');
  const bytes4 = adapter.encode({a: 1, b: 2});
  console.log('  Encoded:', Array.from(bytes4).map(b => b.toString(16).padStart(2, '0')).join(''));
  const decoded4 = adapter.decode(bytes4);
  console.log('  Decoded:', JSON.stringify(decoded4));

  // Test 5: BigInt
  console.log('\nTest 5: Encode/decode BigInt');
  const bigValue = 9007199254740992n; // Beyond JavaScript safe integer
  const bytes5 = adapter.encode(bigValue);
  console.log('  Encoded:', Array.from(bytes5).map(b => b.toString(16).padStart(2, '0')).join(''));
  const decoded5 = adapter.decode(bytes5);
  console.log('  Decoded:', decoded5);
  console.log('  Success:', decoded5 === bigValue);

  console.log('\n✓ Adapter basic tests complete!');
}
