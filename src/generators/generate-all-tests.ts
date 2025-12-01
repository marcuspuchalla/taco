/**
 * Test Case Generator for CORE (CBOR Open Reference Evaluator)
 * Generates comprehensive test cases for all CBOR types and Cardano-specific patterns
 */

import * as fs from 'fs';
import * as path from 'path';

interface TestCase {
  id: string;
  category: string;
  description: string;
  inputHex: string;
  expectedOutput: any;
  diagnosticNotation: string;
  shouldSucceed: boolean;
  errorType?: string;
  complexity: 'trivial' | 'simple' | 'moderate' | 'complex' | 'extreme';
  tags?: string[];
  rfcSection?: string;
  cardanoRelevance?: string;
  cip?: string;
  notes?: string;
}

interface TestSuite {
  category: string;
  description: string;
  version: string;
  testCases: TestCase[];
}

// Helper: Convert bytes to hex string
function toHex(bytes: number[]): string {
  return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Helper: Encode CBOR unsigned integer
function encodeUint(n: number | bigint): number[] {
  const num = typeof n === 'bigint' ? n : BigInt(n);
  if (num < 0n) throw new Error('Must be non-negative');

  if (num <= 23n) {
    return [Number(num)];
  } else if (num <= 255n) {
    return [0x18, Number(num)];
  } else if (num <= 65535n) {
    return [0x19, Number(num >> 8n), Number(num & 0xFFn)];
  } else if (num <= 0xFFFFFFFFn) {
    return [0x1A,
      Number(num >> 24n),
      Number((num >> 16n) & 0xFFn),
      Number((num >> 8n) & 0xFFn),
      Number(num & 0xFFn)
    ];
  } else {
    return [0x1B,
      Number(num >> 56n),
      Number((num >> 48n) & 0xFFn),
      Number((num >> 40n) & 0xFFn),
      Number((num >> 32n) & 0xFFn),
      Number((num >> 24n) & 0xFFn),
      Number((num >> 16n) & 0xFFn),
      Number((num >> 8n) & 0xFFn),
      Number(num & 0xFFn)
    ];
  }
}

// Helper: Encode CBOR negative integer
function encodeNint(n: number | bigint): number[] {
  const num = typeof n === 'bigint' ? n : BigInt(n);
  if (num >= 0n) throw new Error('Must be negative');

  const value = -1n - num;
  const bytes = encodeUint(value);
  bytes[0] = (bytes[0] & 0x1F) | 0x20; // Change major type to 1
  return bytes;
}

// Helper: Encode byte string
function encodeBytes(data: number[]): number[] {
  const len = data.length;
  let header: number[];

  if (len <= 23) {
    header = [0x40 | len];
  } else if (len <= 255) {
    header = [0x58, len];
  } else if (len <= 65535) {
    header = [0x59, len >> 8, len & 0xFF];
  } else {
    header = [0x5A, (len >> 24) & 0xFF, (len >> 16) & 0xFF, (len >> 8) & 0xFF, len & 0xFF];
  }

  return [...header, ...data];
}

// Helper: Encode text string
function encodeText(text: string): number[] {
  const utf8 = Buffer.from(text, 'utf8');
  const bytes = Array.from(utf8);
  const len = bytes.length;

  let header: number[];
  if (len <= 23) {
    header = [0x60 | len];
  } else if (len <= 255) {
    header = [0x78, len];
  } else if (len <= 65535) {
    header = [0x79, len >> 8, len & 0xFF];
  } else {
    header = [0x7A, (len >> 24) & 0xFF, (len >> 16) & 0xFF, (len >> 8) & 0xFF, len & 0xFF];
  }

  return [...header, ...bytes];
}

// Helper: Encode array
function encodeArray(items: number[][]): number[] {
  const len = items.length;
  let header: number[];

  if (len <= 23) {
    header = [0x80 | len];
  } else if (len <= 255) {
    header = [0x98, len];
  } else if (len <= 65535) {
    header = [0x99, len >> 8, len & 0xFF];
  } else {
    header = [0x9A, (len >> 24) & 0xFF, (len >> 16) & 0xFF, (len >> 8) & 0xFF, len & 0xFF];
  }

  return [...header, ...items.flat()];
}

// Helper: Encode map
function encodeMap(pairs: Array<[number[], number[]]>): number[] {
  const len = pairs.length;
  let header: number[];

  if (len <= 23) {
    header = [0xA0 | len];
  } else if (len <= 255) {
    header = [0xB8, len];
  } else if (len <= 65535) {
    header = [0xB9, len >> 8, len & 0xFF];
  } else {
    header = [0xBA, (len >> 24) & 0xFF, (len >> 16) & 0xFF, (len >> 8) & 0xFF, len & 0xFF];
  }

  return [...header, ...pairs.flat(2)];
}

// Helper: Encode tag
function encodeTag(tag: number, content: number[]): number[] {
  const tagBytes = encodeUint(tag);
  tagBytes[0] = (tagBytes[0] & 0x1F) | 0xC0; // Change major type to 6
  return [...tagBytes, ...content];
}

// Helper: Encode simple value
function encodeSimple(value: number): number[] {
  if (value <= 23) {
    return [0xE0 | value];
  } else {
    return [0xF8, value];
  }
}

// ============================================================================
// BYTE STRING TEST GENERATORS
// ============================================================================

function generateByteStringTests(): TestSuite {
  const testCases: TestCase[] = [];

  // Empty byte string
  testCases.push({
    id: 'bytes-000',
    category: 'byte-strings',
    description: 'Empty byte string',
    inputHex: '40',
    expectedOutput: '',
    diagnosticNotation: "h''",
    shouldSucceed: true,
    complexity: 'trivial',
    tags: ['empty', 'boundary'],
    cardanoRelevance: 'Empty asset names, empty metadata fields'
  });

  // Single byte
  testCases.push({
    id: 'bytes-001',
    category: 'byte-strings',
    description: 'Single byte: 0x00',
    inputHex: toHex(encodeBytes([0x00])),
    expectedOutput: '00',
    diagnosticNotation: "h'00'",
    shouldSucceed: true,
    complexity: 'trivial',
    tags: ['single-byte']
  });

  testCases.push({
    id: 'bytes-002',
    category: 'byte-strings',
    description: 'Single byte: 0xFF',
    inputHex: toHex(encodeBytes([0xFF])),
    expectedOutput: 'ff',
    diagnosticNotation: "h'FF'",
    shouldSucceed: true,
    complexity: 'trivial',
    tags: ['single-byte']
  });

  // Short byte strings (< 24 bytes)
  testCases.push({
    id: 'bytes-004',
    category: 'byte-strings',
    description: '4 bytes: 0x01020304',
    inputHex: toHex(encodeBytes([0x01, 0x02, 0x03, 0x04])),
    expectedOutput: '01020304',
    diagnosticNotation: "h'01020304'",
    shouldSucceed: true,
    complexity: 'simple',
    tags: ['short']
  });

  // Ed25519 public key (32 bytes)
  const pubkey = Array(32).fill(0).map((_, i) => i);
  testCases.push({
    id: 'bytes-032-ed25519-pubkey',
    category: 'byte-strings',
    description: 'Ed25519 public key (32 bytes)',
    inputHex: toHex(encodeBytes(pubkey)),
    expectedOutput: toHex(pubkey),
    diagnosticNotation: `h'${toHex(pubkey)}'`,
    shouldSucceed: true,
    complexity: 'simple',
    tags: ['cardano', 'ed25519', 'pubkey'],
    cardanoRelevance: 'Ed25519 public keys are 32 bytes'
  });

  // Ed25519 signature (64 bytes)
  const signature = Array(64).fill(0).map((_, i) => i % 256);
  testCases.push({
    id: 'bytes-064-ed25519-signature',
    category: 'byte-strings',
    description: 'Ed25519 signature (64 bytes)',
    inputHex: toHex(encodeBytes(signature)),
    expectedOutput: toHex(signature),
    diagnosticNotation: `h'${toHex(signature).slice(0, 16)}...'`,
    shouldSucceed: true,
    complexity: 'simple',
    tags: ['cardano', 'ed25519', 'signature'],
    cardanoRelevance: 'Ed25519 signatures are 64 bytes'
  });

  // Transaction hash (32 bytes, Blake2b-256)
  testCases.push({
    id: 'bytes-032-tx-hash',
    category: 'byte-strings',
    description: 'Transaction hash (32 bytes)',
    inputHex: toHex(encodeBytes(Array(32).fill(0xAB))),
    expectedOutput: 'ab'.repeat(32),
    diagnosticNotation: `h'${'AB'.repeat(32)}'`,
    shouldSucceed: true,
    complexity: 'simple',
    tags: ['cardano', 'hash', 'blake2b'],
    cardanoRelevance: 'Transaction hashes are Blake2b-256 (32 bytes)'
  });

  // Policy ID (28 bytes)
  testCases.push({
    id: 'bytes-028-policy-id',
    category: 'byte-strings',
    description: 'Policy ID (28 bytes)',
    inputHex: toHex(encodeBytes(Array(28).fill(0xCD))),
    expectedOutput: 'cd'.repeat(28),
    diagnosticNotation: `h'${'CD'.repeat(28)}'`,
    shouldSucceed: true,
    complexity: 'simple',
    tags: ['cardano', 'policy-id', 'native-asset'],
    cardanoRelevance: 'Policy IDs are 28 bytes'
  });

  // Asset name max length (32 bytes)
  testCases.push({
    id: 'bytes-032-asset-name-max',
    category: 'byte-strings',
    description: 'Asset name at max length (32 bytes)',
    inputHex: toHex(encodeBytes(Array(32).fill(0x41))), // All 'A's
    expectedOutput: '41'.repeat(32),
    diagnosticNotation: `h'${'41'.repeat(32)}'`,
    shouldSucceed: true,
    complexity: 'simple',
    tags: ['cardano', 'asset-name', 'boundary'],
    cardanoRelevance: 'Asset names can be 0-32 bytes'
  });

  // Longer byte strings
  testCases.push({
    id: 'bytes-255',
    category: 'byte-strings',
    description: '255 bytes (maximum for 1-byte length)',
    inputHex: toHex(encodeBytes(Array(255).fill(0xFF))),
    expectedOutput: 'ff'.repeat(255),
    diagnosticNotation: `h'${'FF'.repeat(8)}...'`,
    shouldSucceed: true,
    complexity: 'moderate',
    tags: ['boundary', 'long']
  });

  testCases.push({
    id: 'bytes-256',
    category: 'byte-strings',
    description: '256 bytes (minimum for 2-byte length)',
    inputHex: toHex(encodeBytes(Array(256).fill(0x00))),
    expectedOutput: '00'.repeat(256),
    diagnosticNotation: `h'${'00'.repeat(8)}...'`,
    shouldSucceed: true,
    complexity: 'moderate',
    tags: ['boundary', 'long']
  });

  // Indefinite-length byte string
  testCases.push({
    id: 'bytes-indefinite-simple',
    category: 'byte-strings',
    description: 'Indefinite-length byte string with 2 chunks',
    inputHex: '5f42010243030405ff',
    expectedOutput: '0102030405',
    diagnosticNotation: "(_ h'0102', h'030405')",
    shouldSucceed: true,
    complexity: 'moderate',
    tags: ['indefinite', 'chunked'],
    notes: 'Indefinite-length not allowed in canonical encoding'
  });

  // Truncated byte string
  testCases.push({
    id: 'bytes-truncated',
    category: 'byte-strings',
    description: 'Truncated: Length 4 but only 2 bytes provided',
    inputHex: '440102',
    expectedOutput: null,
    diagnosticNotation: '<truncated>',
    shouldSucceed: false,
    errorType: 'truncated',
    complexity: 'simple',
    tags: ['malformed', 'negative-test', 'truncated']
  });

  // Nested indefinite (invalid)
  testCases.push({
    id: 'bytes-nested-indefinite',
    category: 'byte-strings',
    description: 'Invalid: Nested indefinite byte strings',
    inputHex: '5f5f4101ff42020 3ff',
    expectedOutput: null,
    diagnosticNotation: '<invalid>',
    shouldSucceed: false,
    errorType: 'nested-indefinite',
    complexity: 'moderate',
    tags: ['malformed', 'negative-test'],
    notes: 'Indefinite byte strings cannot contain indefinite chunks'
  });

  return {
    category: 'byte-strings',
    description: 'RFC 8949 Major Type 2: Byte String Tests',
    version: '1.0',
    testCases
  };
}

// ============================================================================
// TEXT STRING TEST GENERATORS
// ============================================================================

function generateTextStringTests(): TestSuite {
  const testCases: TestCase[] = [];

  // Empty string
  testCases.push({
    id: 'text-000',
    category: 'text-strings',
    description: 'Empty text string',
    inputHex: '60',
    expectedOutput: '',
    diagnosticNotation: '""',
    shouldSucceed: true,
    complexity: 'trivial',
    tags: ['empty', 'boundary']
  });

  // ASCII strings
  testCases.push({
    id: 'text-ascii-hello',
    category: 'text-strings',
    description: 'ASCII: "Hello"',
    inputHex: toHex(encodeText('Hello')),
    expectedOutput: 'Hello',
    diagnosticNotation: '"Hello"',
    shouldSucceed: true,
    complexity: 'trivial',
    tags: ['ascii', 'basic']
  });

  testCases.push({
    id: 'text-ascii-alphabet',
    category: 'text-strings',
    description: 'ASCII: Full lowercase alphabet',
    inputHex: toHex(encodeText('abcdefghijklmnopqrstuvwxyz')),
    expectedOutput: 'abcdefghijklmnopqrstuvwxyz',
    diagnosticNotation: '"abcdefghijklmnopqrstuvwxyz"',
    shouldSucceed: true,
    complexity: 'simple',
    tags: ['ascii']
  });

  // UTF-8 multi-byte characters
  testCases.push({
    id: 'text-utf8-euro',
    category: 'text-strings',
    description: 'UTF-8: Euro sign (€)',
    inputHex: toHex(encodeText('€')),
    expectedOutput: '€',
    diagnosticNotation: '"\\u20AC"',
    shouldSucceed: true,
    complexity: 'simple',
    tags: ['utf8', 'multi-byte'],
    notes: '3-byte UTF-8 sequence'
  });

  testCases.push({
    id: 'text-utf8-emoji-rocket',
    category: 'text-strings',
    description: 'UTF-8: Rocket emoji (🚀)',
    inputHex: toHex(encodeText('🚀')),
    expectedOutput: '🚀',
    diagnosticNotation: '"\\u{1F680}"',
    shouldSucceed: true,
    complexity: 'simple',
    tags: ['utf8', 'emoji', 'multi-byte'],
    notes: '4-byte UTF-8 sequence',
    cardanoRelevance: 'NFT metadata may contain emojis'
  });

  testCases.push({
    id: 'text-utf8-emoji-alien',
    category: 'text-strings',
    description: 'UTF-8: Alien emoji (👾)',
    inputHex: toHex(encodeText('👾')),
    expectedOutput: '👾',
    diagnosticNotation: '"\\u{1F47E}"',
    shouldSucceed: true,
    complexity: 'simple',
    tags: ['utf8', 'emoji', 'multi-byte']
  });

  testCases.push({
    id: 'text-utf8-chinese',
    category: 'text-strings',
    description: 'UTF-8: Chinese characters (中文)',
    inputHex: toHex(encodeText('中文')),
    expectedOutput: '中文',
    diagnosticNotation: '"中文"',
    shouldSucceed: true,
    complexity: 'simple',
    tags: ['utf8', 'cjk', 'multi-byte'],
    cardanoRelevance: 'International NFT metadata'
  });

  testCases.push({
    id: 'text-utf8-mixed',
    category: 'text-strings',
    description: 'UTF-8: Mixed ASCII and multi-byte',
    inputHex: toHex(encodeText('Hello 世界 🌍')),
    expectedOutput: 'Hello 世界 🌍',
    diagnosticNotation: '"Hello 世界 🌍"',
    shouldSucceed: true,
    complexity: 'moderate',
    tags: ['utf8', 'mixed', 'multi-byte']
  });

  // Cardano-relevant strings
  testCases.push({
    id: 'text-asset-name',
    category: 'text-strings',
    description: 'Asset name: "TokenName"',
    inputHex: toHex(encodeText('TokenName')),
    expectedOutput: 'TokenName',
    diagnosticNotation: '"TokenName"',
    shouldSucceed: true,
    complexity: 'simple',
    tags: ['cardano', 'asset-name'],
    cardanoRelevance: 'Text-based asset names'
  });

  testCases.push({
    id: 'text-nft-name',
    category: 'text-strings',
    description: 'NFT name from CIP-25',
    inputHex: toHex(encodeText('My Awesome NFT #1234')),
    expectedOutput: 'My Awesome NFT #1234',
    diagnosticNotation: '"My Awesome NFT #1234"',
    shouldSucceed: true,
    complexity: 'simple',
    tags: ['cardano', 'nft', 'cip-25'],
    cardanoRelevance: 'CIP-25 NFT metadata name field',
    cip: 'CIP-25'
  });

  testCases.push({
    id: 'text-ipfs-uri',
    category: 'text-strings',
    description: 'IPFS URI',
    inputHex: toHex(encodeText('ipfs://QmXnnyufdzAWL5CqZ2RnSNgPbvCc1ALT73s6epPrRnZ1Xy')),
    expectedOutput: 'ipfs://QmXnnyufdzAWL5CqZ2RnSNgPbvCc1ALT73s6epPrRnZ1Xy',
    diagnosticNotation: '"ipfs://Qm..."',
    shouldSucceed: true,
    complexity: 'simple',
    tags: ['cardano', 'ipfs', 'uri', 'nft'],
    cardanoRelevance: 'NFT image references in CIP-25'
  });

  // Indefinite-length text string
  testCases.push({
    id: 'text-indefinite',
    category: 'text-strings',
    description: 'Indefinite-length: "Hello" + " " + "World"',
    inputHex: '7f6548656c6c6f6120656657 6f726c64ff',
    expectedOutput: 'Hello World',
    diagnosticNotation: '(_ "Hello", " ", "World")',
    shouldSucceed: true,
    complexity: 'moderate',
    tags: ['indefinite', 'chunked'],
    notes: 'Not allowed in canonical encoding'
  });

  // Invalid UTF-8
  testCases.push({
    id: 'text-invalid-utf8-overlong',
    category: 'text-strings',
    description: 'Invalid UTF-8: Overlong encoding',
    inputHex: '63c08041',
    expectedOutput: null,
    diagnosticNotation: '<invalid-utf8>',
    shouldSucceed: false,
    errorType: 'invalid-utf8',
    complexity: 'moderate',
    tags: ['malformed', 'negative-test', 'utf8'],
    notes: 'Overlong encoding of NULL character'
  });

  testCases.push({
    id: 'text-invalid-utf8-surrogate',
    category: 'text-strings',
    description: 'Invalid UTF-8: Surrogate half',
    inputHex: '63eda080',
    expectedOutput: null,
    diagnosticNotation: '<invalid-utf8>',
    shouldSucceed: false,
    errorType: 'invalid-utf8',
    complexity: 'moderate',
    tags: ['malformed', 'negative-test', 'utf8'],
    notes: 'Surrogate halves (U+D800-U+DFFF) are invalid in UTF-8'
  });

  testCases.push({
    id: 'text-invalid-utf8-truncated',
    category: 'text-strings',
    description: 'Invalid UTF-8: Truncated multi-byte sequence',
    inputHex: '62e282',
    expectedOutput: null,
    diagnosticNotation: '<invalid-utf8>',
    shouldSucceed: false,
    errorType: 'invalid-utf8',
    complexity: 'simple',
    tags: ['malformed', 'negative-test', 'utf8'],
    notes: 'Incomplete 3-byte UTF-8 sequence'
  });

  // Truncated text string
  testCases.push({
    id: 'text-truncated',
    category: 'text-strings',
    description: 'Truncated: Length 5 but only 3 bytes',
    inputHex: '65486568',
    expectedOutput: null,
    diagnosticNotation: '<truncated>',
    shouldSucceed: false,
    errorType: 'truncated',
    complexity: 'simple',
    tags: ['malformed', 'negative-test', 'truncated']
  });

  return {
    category: 'text-strings',
    description: 'RFC 8949 Major Type 3: Text String Tests',
    version: '1.0',
    testCases
  };
}

// ============================================================================
// ARRAY TEST GENERATORS
// ============================================================================

function generateArrayTests(): TestSuite {
  const testCases: TestCase[] = [];

  // Empty array
  testCases.push({
    id: 'array-000',
    category: 'arrays',
    description: 'Empty array',
    inputHex: '80',
    expectedOutput: [],
    diagnosticNotation: '[]',
    shouldSucceed: true,
    complexity: 'trivial',
    tags: ['empty', 'boundary'],
    cardanoRelevance: 'Empty witness sets, empty arrays in Plutus Data'
  });

  // Simple arrays
  testCases.push({
    id: 'array-single',
    category: 'arrays',
    description: 'Single element: [1]',
    inputHex: '8101',
    expectedOutput: [1],
    diagnosticNotation: '[1]',
    shouldSucceed: true,
    complexity: 'trivial',
    tags: ['basic']
  });

  testCases.push({
    id: 'array-integers',
    category: 'arrays',
    description: 'Simple integers: [1, 2, 3]',
    inputHex: '83010203',
    expectedOutput: [1, 2, 3],
    diagnosticNotation: '[1, 2, 3]',
    shouldSucceed: true,
    complexity: 'simple',
    tags: ['basic', 'homogeneous']
  });

  testCases.push({
    id: 'array-range-1-10',
    category: 'arrays',
    description: 'Range: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]',
    inputHex: '8a0102030405060708090a',
    expectedOutput: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    diagnosticNotation: '[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]',
    shouldSucceed: true,
    complexity: 'simple',
    tags: ['homogeneous']
  });

  // Mixed type arrays
  testCases.push({
    id: 'array-mixed',
    category: 'arrays',
    description: 'Mixed types: [1, "hello", true]',
    inputHex: '83016568656c6c6ff5',
    expectedOutput: [1, 'hello', true],
    diagnosticNotation: '[1, "hello", true]',
    shouldSucceed: true,
    complexity: 'simple',
    tags: ['heterogeneous', 'mixed'],
    cardanoRelevance: 'Plutus Data lists can contain mixed types'
  });

  // Nested arrays
  testCases.push({
    id: 'array-nested-2d',
    category: 'arrays',
    description: 'Nested 2D: [[1, 2], [3, 4]]',
    inputHex: '828201028203 04',
    expectedOutput: [[1, 2], [3, 4]],
    diagnosticNotation: '[[1, 2], [3, 4]]',
    shouldSucceed: true,
    complexity: 'moderate',
    tags: ['nested', '2d']
  });

  testCases.push({
    id: 'array-nested-3d',
    category: 'arrays',
    description: 'Nested 3D: [[[1]]]',
    inputHex: '818181 01',
    expectedOutput: [[[1]]],
    diagnosticNotation: '[[[1]]]',
    shouldSucceed: true,
    complexity: 'moderate',
    tags: ['nested', '3d']
  });

  testCases.push({
    id: 'array-deeply-nested',
    category: 'arrays',
    description: 'Deeply nested: 10 levels',
    inputHex: '81'.repeat(10) + '01',
    expectedOutput: JSON.parse('['.repeat(10) + '1' + ']'.repeat(10)),
    diagnosticNotation: '[' + '['.repeat(9) + '1' + ']'.repeat(10),
    shouldSucceed: true,
    complexity: 'complex',
    tags: ['nested', 'deep'],
    notes: 'Tests stack depth handling'
  });

  // Cardano-specific patterns
  testCases.push({
    id: 'array-tx-input',
    category: 'arrays',
    description: 'Transaction input structure: [txId, index]',
    inputHex: toHex(encodeArray([
      encodeBytes(Array(32).fill(0xAB)),
      encodeUint(0)
    ])),
    expectedOutput: [toHex(Array(32).fill(0xAB)), 0],
    diagnosticNotation: '[h\'ABAB...\', 0]',
    shouldSucceed: true,
    complexity: 'simple',
    tags: ['cardano', 'transaction', 'input'],
    cardanoRelevance: 'Transaction input structure'
  });

  testCases.push({
    id: 'array-plutus-constructor-fields',
    category: 'arrays',
    description: 'Plutus constructor fields: [1, 2, 3]',
    inputHex: '83010203',
    expectedOutput: [1, 2, 3],
    diagnosticNotation: '[1, 2, 3]',
    shouldSucceed: true,
    complexity: 'simple',
    tags: ['cardano', 'plutus', 'constructor'],
    cardanoRelevance: 'Fields array in Plutus Data constructors'
  });

  // Indefinite-length array
  testCases.push({
    id: 'array-indefinite',
    category: 'arrays',
    description: 'Indefinite-length: [_ 1, 2, 3]',
    inputHex: '9f010203ff',
    expectedOutput: [1, 2, 3],
    diagnosticNotation: '[_ 1, 2, 3]',
    shouldSucceed: true,
    complexity: 'moderate',
    tags: ['indefinite'],
    notes: 'Not allowed in canonical encoding'
  });

  // Large array
  testCases.push({
    id: 'array-100-elements',
    category: 'arrays',
    description: '100 elements: [0, 1, 2, ..., 99]',
    inputHex: toHex(encodeArray(Array.from({length: 100}, (_, i) => encodeUint(i)))),
    expectedOutput: Array.from({length: 100}, (_, i) => i),
    diagnosticNotation: '[0, 1, 2, ..., 99]',
    shouldSucceed: true,
    complexity: 'moderate',
    tags: ['large', 'performance']
  });

  // Truncated array
  testCases.push({
    id: 'array-truncated',
    category: 'arrays',
    description: 'Truncated: Length 3 but only 2 elements',
    inputHex: '830102',
    expectedOutput: null,
    diagnosticNotation: '<truncated>',
    shouldSucceed: false,
    errorType: 'truncated',
    complexity: 'simple',
    tags: ['malformed', 'negative-test', 'truncated']
  });

  return {
    category: 'arrays',
    description: 'RFC 8949 Major Type 4: Array Tests',
    version: '1.0',
    testCases
  };
}

// ============================================================================
// MAP TEST GENERATORS
// ============================================================================

function generateMapTests(): TestSuite {
  const testCases: TestCase[] = [];

  // Empty map
  testCases.push({
    id: 'map-000',
    category: 'maps',
    description: 'Empty map',
    inputHex: 'a0',
    expectedOutput: {},
    diagnosticNotation: '{}',
    shouldSucceed: true,
    complexity: 'trivial',
    tags: ['empty', 'boundary'],
    cardanoRelevance: 'Empty metadata maps, empty Plutus Data maps'
  });

  // Simple maps
  testCases.push({
    id: 'map-single-int-key',
    category: 'maps',
    description: 'Single entry with integer key: {1: 2}',
    inputHex: 'a10102',
    expectedOutput: {'1': 2},
    diagnosticNotation: '{1: 2}',
    shouldSucceed: true,
    complexity: 'simple',
    tags: ['basic', 'integer-key'],
    notes: 'JSON represents keys as strings'
  });

  testCases.push({
    id: 'map-simple-text-keys',
    category: 'maps',
    description: 'Text keys: {"a": 1, "b": 2}',
    inputHex: 'a26161016162 02',
    expectedOutput: {'a': 1, 'b': 2},
    diagnosticNotation: '{"a": 1, "b": 2}',
    shouldSucceed: true,
    complexity: 'simple',
    tags: ['basic', 'text-key']
  });

  testCases.push({
    id: 'map-integer-keys',
    category: 'maps',
    description: 'Multiple integer keys: {0: "a", 1: "b", 2: "c"}',
    inputHex: 'a3006161016162026163',
    expectedOutput: {'0': 'a', '1': 'b', '2': 'c'},
    diagnosticNotation: '{0: "a", 1: "b", 2: "c"}',
    shouldSucceed: true,
    complexity: 'simple',
    tags: ['integer-key', 'text-value'],
    cardanoRelevance: 'Transaction body uses integer keys'
  });

  // Mixed key types
  testCases.push({
    id: 'map-mixed-key-types',
    category: 'maps',
    description: 'Mixed key types: {1: "a", "b": 2}',
    inputHex: 'a201616161620 2',
    expectedOutput: {'1': 'a', 'b': 2},
    diagnosticNotation: '{1: "a", "b": 2}',
    shouldSucceed: true,
    complexity: 'moderate',
    tags: ['mixed-keys', 'heterogeneous']
  });

  // Nested maps
  testCases.push({
    id: 'map-nested',
    category: 'maps',
    description: 'Nested map: {"a": {"b": 1}}',
    inputHex: 'a16161a161620 1',
    expectedOutput: {'a': {'b': 1}},
    diagnosticNotation: '{"a": {"b": 1}}',
    shouldSucceed: true,
    complexity: 'moderate',
    tags: ['nested']
  });

  testCases.push({
    id: 'map-multi-asset',
    category: 'maps',
    description: 'Multi-asset structure (nested maps)',
    inputHex: toHex(encodeMap([
      [encodeBytes(Array(28).fill(0xAA)), encodeMap([
        [encodeBytes([0x54, 0x6F, 0x6B, 0x65, 0x6E]), encodeUint(100)]
      ])]
    ])),
    expectedOutput: {
      ['aa'.repeat(28)]: {
        '546f6b656e': 100
      }
    },
    diagnosticNotation: '{h\'AA...\': {h\'Token\': 100}}',
    shouldSucceed: true,
    complexity: 'complex',
    tags: ['cardano', 'multi-asset', 'nested'],
    cardanoRelevance: 'Multi-asset value encoding: policy -> asset -> amount'
  });

  // Cardano transaction body structure
  testCases.push({
    id: 'map-tx-body-minimal',
    category: 'maps',
    description: 'Minimal transaction body: {0: inputs, 1: outputs, 2: fee}',
    inputHex: 'a300800180021a000f4240',
    expectedOutput: {
      '0': [],
      '1': [],
      '2': 1000000
    },
    diagnosticNotation: '{0: [], 1: [], 2: 1000000}',
    shouldSucceed: true,
    complexity: 'moderate',
    tags: ['cardano', 'transaction', 'tx-body'],
    cardanoRelevance: 'Transaction body structure with integer keys'
  });

  // Canonical key ordering
  testCases.push({
    id: 'map-canonical-sorted',
    category: 'maps',
    description: 'Canonically sorted keys: {"aa": 1, "b": 2}',
    inputHex: 'a2616201626161 01',
    expectedOutput: {'b': 2, 'aa': 1},
    diagnosticNotation: '{"b": 2, "aa": 1}',
    shouldSucceed: true,
    complexity: 'moderate',
    tags: ['canonical', 'sorted'],
    notes: 'Keys sorted by length first (1-byte "b" before 2-byte "aa"), then lexicographic'
  });

  testCases.push({
    id: 'map-non-canonical-unsorted',
    category: 'maps',
    description: 'Non-canonical: Unsorted keys',
    inputHex: 'a2626161016162 02',
    expectedOutput: {'aa': 1, 'b': 2},
    diagnosticNotation: '{"aa": 1, "b": 2}',
    shouldSucceed: true,
    complexity: 'moderate',
    tags: ['non-canonical', 'unsorted', 'negative-test'],
    errorType: 'unsorted-keys',
    notes: 'Valid CBOR but not canonical - keys should be sorted'
  });

  // Duplicate keys
  testCases.push({
    id: 'map-duplicate-keys',
    category: 'maps',
    description: 'Duplicate keys: {"a": 1, "a": 2}',
    inputHex: 'a2616101616102',
    expectedOutput: {'a': 2},
    diagnosticNotation: '{"a": 1, "a": 2}',
    shouldSucceed: true,
    complexity: 'moderate',
    tags: ['duplicate-keys', 'negative-test'],
    errorType: 'duplicate-keys',
    notes: 'Last value wins, but not allowed in canonical encoding'
  });

  // Indefinite-length map
  testCases.push({
    id: 'map-indefinite',
    category: 'maps',
    description: 'Indefinite-length: {_ "a": 1, "b": 2}',
    inputHex: 'bf616101616202ff',
    expectedOutput: {'a': 1, 'b': 2},
    diagnosticNotation: '{_ "a": 1, "b": 2}',
    shouldSucceed: true,
    complexity: 'moderate',
    tags: ['indefinite'],
    notes: 'Not allowed in canonical encoding'
  });

  // Truncated map
  testCases.push({
    id: 'map-truncated-odd-elements',
    category: 'maps',
    description: 'Malformed: Odd number of elements (key without value)',
    inputHex: 'a1616 1',
    expectedOutput: null,
    diagnosticNotation: '<malformed>',
    shouldSucceed: false,
    errorType: 'odd-length-map',
    complexity: 'simple',
    tags: ['malformed', 'negative-test', 'truncated']
  });

  // Large map
  testCases.push({
    id: 'map-100-entries',
    category: 'maps',
    description: '100 entries: {0: 0, 1: 1, ..., 99: 99}',
    inputHex: toHex(encodeMap(
      Array.from({length: 100}, (_, i) => [encodeUint(i), encodeUint(i)])
    )),
    expectedOutput: Object.fromEntries(
      Array.from({length: 100}, (_, i) => [i.toString(), i])
    ),
    diagnosticNotation: '{0: 0, 1: 1, ..., 99: 99}',
    shouldSucceed: true,
    complexity: 'moderate',
    tags: ['large', 'performance']
  });

  return {
    category: 'maps',
    description: 'RFC 8949 Major Type 5: Map Tests',
    version: '1.0',
    testCases
  };
}

// ============================================================================
// TAG TEST GENERATORS
// ============================================================================

function generateTagTests(): TestSuite {
  const testCases: TestCase[] = [];

  // Standard tags
  testCases.push({
    id: 'tag-000-datetime',
    category: 'tags',
    description: 'Tag 0: RFC 3339 date-time string',
    inputHex: toHex(encodeTag(0, encodeText('2024-10-26T12:00:00Z'))),
    expectedOutput: '2024-10-26T12:00:00Z',
    diagnosticNotation: '0("2024-10-26T12:00:00Z")',
    shouldSucceed: true,
    complexity: 'simple',
    tags: ['datetime', 'rfc3339'],
    rfcSection: '3.4.1'
  });

  testCases.push({
    id: 'tag-001-epoch',
    category: 'tags',
    description: 'Tag 1: Unix epoch timestamp',
    inputHex: toHex(encodeTag(1, encodeUint(1698364800))),
    expectedOutput: 1698364800,
    diagnosticNotation: '1(1698364800)',
    shouldSucceed: true,
    complexity: 'simple',
    tags: ['timestamp', 'epoch'],
    rfcSection: '3.4.2',
    cardanoRelevance: 'Slot times in metadata'
  });

  // Bignum tags
  testCases.push({
    id: 'tag-002-positive-bignum',
    category: 'tags',
    description: 'Tag 2: Positive bignum (2^64)',
    inputHex: 'c249010000000000000000',
    expectedOutput: '18446744073709551616',
    diagnosticNotation: '2(h\'010000000000000000\')',
    shouldSucceed: true,
    complexity: 'moderate',
    tags: ['bignum', 'large-integer'],
    rfcSection: '3.4.3',
    cardanoRelevance: 'Large ADA amounts, Plutus Data integers'
  });

  testCases.push({
    id: 'tag-003-negative-bignum',
    category: 'tags',
    description: 'Tag 3: Negative bignum (-2^64 - 1)',
    inputHex: 'c349010000000000000000',
    expectedOutput: '-18446744073709551617',
    diagnosticNotation: '3(h\'010000000000000000\')',
    shouldSucceed: true,
    complexity: 'moderate',
    tags: ['bignum', 'large-integer', 'negative'],
    rfcSection: '3.4.3'
  });

  // Self-describe CBOR
  testCases.push({
    id: 'tag-55799-self-describe',
    category: 'tags',
    description: 'Tag 55799: Self-describe CBOR magic',
    inputHex: toHex(encodeTag(55799, encodeArray([encodeUint(1), encodeUint(2)]))),
    expectedOutput: [1, 2],
    diagnosticNotation: '55799([1, 2])',
    shouldSucceed: true,
    complexity: 'simple',
    tags: ['self-describe', 'magic'],
    rfcSection: '3.4.6',
    notes: 'Used to identify CBOR data unambiguously'
  });

  // Cardano-specific tags
  testCases.push({
    id: 'tag-121-constructor-0',
    category: 'tags',
    description: 'Tag 121: Plutus Data constructor 0',
    inputHex: 'd879820102',
    expectedOutput: {constructor: 0, fields: [1, 2]},
    diagnosticNotation: '121([1, 2])',
    shouldSucceed: true,
    complexity: 'simple',
    tags: ['cardano', 'plutus', 'constructor'],
    cardanoRelevance: 'Plutus Data constructor alternative 0'
  });

  testCases.push({
    id: 'tag-122-constructor-1',
    category: 'tags',
    description: 'Tag 122: Plutus Data constructor 1',
    inputHex: 'd87a820304',
    expectedOutput: {constructor: 1, fields: [3, 4]},
    diagnosticNotation: '122([3, 4])',
    shouldSucceed: true,
    complexity: 'simple',
    tags: ['cardano', 'plutus', 'constructor'],
    cardanoRelevance: 'Plutus Data constructor alternative 1'
  });

  testCases.push({
    id: 'tag-102-general-constructor',
    category: 'tags',
    description: 'Tag 102: Plutus Data general constructor',
    inputHex: 'd86682078001 0203',
    expectedOutput: {constructor: 7, fields: [1, 2, 3]},
    diagnosticNotation: '102([7, [1, 2, 3]])',
    shouldSucceed: true,
    complexity: 'moderate',
    tags: ['cardano', 'plutus', 'constructor'],
    cardanoRelevance: 'Plutus Data constructor for alternatives >= 7'
  });

  testCases.push({
    id: 'tag-258-set',
    category: 'tags',
    description: 'Tag 258: Set {1, 2, 3}',
    inputHex: 'd90102 83010203',
    expectedOutput: [1, 2, 3],
    diagnosticNotation: '258([1, 2, 3])',
    shouldSucceed: true,
    complexity: 'simple',
    tags: ['cardano', 'set', 'ordered'],
    cardanoRelevance: 'Transaction input sets, required signers',
    notes: 'Elements must be unique and sorted'
  });

  testCases.push({
    id: 'tag-024-cbor-in-cbor',
    category: 'tags',
    description: 'Tag 24: CBOR-in-CBOR (embedded)',
    inputHex: toHex(encodeTag(24, encodeBytes([0x83, 0x01, 0x02, 0x03]))),
    expectedOutput: '83010203',
    diagnosticNotation: '24(h\'83010203\')',
    shouldSucceed: true,
    complexity: 'moderate',
    tags: ['cardano', 'embedded', 'cbor-in-cbor'],
    rfcSection: '3.4.5.1',
    cardanoRelevance: 'Datum and redeemer encoding in transactions'
  });

  // Nested tags
  testCases.push({
    id: 'tag-nested',
    category: 'tags',
    description: 'Nested tags: 258(121([1]))',
    inputHex: toHex(encodeTag(258, encodeArray([encodeTag(121, encodeArray([encodeUint(1)]))]))),
    expectedOutput: [{constructor: 0, fields: [1]}],
    diagnosticNotation: '258([121([1])])',
    shouldSucceed: true,
    complexity: 'complex',
    tags: ['cardano', 'nested', 'plutus', 'set'],
    cardanoRelevance: 'Set of Plutus Data constructors'
  });

  // Unknown tag
  testCases.push({
    id: 'tag-unknown',
    category: 'tags',
    description: 'Unknown tag: 9999',
    inputHex: toHex(encodeTag(9999, encodeUint(42))),
    expectedOutput: 42,
    diagnosticNotation: '9999(42)',
    shouldSucceed: true,
    complexity: 'simple',
    tags: ['unknown'],
    notes: 'Decoders should accept unknown tags and process content'
  });

  // Invalid tag content
  testCases.push({
    id: 'tag-001-invalid-content',
    category: 'tags',
    description: 'Tag 1 with invalid content (expects integer, got string)',
    inputHex: toHex(encodeTag(1, encodeText('not a number'))),
    expectedOutput: null,
    diagnosticNotation: '1("not a number")',
    shouldSucceed: false,
    errorType: 'invalid-tag-content',
    complexity: 'moderate',
    tags: ['malformed', 'negative-test'],
    notes: 'Tag 1 requires integer or float'
  });

  return {
    category: 'tags',
    description: 'RFC 8949 Major Type 6: Tag Tests',
    version: '1.0',
    testCases
  };
}

// ============================================================================
// SIMPLE VALUES AND FLOATS TEST GENERATORS
// ============================================================================

function generateSimpleFloatTests(): TestSuite {
  const testCases: TestCase[] = [];

  // Simple values
  testCases.push({
    id: 'simple-false',
    category: 'simple-floats',
    description: 'Simple value: false',
    inputHex: 'f4',
    expectedOutput: false,
    diagnosticNotation: 'false',
    shouldSucceed: true,
    complexity: 'trivial',
    tags: ['boolean', 'simple'],
    rfcSection: '3.3',
    cardanoRelevance: 'Boolean values in Plutus Data'
  });

  testCases.push({
    id: 'simple-true',
    category: 'simple-floats',
    description: 'Simple value: true',
    inputHex: 'f5',
    expectedOutput: true,
    diagnosticNotation: 'true',
    shouldSucceed: true,
    complexity: 'trivial',
    tags: ['boolean', 'simple'],
    rfcSection: '3.3'
  });

  testCases.push({
    id: 'simple-null',
    category: 'simple-floats',
    description: 'Simple value: null',
    inputHex: 'f6',
    expectedOutput: null,
    diagnosticNotation: 'null',
    shouldSucceed: true,
    complexity: 'trivial',
    tags: ['null', 'simple'],
    rfcSection: '3.3'
  });

  testCases.push({
    id: 'simple-undefined',
    category: 'simple-floats',
    description: 'Simple value: undefined',
    inputHex: 'f7',
    expectedOutput: undefined,
    diagnosticNotation: 'undefined',
    shouldSucceed: true,
    complexity: 'trivial',
    tags: ['undefined', 'simple'],
    rfcSection: '3.3'
  });

  // Float16 (half-precision)
  testCases.push({
    id: 'float16-zero',
    category: 'simple-floats',
    description: 'Float16: 0.0',
    inputHex: 'f90000',
    expectedOutput: 0.0,
    diagnosticNotation: '0.0',
    shouldSucceed: true,
    complexity: 'simple',
    tags: ['float16', 'float'],
    rfcSection: '3.3'
  });

  testCases.push({
    id: 'float16-one',
    category: 'simple-floats',
    description: 'Float16: 1.0',
    inputHex: 'f93c00',
    expectedOutput: 1.0,
    diagnosticNotation: '1.0',
    shouldSucceed: true,
    complexity: 'simple',
    tags: ['float16', 'float']
  });

  testCases.push({
    id: 'float16-half',
    category: 'simple-floats',
    description: 'Float16: 0.5',
    inputHex: 'f93800',
    expectedOutput: 0.5,
    diagnosticNotation: '0.5',
    shouldSucceed: true,
    complexity: 'simple',
    tags: ['float16', 'float']
  });

  testCases.push({
    id: 'float16-infinity',
    category: 'simple-floats',
    description: 'Float16: Infinity',
    inputHex: 'f97c00',
    expectedOutput: Infinity,
    diagnosticNotation: 'Infinity',
    shouldSucceed: true,
    complexity: 'simple',
    tags: ['float16', 'float', 'special', 'infinity']
  });

  testCases.push({
    id: 'float16-neg-infinity',
    category: 'simple-floats',
    description: 'Float16: -Infinity',
    inputHex: 'f9fc00',
    expectedOutput: -Infinity,
    diagnosticNotation: '-Infinity',
    shouldSucceed: true,
    complexity: 'simple',
    tags: ['float16', 'float', 'special', 'infinity']
  });

  testCases.push({
    id: 'float16-nan',
    category: 'simple-floats',
    description: 'Float16: NaN',
    inputHex: 'f97e00',
    expectedOutput: NaN,
    diagnosticNotation: 'NaN',
    shouldSucceed: true,
    complexity: 'simple',
    tags: ['float16', 'float', 'special', 'nan'],
    notes: 'NaN is special - NaN !== NaN in comparisons'
  });

  // Float32 (single-precision)
  testCases.push({
    id: 'float32-pi',
    category: 'simple-floats',
    description: 'Float32: π (3.14159265...)',
    inputHex: 'fa40490fdb',
    expectedOutput: 3.141592653589793,
    diagnosticNotation: '3.141592653589793',
    shouldSucceed: true,
    complexity: 'simple',
    tags: ['float32', 'float']
  });

  testCases.push({
    id: 'float32-infinity',
    category: 'simple-floats',
    description: 'Float32: Infinity',
    inputHex: 'fa7f800000',
    expectedOutput: Infinity,
    diagnosticNotation: 'Infinity',
    shouldSucceed: true,
    complexity: 'simple',
    tags: ['float32', 'float', 'special', 'infinity']
  });

  testCases.push({
    id: 'float32-nan',
    category: 'simple-floats',
    description: 'Float32: NaN',
    inputHex: 'fa7fc00000',
    expectedOutput: NaN,
    diagnosticNotation: 'NaN',
    shouldSucceed: true,
    complexity: 'simple',
    tags: ['float32', 'float', 'special', 'nan']
  });

  // Float64 (double-precision)
  testCases.push({
    id: 'float64-e',
    category: 'simple-floats',
    description: 'Float64: e (2.71828...)',
    inputHex: 'fb4005bf0a8b145769',
    expectedOutput: 2.718281828459045,
    diagnosticNotation: '2.718281828459045',
    shouldSucceed: true,
    complexity: 'simple',
    tags: ['float64', 'float']
  });

  testCases.push({
    id: 'float64-max',
    category: 'simple-floats',
    description: 'Float64: Maximum finite value',
    inputHex: 'fb7fefffffffffffff',
    expectedOutput: 1.7976931348623157e+308,
    diagnosticNotation: '1.7976931348623157e+308',
    shouldSucceed: true,
    complexity: 'simple',
    tags: ['float64', 'float', 'boundary', 'max']
  });

  testCases.push({
    id: 'float64-min-positive',
    category: 'simple-floats',
    description: 'Float64: Minimum positive normal value',
    inputHex: 'fb0010000000000000',
    expectedOutput: 2.2250738585072014e-308,
    diagnosticNotation: '2.2250738585072014e-308',
    shouldSucceed: true,
    complexity: 'simple',
    tags: ['float64', 'float', 'boundary', 'min']
  });

  testCases.push({
    id: 'float64-infinity',
    category: 'simple-floats',
    description: 'Float64: Infinity',
    inputHex: 'fb7ff0000000000000',
    expectedOutput: Infinity,
    diagnosticNotation: 'Infinity',
    shouldSucceed: true,
    complexity: 'simple',
    tags: ['float64', 'float', 'special', 'infinity']
  });

  testCases.push({
    id: 'float64-neg-infinity',
    category: 'simple-floats',
    description: 'Float64: -Infinity',
    inputHex: 'fbfff0000000000000',
    expectedOutput: -Infinity,
    diagnosticNotation: '-Infinity',
    shouldSucceed: true,
    complexity: 'simple',
    tags: ['float64', 'float', 'special', 'infinity']
  });

  testCases.push({
    id: 'float64-nan',
    category: 'simple-floats',
    description: 'Float64: NaN',
    inputHex: 'fb7ff8000000000000',
    expectedOutput: NaN,
    diagnosticNotation: 'NaN',
    shouldSucceed: true,
    complexity: 'simple',
    tags: ['float64', 'float', 'special', 'nan']
  });

  // Break stop code
  testCases.push({
    id: 'break-code-invalid',
    category: 'simple-floats',
    description: 'Invalid: Break code (0xFF) outside indefinite context',
    inputHex: 'ff',
    expectedOutput: null,
    diagnosticNotation: '<invalid>',
    shouldSucceed: false,
    errorType: 'break-misuse',
    complexity: 'simple',
    tags: ['malformed', 'negative-test', 'break']
  });

  // Reserved simple values
  testCases.push({
    id: 'simple-reserved',
    category: 'simple-floats',
    description: 'Invalid: Reserved simple value 31',
    inputHex: 'f8 1f',
    expectedOutput: null,
    diagnosticNotation: '<invalid>',
    shouldSucceed: false,
    errorType: 'invalid-simple',
    complexity: 'simple',
    tags: ['malformed', 'negative-test', 'reserved'],
    notes: 'Simple values 0-19 in one-byte extension are reserved'
  });

  return {
    category: 'simple-floats',
    description: 'RFC 8949 Major Type 7: Simple Values and Floats',
    version: '1.0',
    testCases
  };
}

// ============================================================================
// MAIN GENERATOR FUNCTION
// ============================================================================

async function generateAllTests() {
  const testsDir = path.join(__dirname, '../../tests');
  const coreDir = path.join(testsDir, 'core');

  // Create directories
  if (!fs.existsSync(testsDir)) fs.mkdirSync(testsDir, { recursive: true });
  if (!fs.existsSync(coreDir)) fs.mkdirSync(coreDir, { recursive: true });

  console.log('Generating CBOR test suites...\n');

  // Generate test suites
  const suites = [
    { file: '03_byte_strings.json', generator: generateByteStringTests },
    { file: '04_text_strings.json', generator: generateTextStringTests },
    { file: '05_arrays.json', generator: generateArrayTests },
    { file: '06_maps.json', generator: generateMapTests },
    { file: '07_tags.json', generator: generateTagTests },
    { file: '08_simple_floats.json', generator: generateSimpleFloatTests }
  ];

  let totalTests = 0;

  for (const { file, generator } of suites) {
    const suite = generator();
    const filePath = path.join(coreDir, file);
    fs.writeFileSync(filePath, JSON.stringify(suite, null, 2));
    console.log(`✓ Generated ${file}: ${suite.testCases.length} tests`);
    totalTests += suite.testCases.length;
  }

  console.log(`\nTotal core tests generated: ${totalTests}`);
  console.log('Note: Unsigned and negative integer tests already created manually');
}

// Run if called directly
if (require.main === module) {
  generateAllTests().catch(console.error);
}

export { generateAllTests };
