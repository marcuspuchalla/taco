/**
 * Python dag-cbor Adapter for CBOR Test Suite
 * Implements the CBOREncoder interface using Python's dag-cbor library via bridge script
 */

import { CBOREncoder } from '../src/test-runner/types';
import { execSync } from 'child_process';
import * as path from 'path';

/**
 * Adapter for Python dag-cbor library
 */
export class PythonDagCborAdapter implements CBOREncoder {
  name = 'python-dag-cbor';
  version = '0.3.3';
  features = ['bigint', 'maps', 'typed-arrays', 'deterministic', 'ipld', 'python'];

  private pythonPath: string;
  private bridgeScript: string;

  constructor() {
    this.pythonPath = path.join(__dirname, '../external-libs/python/venv/bin/python');
    this.bridgeScript = path.join(__dirname, '../external-libs/python/cbor_bridge.py');
  }

  /**
   * Encode value to CBOR bytes using Python dag-cbor
   */
  encode(value: unknown): Uint8Array {
    try {
      const jsonInput = JSON.stringify(value);
      const command = `echo '${jsonInput}' | ${this.pythonPath} ${this.bridgeScript} dag-cbor encode`;

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
      throw new Error(`python-dag-cbor encode error: ${(error as Error).message}`);
    }
  }

  /**
   * Decode CBOR bytes to value using Python dag-cbor
   */
  decode(bytes: Uint8Array): unknown {
    try {
      // Convert bytes to hex string
      const hex = Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      const command = `echo '${hex}' | ${this.pythonPath} ${this.bridgeScript} dag-cbor decode`;

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
      throw new Error(`python-dag-cbor decode error: ${(error as Error).message}`);
    }
  }

  /**
   * Convert types from Python/JSON to expected test format
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

    // Convert string numbers back to BigInt if they're large
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
   * dag-cbor is deterministic by design
   */
  encodeCanonical?(value: unknown): Uint8Array {
    return this.encode(value);
  }
}

// Example usage
if (require.main === module) {
  const adapter = new PythonDagCborAdapter();

  console.log('Testing Python dag-cbor adapter...\n');

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
