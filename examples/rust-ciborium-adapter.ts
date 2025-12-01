/**
 * Rust ciborium Adapter for CBOR Test Suite
 * Implements the CBOREncoder interface using Rust's ciborium library via bridge binary
 */

import { CBOREncoder } from '../src/test-runner/types';
import { execSync } from 'child_process';
import * as path from 'path';

/**
 * Adapter for Rust ciborium library
 */
export class RustCiboriumAdapter implements CBOREncoder {
  name = 'rust-ciborium';
  version = '0.2.2';
  features = ['bigint', 'maps', 'typed-arrays', 'tags', 'deterministic', 'rust'];

  private rustBinaryPath: string;

  constructor() {
    this.rustBinaryPath = path.join(__dirname, '../external-libs/rust/target/release/cbor_bridge');
  }

  /**
   * Encode value to CBOR bytes using Rust ciborium
   */
  encode(value: unknown): Uint8Array {
    try {
      const jsonInput = JSON.stringify(value);
      const command = `echo '${jsonInput}' | ${this.rustBinaryPath} encode`;

      const result = execSync(command, {
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024 // 10MB
      });

      const response = JSON.parse(result);

      if (!response.success) {
        throw new Error(response.error || 'Unknown error');
      }

      // Convert hex string to Uint8Array
      const hex = response.result;
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
      }

      return bytes;
    } catch (error) {
      throw new Error(`rust-ciborium encode error: ${(error as Error).message}`);
    }
  }

  /**
   * Decode CBOR bytes to value using Rust ciborium
   */
  decode(bytes: Uint8Array): unknown {
    try {
      // Convert bytes to hex string
      const hex = Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      const command = `echo '${hex}' | ${this.rustBinaryPath} decode`;

      const result = execSync(command, {
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024 // 10MB
      });

      const response = JSON.parse(result);

      if (!response.success) {
        throw new Error(response.error || 'Unknown error');
      }

      return this.convertTypes(response.result);
    } catch (error) {
      throw new Error(`rust-ciborium decode error: ${(error as Error).message}`);
    }
  }

  /**
   * Convert types from Rust/JSON to expected test format
   */
  private convertTypes(value: any): any {
    if (value === null || value === undefined) {
      return value;
    }

    // Handle special CBOR byte string marker
    if (value && typeof value === 'object' && '__cbor_bytes__' in value) {
      return value.__cbor_bytes__;
    }

    // Handle special CBOR float marker
    if (value && typeof value === 'object' && '__cbor_float__' in value) {
      const floatStr = value.__cbor_float__;
      if (floatStr === 'NaN') return NaN;
      if (floatStr === 'Infinity') return Infinity;
      if (floatStr === '-Infinity') return -Infinity;
      return value;
    }

    // Handle special CBOR tag marker
    if (value && typeof value === 'object' && '__cbor_tag__' in value && '__cbor_value__' in value) {
      return {
        tag: value.__cbor_tag__,
        value: this.convertTypes(value.__cbor_value__)
      };
    }

    // Convert string numbers back to appropriate type
    if (typeof value === 'string' && /^-?\d+$/.test(value)) {
      const num = BigInt(value);
      // Keep as string if it's a large integer (beyond JS safe integer range)
      if (num > BigInt(Number.MAX_SAFE_INTEGER) || num < BigInt(Number.MIN_SAFE_INTEGER)) {
        return value; // Keep as string
      }
      // Convert to number if it fits safely
      return Number(value);
    }

    // Arrays
    if (Array.isArray(value)) {
      return value.map(v => this.convertTypes(v));
    }

    // Objects/Maps
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
   * ciborium supports deterministic encoding
   */
  encodeCanonical?(value: unknown): Uint8Array {
    // ciborium uses canonical encoding by default
    return this.encode(value);
  }
}

// Example usage
if (require.main === module) {
  const adapter = new RustCiboriumAdapter();

  console.log('Testing Rust ciborium adapter...\n');

  // Test 1: Simple integer
  console.log('Test 1: Encode/decode integer 42');
  const bytes1 = adapter.encode(42);
  console.log('  Encoded:', Array.from(bytes1).map(b => b.toString(16).padStart(2, '0')).join(''));
  const decoded1 = adapter.decode(bytes1);
  console.log('  Decoded:', decoded1);
  console.log('  Success:', decoded1 === 42);

  // Test 2: Large integer
  console.log('\nTest 2: Encode/decode large integer 18446744073709551615');
  const largeIntHex = '1bffffffffffffffff';
  const bytes2 = new Uint8Array(largeIntHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  const decoded2 = adapter.decode(bytes2);
  console.log('  Decoded:', decoded2);
  console.log('  Type:', typeof decoded2);
  console.log('  Success:', decoded2 === '18446744073709551615');

  // Test 3: Byte string
  console.log('\nTest 3: Decode byte string');
  const bytesHex = '450102030405';
  const bytes3 = new Uint8Array(bytesHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  const decoded3 = adapter.decode(bytes3);
  console.log('  Decoded:', decoded3);
  console.log('  Success:', decoded3 === '0102030405');

  // Test 4: Float Infinity
  console.log('\nTest 4: Decode float Infinity');
  const infHex = 'f97c00';
  const bytes4 = new Uint8Array(infHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  const decoded4 = adapter.decode(bytes4);
  console.log('  Decoded:', decoded4);
  console.log('  Success:', decoded4 === Infinity);

  console.log('\n✓ Adapter tests complete!');
}
