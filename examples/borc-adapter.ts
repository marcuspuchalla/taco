/**
 * borc Adapter for CBOR Test Suite
 * Implements the CBOREncoder interface for the borc library
 */

const cbor = require('borc');
import { CBOREncoder } from '../src/test-runner/types';

/**
 * Adapter for borc library
 */
export class BorcAdapter implements CBOREncoder {
  name = 'borc';
  version = '3.0.0';
  features = ['maps', 'typed-arrays', 'dates', 'indefinite-length'];

  /**
   * Encode value to CBOR bytes
   */
  encode(value: unknown): Uint8Array {
    try {
      const result = cbor.encode(value);
      return new Uint8Array(result);
    } catch (error) {
      throw new Error(`borc encode error: ${(error as Error).message}`);
    }
  }

  /**
   * Decode CBOR bytes to value
   */
  decode(bytes: Uint8Array): unknown {
    try {
      const buffer = Buffer.from(bytes);
      const result = cbor.decode(buffer);

      // Convert Buffer objects to hex strings for compatibility
      return this.convertBuffersToHex(result);
    } catch (error) {
      throw new Error(`borc decode error: ${(error as Error).message}`);
    }
  }

  /**
   * Convert Buffer objects to hex strings and handle CBOR tags recursively
   */
  private convertBuffersToHex(value: any): any {
    if (Buffer.isBuffer(value)) {
      return value.toString('hex');
    }

    // Handle Date objects (from CBOR tags 0 and 1)
    if (value instanceof Date) {
      return value.toISOString();
    }

    // Handle BigNumber objects (from borc for large integers)
    if (value && value.constructor && value.constructor.name === 'BigNumber') {
      return value.toString();
    }

    if (Array.isArray(value)) {
      return value.map(v => this.convertBuffersToHex(v));
    }
    if (value && typeof value === 'object') {
      // Handle CBOR tags
      if (value.tag !== undefined && value.value !== undefined) {
        return this.convertCBORTag(value.tag, value.value);
      }
      if (value instanceof Map) {
        // Convert Map to plain object with string keys for test compatibility
        const result: any = {};
        for (const [k, v] of value) {
          const key = typeof k === 'number' || typeof k === 'bigint' ? String(k) : this.convertBuffersToHex(k);
          result[key] = this.convertBuffersToHex(v);
        }
        return result;
      }
      if (value instanceof Set) {
        return new Set(Array.from(value).map(v => this.convertBuffersToHex(v)));
      }
      if (value.constructor === Object) {
        const result: any = {};
        for (const [k, v] of Object.entries(value)) {
          result[k] = this.convertBuffersToHex(v);
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
        fields: this.convertBuffersToHex(value)
      };
    }

    // General constructor tag 102
    if (tag === 102 && Array.isArray(value) && value.length === 2) {
      return {
        constructor: value[0],
        fields: this.convertBuffersToHex(value[1])
      };
    }

    // Set tag (258)
    if (tag === 258) {
      return this.convertBuffersToHex(value);
    }

    // Self-describe CBOR tag (55799)
    if (tag === 55799) {
      return this.convertBuffersToHex(value);
    }

    // CBOR-in-CBOR tag (24)
    if (tag === 24 && Buffer.isBuffer(value)) {
      return value.toString('hex');
    }

    // Bignum tags (2 and 3)
    if (tag === 2 || tag === 3) {
      // Return as-is (already converted by borc)
      return String(value);
    }

    // Date/time tags (0 and 1)
    if (tag === 0) {
      // Tag 0: date-time string - convert Date to ISO string
      return value instanceof Date ? value.toISOString() : value;
    }
    if (tag === 1) {
      // Tag 1: epoch timestamp - convert Date to ISO string
      return value instanceof Date ? value.toISOString() : value;
    }

    // Unknown tags - return tagged value as-is
    return this.convertBuffersToHex(value);
  }

  /**
   * borc doesn't have built-in canonical encoding
   */
  encodeCanonical?(value: unknown): Uint8Array {
    // borc doesn't support canonical encoding
    return this.encode(value);
  }
}

// Example usage
if (require.main === module) {
  const adapter = new BorcAdapter();

  console.log('Testing borc adapter...\n');

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

  // Test 3: Byte string (as Buffer)
  console.log('\nTest 3: Encode/decode byte string');
  const byteValue = Buffer.from([0xaa, 0xbb, 0xcc]);
  const bytes3 = adapter.encode(byteValue);
  console.log('  Encoded:', Array.from(bytes3).map(b => b.toString(16).padStart(2, '0')).join(''));
  const decoded3 = adapter.decode(bytes3);
  console.log('  Decoded:', decoded3);
  console.log('  Success:', decoded3 === 'aabbcc');

  console.log('\n✓ Adapter tests complete!');
}
