/**
 * Cardano-Specific CBOR Test Generator
 * Generates comprehensive test cases for Plutus Data, transactions, and Cardano primitives
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

// Helper functions (same as in generate-all-tests.ts)
function toHex(bytes: number[]): string {
  return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
}

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

function encodeTag(tag: number, content: number[]): number[] {
  const tagBytes = encodeUint(tag);
  tagBytes[0] = (tagBytes[0] & 0x1F) | 0xC0; // Change major type to 6
  return [...tagBytes, ...content];
}

// ============================================================================
// PLUTUS DATA TEST GENERATORS
// ============================================================================

function generatePlutusDataTests(): TestSuite {
  const testCases: TestCase[] = [];

  // Constructor 0 (tag 121)
  testCases.push({
    id: 'plutus-constructor-0-empty',
    category: 'plutus-data',
    description: 'Constructor 0 with no fields',
    inputHex: toHex(encodeTag(121, encodeArray([]))),
    expectedOutput: { constructor: 0, fields: [] },
    diagnosticNotation: '121([])',
    shouldSucceed: true,
    complexity: 'simple',
    tags: ['plutus', 'constructor', 'tag-121'],
    cardanoRelevance: 'Plutus Data constructor alternative 0 (compact encoding)'
  });

  testCases.push({
    id: 'plutus-constructor-0-single-field',
    category: 'plutus-data',
    description: 'Constructor 0 with single integer field',
    inputHex: toHex(encodeTag(121, encodeArray([encodeUint(42)]))),
    expectedOutput: { constructor: 0, fields: [42] },
    diagnosticNotation: '121([42])',
    shouldSucceed: true,
    complexity: 'simple',
    tags: ['plutus', 'constructor', 'tag-121']
  });

  testCases.push({
    id: 'plutus-constructor-0-multiple-fields',
    category: 'plutus-data',
    description: 'Constructor 0 with multiple fields: [1, 2, 3]',
    inputHex: toHex(encodeTag(121, encodeArray([encodeUint(1), encodeUint(2), encodeUint(3)]))),
    expectedOutput: { constructor: 0, fields: [1, 2, 3] },
    diagnosticNotation: '121([1, 2, 3])',
    shouldSucceed: true,
    complexity: 'simple',
    tags: ['plutus', 'constructor', 'tag-121'],
    cardanoRelevance: 'Common pattern for simple Plutus datums'
  });

  // Constructors 1-6 (tags 122-127)
  for (let i = 1; i <= 6; i++) {
    testCases.push({
      id: `plutus-constructor-${i}`,
      category: 'plutus-data',
      description: `Constructor ${i} with fields`,
      inputHex: toHex(encodeTag(121 + i, encodeArray([encodeUint(i * 10)]))),
      expectedOutput: { constructor: i, fields: [i * 10] },
      diagnosticNotation: `${121 + i}([${i * 10}])`,
      shouldSucceed: true,
      complexity: 'simple',
      tags: ['plutus', 'constructor', `tag-${121 + i}`],
      cardanoRelevance: `Plutus Data constructor alternative ${i}`
    });
  }

  // General constructor (tag 102) for alternatives >= 7
  testCases.push({
    id: 'plutus-constructor-7-general',
    category: 'plutus-data',
    description: 'Constructor 7 using general form (tag 102)',
    inputHex: toHex(encodeTag(102, encodeArray([encodeUint(7), encodeArray([encodeUint(100)])]))),
    expectedOutput: { constructor: 7, fields: [100] },
    diagnosticNotation: '102([7, [100]])',
    shouldSucceed: true,
    complexity: 'moderate',
    tags: ['plutus', 'constructor', 'tag-102', 'general'],
    cardanoRelevance: 'General constructor form for alternatives >= 7'
  });

  testCases.push({
    id: 'plutus-constructor-100-general',
    category: 'plutus-data',
    description: 'Constructor 100 using general form',
    inputHex: toHex(encodeTag(102, encodeArray([encodeUint(100), encodeArray([encodeUint(1), encodeUint(2)])]))),
    expectedOutput: { constructor: 100, fields: [1, 2] },
    diagnosticNotation: '102([100, [1, 2]])',
    shouldSucceed: true,
    complexity: 'moderate',
    tags: ['plutus', 'constructor', 'tag-102', 'general']
  });

  // Plutus Data: List variant
  testCases.push({
    id: 'plutus-list-empty',
    category: 'plutus-data',
    description: 'Plutus Data list: []',
    inputHex: toHex(encodeArray([])),
    expectedOutput: [],
    diagnosticNotation: '[]',
    shouldSucceed: true,
    complexity: 'trivial',
    tags: ['plutus', 'list'],
    cardanoRelevance: 'Plutus Data list variant (one of 5 variants)'
  });

  testCases.push({
    id: 'plutus-list-integers',
    category: 'plutus-data',
    description: 'Plutus Data list of integers: [1, 2, 3, 4, 5]',
    inputHex: toHex(encodeArray([encodeUint(1), encodeUint(2), encodeUint(3), encodeUint(4), encodeUint(5)])),
    expectedOutput: [1, 2, 3, 4, 5],
    diagnosticNotation: '[1, 2, 3, 4, 5]',
    shouldSucceed: true,
    complexity: 'simple',
    tags: ['plutus', 'list']
  });

  testCases.push({
    id: 'plutus-list-nested',
    category: 'plutus-data',
    description: 'Plutus Data nested list: [[1, 2], [3, 4]]',
    inputHex: toHex(encodeArray([
      encodeArray([encodeUint(1), encodeUint(2)]),
      encodeArray([encodeUint(3), encodeUint(4)])
    ])),
    expectedOutput: [[1, 2], [3, 4]],
    diagnosticNotation: '[[1, 2], [3, 4]]',
    shouldSucceed: true,
    complexity: 'moderate',
    tags: ['plutus', 'list', 'nested']
  });

  // Plutus Data: Map variant
  testCases.push({
    id: 'plutus-map-empty',
    category: 'plutus-data',
    description: 'Plutus Data map: {}',
    inputHex: toHex(encodeMap([])),
    expectedOutput: {},
    diagnosticNotation: '{}',
    shouldSucceed: true,
    complexity: 'trivial',
    tags: ['plutus', 'map'],
    cardanoRelevance: 'Plutus Data map variant'
  });

  testCases.push({
    id: 'plutus-map-int-keys',
    category: 'plutus-data',
    description: 'Plutus Data map with integer keys: {0: 1, 1: 2}',
    inputHex: toHex(encodeMap([
      [encodeUint(0), encodeUint(1)],
      [encodeUint(1), encodeUint(2)]
    ])),
    expectedOutput: { '0': 1, '1': 2 },
    diagnosticNotation: '{0: 1, 1: 2}',
    shouldSucceed: true,
    complexity: 'simple',
    tags: ['plutus', 'map']
  });

  testCases.push({
    id: 'plutus-map-bytes-keys',
    category: 'plutus-data',
    description: 'Plutus Data map with byte string keys',
    inputHex: toHex(encodeMap([
      [encodeBytes([0x00, 0x01]), encodeUint(100)],
      [encodeBytes([0xFF]), encodeUint(200)]
    ])),
    expectedOutput: { '0001': 100, 'ff': 200 },
    diagnosticNotation: "{h'0001': 100, h'FF': 200}",
    shouldSucceed: true,
    complexity: 'moderate',
    tags: ['plutus', 'map', 'bytes-keys'],
    cardanoRelevance: 'Byte string keys common in Plutus Data maps'
  });

  // Plutus Data: Integer (including bignums)
  testCases.push({
    id: 'plutus-integer-small',
    category: 'plutus-data',
    description: 'Plutus Data integer: 42',
    inputHex: toHex(encodeUint(42)),
    expectedOutput: 42,
    diagnosticNotation: '42',
    shouldSucceed: true,
    complexity: 'trivial',
    tags: ['plutus', 'integer']
  });

  testCases.push({
    id: 'plutus-integer-bignum-positive',
    category: 'plutus-data',
    description: 'Plutus Data positive bignum: 2^64',
    inputHex: toHex(encodeTag(2, encodeBytes([0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]))),
    expectedOutput: '18446744073709551616',
    diagnosticNotation: "2(h'010000000000000000')",
    shouldSucceed: true,
    complexity: 'moderate',
    tags: ['plutus', 'integer', 'bignum'],
    cardanoRelevance: 'Plutus supports arbitrary-precision integers'
  });

  testCases.push({
    id: 'plutus-integer-bignum-negative',
    category: 'plutus-data',
    description: 'Plutus Data negative bignum: -2^64 - 1',
    inputHex: toHex(encodeTag(3, encodeBytes([0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]))),
    expectedOutput: '-18446744073709551617',
    diagnosticNotation: "3(h'010000000000000000')",
    shouldSucceed: true,
    complexity: 'moderate',
    tags: ['plutus', 'integer', 'bignum', 'negative']
  });

  // Plutus Data: Bounded bytes (0-64 bytes)
  testCases.push({
    id: 'plutus-bytes-empty',
    category: 'plutus-data',
    description: 'Plutus Data bounded bytes: empty',
    inputHex: toHex(encodeBytes([])),
    expectedOutput: '',
    diagnosticNotation: "h''",
    shouldSucceed: true,
    complexity: 'trivial',
    tags: ['plutus', 'bytes', 'bounded'],
    cardanoRelevance: 'Plutus Data bytes must be 0-64 bytes'
  });

  testCases.push({
    id: 'plutus-bytes-32',
    category: 'plutus-data',
    description: 'Plutus Data bounded bytes: 32 bytes (hash)',
    inputHex: toHex(encodeBytes(Array(32).fill(0xAB))),
    expectedOutput: 'ab'.repeat(32),
    diagnosticNotation: `h'${'AB'.repeat(32)}'`,
    shouldSucceed: true,
    complexity: 'simple',
    tags: ['plutus', 'bytes', 'bounded', 'hash'],
    cardanoRelevance: 'Transaction hashes, public key hashes in Plutus'
  });

  testCases.push({
    id: 'plutus-bytes-64-max',
    category: 'plutus-data',
    description: 'Plutus Data bounded bytes: 64 bytes (maximum)',
    inputHex: toHex(encodeBytes(Array(64).fill(0xFF))),
    expectedOutput: 'ff'.repeat(64),
    diagnosticNotation: `h'${'FF'.repeat(16)}...'`,
    shouldSucceed: true,
    complexity: 'simple',
    tags: ['plutus', 'bytes', 'bounded', 'boundary'],
    cardanoRelevance: 'Maximum byte string size in Plutus Data (CDDL constraint)'
  });

  testCases.push({
    id: 'plutus-bytes-over-64-invalid',
    category: 'plutus-data',
    description: 'Invalid: Plutus Data bytes exceeding 64 bytes',
    inputHex: toHex(encodeBytes(Array(65).fill(0x00))),
    expectedOutput: null,
    diagnosticNotation: '<invalid>',
    shouldSucceed: false,
    errorType: 'invalid-tag-content',
    complexity: 'moderate',
    tags: ['plutus', 'bytes', 'bounded', 'negative-test'],
    cardanoRelevance: 'Plutus Data CDDL constrains bytes to 0-64 length',
    notes: 'Well-formed CBOR but invalid Plutus Data'
  });

  // Complex nested Plutus Data
  testCases.push({
    id: 'plutus-nested-constructor-in-list',
    category: 'plutus-data',
    description: 'Nested: List containing constructors',
    inputHex: toHex(encodeArray([
      encodeTag(121, encodeArray([encodeUint(1)])),
      encodeTag(122, encodeArray([encodeUint(2)])),
      encodeTag(123, encodeArray([encodeUint(3)]))
    ])),
    expectedOutput: [
      { constructor: 0, fields: [1] },
      { constructor: 1, fields: [2] },
      { constructor: 2, fields: [3] }
    ],
    diagnosticNotation: '[121([1]), 122([2]), 123([3])]',
    shouldSucceed: true,
    complexity: 'complex',
    tags: ['plutus', 'nested', 'constructor', 'list'],
    cardanoRelevance: 'Common in validator redeemers with multiple actions'
  });

  testCases.push({
    id: 'plutus-nested-constructor-fields',
    category: 'plutus-data',
    description: 'Constructor with nested constructor fields',
    inputHex: toHex(encodeTag(121, encodeArray([
      encodeTag(122, encodeArray([encodeUint(42)])),
      encodeUint(100)
    ]))),
    expectedOutput: {
      constructor: 0,
      fields: [
        { constructor: 1, fields: [42] },
        100
      ]
    },
    diagnosticNotation: '121([122([42]), 100])',
    shouldSucceed: true,
    complexity: 'complex',
    tags: ['plutus', 'nested', 'constructor'],
    cardanoRelevance: 'Nested data structures in Plutus validators'
  });

  // Real-world Plutus patterns
  testCases.push({
    id: 'plutus-datum-vesting',
    category: 'plutus-data',
    description: 'Vesting contract datum: beneficiary + deadline',
    inputHex: toHex(encodeTag(121, encodeArray([
      encodeBytes(Array(28).fill(0xAA)), // Beneficiary PKH
      encodeUint(1698364800) // Deadline (POSIX timestamp)
    ]))),
    expectedOutput: {
      constructor: 0,
      fields: [
        'aa'.repeat(28),
        1698364800
      ]
    },
    diagnosticNotation: `121([h'${'AA'.repeat(28)}', 1698364800])`,
    shouldSucceed: true,
    complexity: 'moderate',
    tags: ['plutus', 'datum', 'vesting', 'real-world'],
    cardanoRelevance: 'Typical vesting contract datum structure'
  });

  testCases.push({
    id: 'plutus-redeemer-spend',
    category: 'plutus-data',
    description: 'Spend redeemer: signature provided',
    inputHex: toHex(encodeTag(121, encodeArray([
      encodeBytes(Array(64).fill(0xBB)) // Ed25519 signature
    ]))),
    expectedOutput: {
      constructor: 0,
      fields: ['bb'.repeat(64)]
    },
    diagnosticNotation: `121([h'${'BB'.repeat(64)}'])`,
    shouldSucceed: true,
    complexity: 'moderate',
    tags: ['plutus', 'redeemer', 'spend', 'real-world'],
    cardanoRelevance: 'Redeemer providing signature for spending'
  });

  // CBOR-in-CBOR (tag 24) with Plutus Data
  testCases.push({
    id: 'plutus-cbor-in-cbor',
    category: 'plutus-data',
    description: 'Tag 24: Embedded Plutus Data',
    inputHex: toHex(encodeTag(24, encodeBytes(encodeTag(121, encodeArray([encodeUint(1), encodeUint(2)]))))),
    expectedOutput: toHex(encodeTag(121, encodeArray([encodeUint(1), encodeUint(2)]))),
    diagnosticNotation: "24(h'D879820102')",
    shouldSucceed: true,
    complexity: 'complex',
    tags: ['plutus', 'cbor-in-cbor', 'tag-24'],
    cardanoRelevance: 'Inline datum/redeemer encoding in transaction outputs',
    notes: 'Inner CBOR should be decoded separately'
  });

  return {
    category: 'plutus-data',
    description: 'Cardano Plutus Data Encoding Tests',
    version: '1.0',
    testCases
  };
}

// ============================================================================
// TRANSACTION TEST GENERATORS
// ============================================================================

function generateTransactionTests(): TestSuite {
  const testCases: TestCase[] = [];

  // Transaction input
  testCases.push({
    id: 'tx-input-simple',
    category: 'transactions',
    description: 'Transaction input: [txHash, index]',
    inputHex: toHex(encodeArray([
      encodeBytes(Array(32).fill(0xAA)),
      encodeUint(0)
    ])),
    expectedOutput: [
      'aa'.repeat(32),
      0
    ],
    diagnosticNotation: `[h'${'AA'.repeat(32)}', 0]`,
    shouldSucceed: true,
    complexity: 'simple',
    tags: ['cardano', 'transaction', 'input'],
    cardanoRelevance: 'Transaction input structure (UTxO reference)'
  });

  testCases.push({
    id: 'tx-input-set',
    category: 'transactions',
    description: 'Transaction inputs as set (tag 258)',
    inputHex: toHex(encodeTag(258, encodeArray([
      encodeArray([encodeBytes(Array(32).fill(0xAA)), encodeUint(0)]),
      encodeArray([encodeBytes(Array(32).fill(0xBB)), encodeUint(1)])
    ]))),
    expectedOutput: [
      ['aa'.repeat(32), 0],
      ['bb'.repeat(32), 1]
    ],
    diagnosticNotation: `258([[h'AA...', 0], [h'BB...', 1]])`,
    shouldSucceed: true,
    complexity: 'moderate',
    tags: ['cardano', 'transaction', 'input', 'set', 'tag-258'],
    cardanoRelevance: 'Transaction body field 0: inputs (set)'
  });

  // Multi-asset value
  testCases.push({
    id: 'multi-asset-ada-only',
    category: 'transactions',
    description: 'Value: ADA only (2 ADA)',
    inputHex: toHex(encodeUint(2000000)),
    expectedOutput: 2000000,
    diagnosticNotation: '2000000',
    shouldSucceed: true,
    complexity: 'trivial',
    tags: ['cardano', 'value', 'ada'],
    cardanoRelevance: 'Pure ADA value (no native assets)'
  });

  testCases.push({
    id: 'multi-asset-single-token',
    category: 'transactions',
    description: 'Value: ADA + single native token',
    inputHex: toHex(encodeArray([
      encodeUint(2000000), // 2 ADA
      encodeMap([
        [encodeBytes(Array(28).fill(0xCC)), encodeMap([
          [encodeBytes(Array.from(Buffer.from('Token', 'utf8'))), encodeUint(100)]
        ])]
      ])
    ])),
    expectedOutput: [
      2000000,
      {
        ['cc'.repeat(28)]: {
          '546f6b656e': 100
        }
      }
    ],
    diagnosticNotation: `[2000000, {h'CC...': {h'Token': 100}}]`,
    shouldSucceed: true,
    complexity: 'complex',
    tags: ['cardano', 'value', 'multi-asset', 'native-token'],
    cardanoRelevance: 'Multi-asset value: coin + policy -> asset -> amount'
  });

  testCases.push({
    id: 'multi-asset-multiple-tokens',
    category: 'transactions',
    description: 'Value: ADA + multiple tokens from same policy',
    inputHex: toHex(encodeArray([
      encodeUint(1000000),
      encodeMap([
        [encodeBytes(Array(28).fill(0xDD)), encodeMap([
          [encodeBytes(Array.from(Buffer.from('TokenA', 'utf8'))), encodeUint(50)],
          [encodeBytes(Array.from(Buffer.from('TokenB', 'utf8'))), encodeUint(75)]
        ])]
      ])
    ])),
    expectedOutput: [
      1000000,
      {
        ['dd'.repeat(28)]: {
          '546f6b656e41': 50,
          '546f6b656e42': 75
        }
      }
    ],
    diagnosticNotation: `[1000000, {h'DD...': {h'TokenA': 50, h'TokenB': 75}}]`,
    shouldSucceed: true,
    complexity: 'complex',
    tags: ['cardano', 'value', 'multi-asset', 'multiple-tokens'],
    cardanoRelevance: 'Multiple assets from same policy ID'
  });

  testCases.push({
    id: 'multi-asset-multiple-policies',
    category: 'transactions',
    description: 'Value: Multiple policies with tokens',
    inputHex: toHex(encodeArray([
      encodeUint(5000000),
      encodeMap([
        [encodeBytes(Array(28).fill(0xEE)), encodeMap([
          [encodeBytes(Array.from(Buffer.from('NFT1', 'utf8'))), encodeUint(1)]
        ])],
        [encodeBytes(Array(28).fill(0xFF)), encodeMap([
          [encodeBytes(Array.from(Buffer.from('FT1', 'utf8'))), encodeUint(1000)]
        ])]
      ])
    ])),
    expectedOutput: [
      5000000,
      {
        ['ee'.repeat(28)]: { '4e465431': 1 },
        ['ff'.repeat(28)]: { '465431': 1000 }
      }
    ],
    diagnosticNotation: `[5000000, {h'EE...': {h'NFT1': 1}, h'FF...': {h'FT1': 1000}}]`,
    shouldSucceed: true,
    complexity: 'extreme',
    tags: ['cardano', 'value', 'multi-asset', 'multiple-policies'],
    cardanoRelevance: 'Value with multiple policy IDs and assets'
  });

  // Transaction body (minimal)
  testCases.push({
    id: 'tx-body-minimal',
    category: 'transactions',
    description: 'Minimal transaction body: {0: [], 1: [], 2: fee}',
    inputHex: toHex(encodeMap([
      [encodeUint(0), encodeTag(258, encodeArray([]))], // inputs (empty set)
      [encodeUint(1), encodeArray([])], // outputs (empty)
      [encodeUint(2), encodeUint(170000)] // fee
    ])),
    expectedOutput: {
      '0': [],
      '1': [],
      '2': 170000
    },
    diagnosticNotation: '{0: 258([]), 1: [], 2: 170000}',
    shouldSucceed: true,
    complexity: 'moderate',
    tags: ['cardano', 'transaction', 'tx-body'],
    cardanoRelevance: 'Minimum viable transaction body structure',
    notes: 'Invalid transaction (no inputs/outputs) but valid CBOR'
  });

  // Redeemer structure
  testCases.push({
    id: 'redeemer-spend',
    category: 'transactions',
    description: 'Redeemer: [tag, index, data, ex_units]',
    inputHex: toHex(encodeArray([
      encodeUint(0), // tag: spend
      encodeUint(0), // index
      encodeTag(121, encodeArray([encodeUint(42)])), // data: Constructor 0 [42]
      encodeArray([encodeUint(1000000), encodeUint(500000000)]) // ex_units: [mem, steps]
    ])),
    expectedOutput: [
      0,
      0,
      { constructor: 0, fields: [42] },
      [1000000, 500000000]
    ],
    diagnosticNotation: '[0, 0, 121([42]), [1000000, 500000000]]',
    shouldSucceed: true,
    complexity: 'complex',
    tags: ['cardano', 'redeemer', 'plutus', 'ex-units'],
    cardanoRelevance: 'Redeemer structure with execution units'
  });

  testCases.push({
    id: 'redeemer-mint',
    category: 'transactions',
    description: 'Redeemer for minting',
    inputHex: toHex(encodeArray([
      encodeUint(1), // tag: mint
      encodeUint(0), // index
      encodeTag(121, encodeArray([])), // data: Constructor 0 []
      encodeArray([encodeUint(500000), encodeUint(250000000)]) // ex_units
    ])),
    expectedOutput: [
      1,
      0,
      { constructor: 0, fields: [] },
      [500000, 250000000]
    ],
    diagnosticNotation: '[1, 0, 121([]), [500000, 250000000]]',
    shouldSucceed: true,
    complexity: 'complex',
    tags: ['cardano', 'redeemer', 'mint', 'plutus'],
    cardanoRelevance: 'Minting redeemer with execution units'
  });

  return {
    category: 'transactions',
    description: 'Cardano Transaction Component Tests',
    version: '1.0',
    testCases
  };
}

// ============================================================================
// CIP-25 METADATA TEST GENERATORS
// ============================================================================

function generateCIP25Tests(): TestSuite {
  const testCases: TestCase[] = [];

  // Simple NFT metadata
  testCases.push({
    id: 'cip25-simple-nft',
    category: 'metadata',
    description: 'CIP-25: Simple NFT with name and image',
    inputHex: toHex(encodeMap([
      [encodeText('721'), encodeMap([
        [encodeBytes(Array(28).fill(0xAA)), encodeMap([
          [encodeBytes(Array.from(Buffer.from('NFT001', 'utf8'))), encodeMap([
            [encodeText('name'), encodeText('My First NFT')],
            [encodeText('image'), encodeText('ipfs://QmXnnyufdzAWL5CqZ2RnSNgPbvCc1ALT73s6epPrRnZ1Xy')]
          ])]
        ])]
      ])]
    ])),
    expectedOutput: {
      '721': {
        ['aa'.repeat(28)]: {
          '4e465430 3031': {
            name: 'My First NFT',
            image: 'ipfs://QmXnnyufdzAWL5CqZ2RnSNgPbvCc1ALT73s6epPrRnZ1Xy'
          }
        }
      }
    },
    diagnosticNotation: `{"721": {h'AA...': {h'NFT001': {...}}}}`,
    shouldSucceed: true,
    complexity: 'complex',
    tags: ['cardano', 'metadata', 'cip-25', 'nft'],
    cardanoRelevance: 'CIP-25 NFT metadata standard (label 721)',
    cip: 'CIP-25'
  });

  testCases.push({
    id: 'cip25-nft-with-description',
    category: 'metadata',
    description: 'CIP-25: NFT with name, image, and description',
    inputHex: toHex(encodeMap([
      [encodeText('721'), encodeMap([
        [encodeBytes(Array(28).fill(0xBB)), encodeMap([
          [encodeBytes(Array.from(Buffer.from('Token001', 'utf8'))), encodeMap([
            [encodeText('name'), encodeText('Space Explorer #42')],
            [encodeText('image'), encodeText('ipfs://QmHash123')],
            [encodeText('description'), encodeText('A brave space explorer')]
          ])]
        ])]
      ])]
    ])),
    expectedOutput: {
      '721': {
        ['bb'.repeat(28)]: {
          '546f6b656e303031': {
            name: 'Space Explorer #42',
            image: 'ipfs://QmHash123',
            description: 'A brave space explorer'
          }
        }
      }
    },
    diagnosticNotation: `{"721": {...}}`,
    shouldSucceed: true,
    complexity: 'complex',
    tags: ['cardano', 'metadata', 'cip-25', 'nft'],
    cip: 'CIP-25'
  });

  testCases.push({
    id: 'cip25-nft-with-files',
    category: 'metadata',
    description: 'CIP-25: NFT with files array',
    inputHex: toHex(encodeMap([
      [encodeText('721'), encodeMap([
        [encodeBytes(Array(28).fill(0xCC)), encodeMap([
          [encodeBytes(Array.from(Buffer.from('Art001', 'utf8'))), encodeMap([
            [encodeText('name'), encodeText('Digital Art')],
            [encodeText('image'), encodeText('ipfs://QmImage')],
            [encodeText('files'), encodeArray([
              encodeMap([
                [encodeText('name'), encodeText('thumbnail')],
                [encodeText('mediaType'), encodeText('image/png')],
                [encodeText('src'), encodeText('ipfs://QmThumb')]
              ])
            ])]
          ])]
        ])]
      ])]
    ])),
    expectedOutput: {
      '721': {
        ['cc'.repeat(28)]: {
          '417274303031': {
            name: 'Digital Art',
            image: 'ipfs://QmImage',
            files: [
              {
                name: 'thumbnail',
                mediaType: 'image/png',
                src: 'ipfs://QmThumb'
              }
            ]
          }
        }
      }
    },
    diagnosticNotation: `{"721": {...files: [...]}}`,
    shouldSucceed: true,
    complexity: 'extreme',
    tags: ['cardano', 'metadata', 'cip-25', 'nft', 'files'],
    cip: 'CIP-25',
    cardanoRelevance: 'NFT with additional files (thumbnails, etc.)'
  });

  return {
    category: 'metadata',
    description: 'CIP-25 NFT Metadata Tests',
    version: '1.0',
    testCases
  };
}

// ============================================================================
// CARDANO PRIMITIVES TEST GENERATORS
// ============================================================================

function generatePrimitivesTests(): TestSuite {
  const testCases: TestCase[] = [];

  // Ed25519 keys and signatures
  testCases.push({
    id: 'ed25519-pubkey',
    category: 'primitives',
    description: 'Ed25519 public key (32 bytes)',
    inputHex: toHex(encodeBytes(Array(32).fill(0x00).map((_, i) => i))),
    expectedOutput: toHex(Array(32).fill(0x00).map((_, i) => i)),
    diagnosticNotation: `h'000102...1F'`,
    shouldSucceed: true,
    complexity: 'simple',
    tags: ['cardano', 'ed25519', 'pubkey', 'cryptography'],
    cardanoRelevance: 'Ed25519 public keys are 32 bytes'
  });

  testCases.push({
    id: 'ed25519-signature',
    category: 'primitives',
    description: 'Ed25519 signature (64 bytes)',
    inputHex: toHex(encodeBytes(Array(64).fill(0xFF))),
    expectedOutput: 'ff'.repeat(64),
    diagnosticNotation: `h'${'FF'.repeat(16)}...'`,
    shouldSucceed: true,
    complexity: 'simple',
    tags: ['cardano', 'ed25519', 'signature', 'cryptography'],
    cardanoRelevance: 'Ed25519 signatures are 64 bytes'
  });

  // Hashes
  testCases.push({
    id: 'blake2b-256-hash',
    category: 'primitives',
    description: 'Blake2b-256 hash (32 bytes)',
    inputHex: toHex(encodeBytes(Array(32).fill(0xAB))),
    expectedOutput: 'ab'.repeat(32),
    diagnosticNotation: `h'${'AB'.repeat(32)}'`,
    shouldSucceed: true,
    complexity: 'simple',
    tags: ['cardano', 'hash', 'blake2b'],
    cardanoRelevance: 'Transaction hashes, data hashes use Blake2b-256'
  });

  // Policy IDs and Asset Names
  testCases.push({
    id: 'policy-id',
    category: 'primitives',
    description: 'Policy ID (28 bytes)',
    inputHex: toHex(encodeBytes(Array(28).fill(0xCD))),
    expectedOutput: 'cd'.repeat(28),
    diagnosticNotation: `h'${'CD'.repeat(28)}'`,
    shouldSucceed: true,
    complexity: 'simple',
    tags: ['cardano', 'policy-id', 'native-asset'],
    cardanoRelevance: 'Policy IDs are 28-byte script hashes'
  });

  testCases.push({
    id: 'asset-name-empty',
    category: 'primitives',
    description: 'Asset name: empty (0 bytes)',
    inputHex: toHex(encodeBytes([])),
    expectedOutput: '',
    diagnosticNotation: "h''",
    shouldSucceed: true,
    complexity: 'trivial',
    tags: ['cardano', 'asset-name', 'boundary'],
    cardanoRelevance: 'Empty asset names are valid (0-32 bytes allowed)'
  });

  testCases.push({
    id: 'asset-name-text',
    category: 'primitives',
    description: 'Asset name: "TOKEN" (5 bytes)',
    inputHex: toHex(encodeBytes(Array.from(Buffer.from('TOKEN', 'utf8')))),
    expectedOutput: '544f4b454e',
    diagnosticNotation: "h'544F4B454E'",
    shouldSucceed: true,
    complexity: 'simple',
    tags: ['cardano', 'asset-name'],
    cardanoRelevance: 'Text-based asset names'
  });

  testCases.push({
    id: 'asset-name-max-length',
    category: 'primitives',
    description: 'Asset name: 32 bytes (maximum)',
    inputHex: toHex(encodeBytes(Array(32).fill(0x41))),
    expectedOutput: '41'.repeat(32),
    diagnosticNotation: `h'${'41'.repeat(32)}'`,
    shouldSucceed: true,
    complexity: 'simple',
    tags: ['cardano', 'asset-name', 'boundary'],
    cardanoRelevance: 'Maximum asset name length is 32 bytes'
  });

  return {
    category: 'primitives',
    description: 'Cardano Cryptographic Primitives Tests',
    version: '1.0',
    testCases
  };
}

// ============================================================================
// MAIN GENERATOR FUNCTION
// ============================================================================

async function generateCardanoTests() {
  const testsDir = path.join(__dirname, '../../tests');
  const cardanoDir = path.join(testsDir, 'cardano');

  // Create directories
  if (!fs.existsSync(testsDir)) fs.mkdirSync(testsDir, { recursive: true });
  if (!fs.existsSync(cardanoDir)) fs.mkdirSync(cardanoDir, { recursive: true });

  console.log('Generating Cardano-specific test suites...\n');

  // Generate test suites
  const suites = [
    { file: 'plutus_data.json', generator: generatePlutusDataTests },
    { file: 'transactions.json', generator: generateTransactionTests },
    { file: 'metadata_cip25.json', generator: generateCIP25Tests },
    { file: 'primitives.json', generator: generatePrimitivesTests }
  ];

  let totalTests = 0;

  for (const { file, generator } of suites) {
    const suite = generator();
    const filePath = path.join(cardanoDir, file);
    fs.writeFileSync(filePath, JSON.stringify(suite, null, 2));
    console.log(`✓ Generated ${file}: ${suite.testCases.length} tests`);
    totalTests += suite.testCases.length;
  }

  console.log(`\nTotal Cardano tests generated: ${totalTests}`);
}

// Run if called directly
if (require.main === module) {
  generateCardanoTests().catch(console.error);
}

export { generateCardanoTests };
