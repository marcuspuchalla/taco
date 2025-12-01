/**
 * @harmoniclabs/cbor Adapter for CBOR Test Suite
 * Implements the CBOREncoder interface for the Cardano-specific harmoniclabs/cbor library
 */

import { CBOREncoder } from '../src/test-runner/types';

const {
  Cbor,
  CborUInt,
  CborNInt,
  CborBytes,
  CborText,
  CborArray,
  CborMap,
  CborTag,
  CborSimple,
  isCborObj
} = require('@harmoniclabs/cbor');

/**
 * Adapter for @harmoniclabs/cbor library
 */
export class HarmoniclabsCborAdapter implements CBOREncoder {
  name = '@harmoniclabs/cbor';
  version = '1.6.6';
  features = ['bigint', 'maps', 'typed-arrays', 'dates', 'tags', 'plutus-data', 'cardano'];

  /**
   * Encode value to CBOR bytes
   */
  encode(value: unknown): Uint8Array {
    try {
      const cborValue = this.toCborValue(value);
      const encoded = Cbor.encode(cborValue);
      // Cbor.encode returns a CborString with .asBytes property
      return encoded.asBytes;
    } catch (error) {
      throw new Error(`@harmoniclabs/cbor encode error: ${(error as Error).message}`);
    }
  }

  /**
   * Decode CBOR bytes to value
   */
  decode(bytes: Uint8Array): unknown {
    try {
      const buffer = Buffer.from(bytes);
      const parsed = Cbor.parse(buffer);
      return this.fromCborValue(parsed);
    } catch (error) {
      throw new Error(`@harmoniclabs/cbor decode error: ${(error as Error).message}`);
    }
  }

  /**
   * Convert JavaScript value to CBOR value object
   */
  private toCborValue(value: unknown): any {
    // null, undefined
    if (value === null || value === undefined) {
      return new CborSimple(22); // null
    }

    // Boolean
    if (typeof value === 'boolean') {
      return new CborSimple(value ? 21 : 20);
    }

    // Number
    if (typeof value === 'number') {
      if (value >= 0) {
        return new CborUInt(value);
      } else {
        return new CborNInt(value);
      }
    }

    // BigInt or string representing BigInt
    if (typeof value === 'bigint') {
      if (value >= 0n) {
        return new CborUInt(value);
      } else {
        return new CborNInt(value);
      }
    }

    // String
    if (typeof value === 'string') {
      // Check if it's a hex string representing bytes
      if (/^[0-9a-fA-F]+$/.test(value) && value.length % 2 === 0 && value.length > 0) {
        // Could be hex bytes, but treat as string for now
        return new CborText(value);
      }
      return new CborText(value);
    }

    // Uint8Array or Buffer
    if (value instanceof Uint8Array || Buffer.isBuffer(value)) {
      return new CborBytes(Buffer.from(value));
    }

    // Array
    if (Array.isArray(value)) {
      return new CborArray(value.map(v => this.toCborValue(v)));
    }

    // Map
    if (value instanceof Map) {
      const entries: Array<{ k: any; v: any }> = [];
      for (const [k, v] of value) {
        entries.push({
          k: this.toCborValue(k),
          v: this.toCborValue(v)
        });
      }
      return new CborMap(entries);
    }

    // Plain object
    if (value && typeof value === 'object') {
      // Check for Plutus Data format {constructor, fields}
      if ('constructor' in value && 'fields' in value) {
        const constructor = (value as any).constructor;
        const fields = (value as any).fields;

        // Use tags 121-127 for constructors 0-6
        if (constructor >= 0 && constructor <= 6) {
          return new CborTag(121 + constructor, this.toCborValue(fields));
        } else {
          // Use tag 102 with [constructor, fields]
          return new CborTag(102, new CborArray([
            new CborUInt(constructor),
            this.toCborValue(fields)
          ]));
        }
      }

      // Regular object - convert to map
      const entries: Array<{ k: any; v: any }> = [];
      for (const [k, v] of Object.entries(value)) {
        entries.push({
          k: this.toCborValue(k),
          v: this.toCborValue(v)
        });
      }
      return new CborMap(entries);
    }

    throw new Error(`Cannot convert value to CBOR: ${value}`);
  }

  /**
   * Convert CBOR value object to JavaScript value
   */
  private fromCborValue(value: any): any {
    // Handle null check first
    if (!value) {
      return null;
    }

    // CborUInt
    if (value.constructor && value.constructor.name === 'CborUInt') {
      const num = value._num;
      if (typeof num === 'bigint') {
        // Convert BigInt to number if it fits, otherwise to string
        if (num >= BigInt(Number.MIN_SAFE_INTEGER) && num <= BigInt(Number.MAX_SAFE_INTEGER)) {
          return Number(num);
        }
        return num.toString();
      }
      return num;
    }

    // CborNInt
    if (value.constructor && value.constructor.name === 'CborNInt') {
      const num = value._num;
      if (typeof num === 'bigint') {
        // Convert BigInt to number if it fits, otherwise to string
        if (num >= BigInt(Number.MIN_SAFE_INTEGER) && num <= BigInt(Number.MAX_SAFE_INTEGER)) {
          return Number(num);
        }
        return num.toString();
      }
      return num;
    }

    // CborBytes
    if (value.constructor && value.constructor.name === 'CborBytes') {
      const buffer = value.buffer || value._buffer;
      if (buffer) {
        return buffer.toString('hex');
      }
      return '';
    }

    // CborText
    if (value.constructor && value.constructor.name === 'CborText') {
      return value.text || value._text || '';
    }

    // CborArray
    if (value.constructor && value.constructor.name === 'CborArray') {
      const array = value.array || value._array || [];
      return array.map((v: any) => this.fromCborValue(v));
    }

    // CborMap
    if (value.constructor && value.constructor.name === 'CborMap') {
      const map = value.map || value._map || [];
      const result: any = {};
      for (const entry of map) {
        const k = entry.k || entry.key;
        const v = entry.v || entry.value;

        let key: string;
        const keyValue = this.fromCborValue(k);

        if (typeof keyValue === 'number' || typeof keyValue === 'string') {
          key = String(keyValue);
        } else if (typeof keyValue === 'object') {
          key = JSON.stringify(keyValue);
        } else {
          key = String(keyValue);
        }

        result[key] = this.fromCborValue(v);
      }
      return result;
    }

    // CborTag
    if (value.constructor && value.constructor.name === 'CborTag') {
      let tag = value.tag || value._tag;
      // Tag might be BigInt, convert to number
      if (typeof tag === 'bigint') {
        tag = Number(tag);
      }
      const tagValue = value.data || value._data;
      return this.convertTag(tag, this.fromCborValue(tagValue));
    }

    // CborSimple
    if (value.constructor && value.constructor.name === 'CborSimple') {
      const simple = value.simple || value._simple;
      if (simple === 20) return false;
      if (simple === 21) return true;
      if (simple === 22) return null;
      if (simple === 23) return undefined;
      return simple;
    }

    // Plain JavaScript types
    if (typeof value === 'bigint') {
      return value.toString();
    }

    if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
      return Buffer.from(value).toString('hex');
    }

    if (Array.isArray(value)) {
      return value.map(v => this.fromCborValue(v));
    }

    if (value instanceof Map) {
      const result: any = {};
      for (const [k, v] of value) {
        const key = typeof k === 'number' || typeof k === 'bigint' ? String(k) : this.fromCborValue(k);
        result[key] = this.fromCborValue(v);
      }
      return result;
    }

    if (value && typeof value === 'object' && value.constructor === Object) {
      const result: any = {};
      for (const [k, v] of Object.entries(value)) {
        result[k] = this.fromCborValue(v);
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
   * @harmoniclabs/cbor supports canonical encoding
   */
  encodeCanonical?(value: unknown): Uint8Array {
    // @harmoniclabs/cbor always encodes canonically
    return this.encode(value);
  }
}

// Example usage
if (require.main === module) {
  const adapter = new HarmoniclabsCborAdapter();

  console.log('Testing @harmoniclabs/cbor adapter...\n');

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

  // Test 3: Plutus Data constructor
  console.log('\nTest 3: Encode/decode Plutus Data {constructor: 0, fields: [1, 2]}');
  const plutusData = { constructor: 0, fields: [1, 2] };
  const bytes3 = adapter.encode(plutusData);
  console.log('  Encoded:', Array.from(bytes3).map(b => b.toString(16).padStart(2, '0')).join(''));
  const decoded3 = adapter.decode(bytes3);
  console.log('  Decoded:', JSON.stringify(decoded3));
  console.log('  Success:', JSON.stringify(decoded3) === JSON.stringify(plutusData));

  // Test 4: Map with integer key
  console.log('\nTest 4: Encode/decode map {1: 2}');
  const mapData = new Map([[1, 2]]);
  const bytes4 = adapter.encode(mapData);
  console.log('  Encoded:', Array.from(bytes4).map(b => b.toString(16).padStart(2, '0')).join(''));
  const decoded4 = adapter.decode(bytes4);
  console.log('  Decoded:', JSON.stringify(decoded4));
  console.log('  Success:', JSON.stringify(decoded4) === '{"1":2}');

  console.log('\n✓ Adapter tests complete!');
}
