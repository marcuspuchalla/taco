/**
 * node-cbor Adapter for CBOR Test Suite
 * Implements the CBOREncoder interface for the cbor (node-cbor) library
 */

import * as cbor from 'cbor';
import { CBOREncoder } from '../src/test-runner/types';

/**
 * Adapter for node-cbor library
 */
export class CborAdapter implements CBOREncoder {
  name = 'cbor (node-cbor)';
  version = '9.2.0';
  features = ['bigint', 'maps', 'typed-arrays', 'dates', 'indefinite-length'];

  /**
   * Encode value to CBOR bytes
   */
  encode(value: unknown): Uint8Array {
    try {
      // node-cbor is async, but we can use encodeOne which is sync-ish
      const result = cbor.encodeOne(value);
      return new Uint8Array(result);
    } catch (error) {
      throw new Error(`cbor encode error: ${(error as Error).message}`);
    }
  }

  /**
   * Decode CBOR bytes to value
   */
  decode(bytes: Uint8Array): unknown {
    try {
      // Decode synchronously
      const buffer = Buffer.from(bytes);
      const result = cbor.decodeFirstSync(buffer);

      // Convert Buffer objects to hex strings for compatibility
      return this.convertBuffersToHex(result);
    } catch (error) {
      throw new Error(`cbor decode error: ${(error as Error).message}`);
    }
  }

  /**
   * Convert Buffer objects to hex strings and handle CBOR tags recursively
   */
  private convertBuffersToHex(value: any): any {
    if (Buffer.isBuffer(value)) {
      return value.toString('hex');
    }

    // Handle BigInt - convert to string for large numbers
    if (typeof value === 'bigint') {
      return value.toString();
    }

    if (Array.isArray(value)) {
      return value.map(v => this.convertBuffersToHex(v));
    }
    if (value && typeof value === 'object') {
      // Handle CBOR Tagged values (cbor library uses Tagged class)
      if (value.constructor && value.constructor.name === 'Tagged') {
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
      return this.convertBuffersToHex(value);
    }

    // Date/time tags (0 and 1)
    if (tag === 0) {
      // Tag 0: date-time string
      return value;
    }
    if (tag === 1) {
      // Tag 1: epoch timestamp
      return value;
    }

    // Unknown tags - return tagged value as-is
    return this.convertBuffersToHex(value);
  }

  /**
   * node-cbor doesn't have built-in canonical encoding
   * But we can try to use its options
   */
  encodeCanonical?(value: unknown): Uint8Array {
    try {
      // node-cbor has canonical option
      const result = cbor.encodeOne(value, {
        canonical: true
      });
      return new Uint8Array(result);
    } catch (error) {
      throw new Error(`cbor canonical encode error: ${(error as Error).message}`);
    }
  }
}

// Example usage
if (require.main === module) {
  const adapter = new CborAdapter();

  console.log('Testing cbor adapter...\n');

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

  // Test 3: BigInt
  console.log('\nTest 3: Encode/decode BigInt');
  const bigValue = 9007199254740992n;
  const bytes3 = adapter.encode(bigValue);
  console.log('  Encoded:', Array.from(bytes3).map(b => b.toString(16).padStart(2, '0')).join(''));
  const decoded3 = adapter.decode(bytes3);
  console.log('  Decoded:', decoded3);
  console.log('  Success:', decoded3 === bigValue);

  // Test 4: Byte string (as Buffer)
  console.log('\nTest 4: Encode/decode byte string');
  const byteValue = Buffer.from([0xaa, 0xbb, 0xcc]);
  const bytes4 = adapter.encode(byteValue);
  console.log('  Encoded:', Array.from(bytes4).map(b => b.toString(16).padStart(2, '0')).join(''));
  const decoded4 = adapter.decode(bytes4);
  console.log('  Decoded:', decoded4);
  console.log('  Success:', decoded4 === 'aabbcc');

  console.log('\n✓ Adapter tests complete!');
}
