/**
 * Edge Case and Malformed CBOR Test Generator
 * Generates tests for error conditions, limits, canonical violations, and stress tests
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
  notes?: string;
}

interface TestSuite {
  category: string;
  description: string;
  version: string;
  testCases: TestCase[];
}

function toHex(bytes: number[]): string {
  return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ============================================================================
// MALFORMED CBOR TEST GENERATORS
// ============================================================================

function generateMalformedTests(): TestSuite {
  const testCases: TestCase[] = [];

  // Truncated data
  testCases.push({
    id: 'malformed-truncated-empty',
    category: 'malformed',
    description: 'Empty input',
    inputHex: '',
    expectedOutput: null,
    diagnosticNotation: '<truncated>',
    shouldSucceed: false,
    errorType: 'truncated',
    complexity: 'trivial',
    tags: ['truncated', 'empty'],
    notes: 'No data at all'
  });

  testCases.push({
    id: 'malformed-truncated-uint-24',
    category: 'malformed',
    description: 'Truncated: uint with additional info 24 but no byte',
    inputHex: '18',
    expectedOutput: null,
    diagnosticNotation: '<truncated>',
    shouldSucceed: false,
    errorType: 'truncated',
    complexity: 'simple',
    tags: ['truncated', 'integer']
  });

  testCases.push({
    id: 'malformed-truncated-uint-25',
    category: 'malformed',
    description: 'Truncated: uint with additional info 25 but only 1 byte',
    inputHex: '1901',
    expectedOutput: null,
    diagnosticNotation: '<truncated>',
    shouldSucceed: false,
    errorType: 'truncated',
    complexity: 'simple',
    tags: ['truncated', 'integer']
  });

  testCases.push({
    id: 'malformed-truncated-bytes',
    category: 'malformed',
    description: 'Truncated: byte string length 10 but only 5 bytes',
    inputHex: '4a0102030405',
    expectedOutput: null,
    diagnosticNotation: '<truncated>',
    shouldSucceed: false,
    errorType: 'truncated',
    complexity: 'simple',
    tags: ['truncated', 'bytes']
  });

  testCases.push({
    id: 'malformed-truncated-text',
    category: 'malformed',
    description: 'Truncated: text string length 10 but only 3 bytes',
    inputHex: '6a414243',
    expectedOutput: null,
    diagnosticNotation: '<truncated>',
    shouldSucceed: false,
    errorType: 'truncated',
    complexity: 'simple',
    tags: ['truncated', 'text']
  });

  testCases.push({
    id: 'malformed-truncated-array',
    category: 'malformed',
    description: 'Truncated: array length 5 but only 3 elements',
    inputHex: '85010203',
    expectedOutput: null,
    diagnosticNotation: '<truncated>',
    shouldSucceed: false,
    errorType: 'truncated',
    complexity: 'simple',
    tags: ['truncated', 'array']
  });

  testCases.push({
    id: 'malformed-truncated-map',
    category: 'malformed',
    description: 'Truncated: map length 2 but only 1 pair',
    inputHex: 'a2010203',
    expectedOutput: null,
    diagnosticNotation: '<truncated>',
    shouldSucceed: false,
    errorType: 'truncated',
    complexity: 'simple',
    tags: ['truncated', 'map']
  });

  // Reserved additional info values
  testCases.push({
    id: 'malformed-reserved-uint-28',
    category: 'malformed',
    description: 'Reserved: major type 0 additional info 28',
    inputHex: '1c',
    expectedOutput: null,
    diagnosticNotation: '<invalid>',
    shouldSucceed: false,
    errorType: 'invalid-additional-info',
    complexity: 'simple',
    tags: ['reserved', 'integer'],
    rfcSection: '3.1'
  });

  testCases.push({
    id: 'malformed-reserved-uint-29',
    category: 'malformed',
    description: 'Reserved: major type 0 additional info 29',
    inputHex: '1d',
    expectedOutput: null,
    diagnosticNotation: '<invalid>',
    shouldSucceed: false,
    errorType: 'invalid-additional-info',
    complexity: 'simple',
    tags: ['reserved', 'integer']
  });

  testCases.push({
    id: 'malformed-reserved-uint-30',
    category: 'malformed',
    description: 'Reserved: major type 0 additional info 30',
    inputHex: '1e',
    expectedOutput: null,
    diagnosticNotation: '<invalid>',
    shouldSucceed: false,
    errorType: 'invalid-additional-info',
    complexity: 'simple',
    tags: ['reserved', 'integer']
  });

  testCases.push({
    id: 'malformed-reserved-tag-28',
    category: 'malformed',
    description: 'Reserved: major type 6 additional info 28',
    inputHex: 'dc',
    expectedOutput: null,
    diagnosticNotation: '<invalid>',
    shouldSucceed: false,
    errorType: 'invalid-additional-info',
    complexity: 'simple',
    tags: ['reserved', 'tag']
  });

  // Invalid UTF-8
  testCases.push({
    id: 'malformed-utf8-overlong',
    category: 'malformed',
    description: 'Invalid UTF-8: Overlong encoding of NULL',
    inputHex: '63c08041',
    expectedOutput: null,
    diagnosticNotation: '<invalid-utf8>',
    shouldSucceed: false,
    errorType: 'invalid-utf8',
    complexity: 'moderate',
    tags: ['utf8', 'text'],
    notes: 'NULL should be 0x00, not 0xC0 0x80'
  });

  testCases.push({
    id: 'malformed-utf8-surrogate-high',
    category: 'malformed',
    description: 'Invalid UTF-8: High surrogate half (U+D800)',
    inputHex: '63eda080',
    expectedOutput: null,
    diagnosticNotation: '<invalid-utf8>',
    shouldSucceed: false,
    errorType: 'invalid-utf8',
    complexity: 'moderate',
    tags: ['utf8', 'text', 'surrogate'],
    notes: 'Surrogate halves (U+D800-U+DFFF) are invalid in UTF-8'
  });

  testCases.push({
    id: 'malformed-utf8-surrogate-low',
    category: 'malformed',
    description: 'Invalid UTF-8: Low surrogate half (U+DC00)',
    inputHex: '63edb080',
    expectedOutput: null,
    diagnosticNotation: '<invalid-utf8>',
    shouldSucceed: false,
    errorType: 'invalid-utf8',
    complexity: 'moderate',
    tags: ['utf8', 'text', 'surrogate']
  });

  testCases.push({
    id: 'malformed-utf8-truncated-2byte',
    category: 'malformed',
    description: 'Invalid UTF-8: Truncated 2-byte sequence',
    inputHex: '61c2',
    expectedOutput: null,
    diagnosticNotation: '<invalid-utf8>',
    shouldSucceed: false,
    errorType: 'invalid-utf8',
    complexity: 'simple',
    tags: ['utf8', 'text', 'truncated']
  });

  testCases.push({
    id: 'malformed-utf8-truncated-3byte',
    category: 'malformed',
    description: 'Invalid UTF-8: Truncated 3-byte sequence',
    inputHex: '62e282',
    expectedOutput: null,
    diagnosticNotation: '<invalid-utf8>',
    shouldSucceed: false,
    errorType: 'invalid-utf8',
    complexity: 'simple',
    tags: ['utf8', 'text', 'truncated']
  });

  testCases.push({
    id: 'malformed-utf8-invalid-continuation',
    category: 'malformed',
    description: 'Invalid UTF-8: Invalid continuation byte',
    inputHex: '62c241',
    expectedOutput: null,
    diagnosticNotation: '<invalid-utf8>',
    shouldSucceed: false,
    errorType: 'invalid-utf8',
    complexity: 'moderate',
    tags: ['utf8', 'text'],
    notes: 'Second byte should be 10xxxxxx'
  });

  testCases.push({
    id: 'malformed-utf8-beyond-unicode',
    category: 'malformed',
    description: 'Invalid UTF-8: Code point beyond U+10FFFF',
    inputHex: '64f4908080',
    expectedOutput: null,
    diagnosticNotation: '<invalid-utf8>',
    shouldSucceed: false,
    errorType: 'invalid-utf8',
    complexity: 'moderate',
    tags: ['utf8', 'text'],
    notes: 'Unicode only goes up to U+10FFFF'
  });

  // Break code misuse
  testCases.push({
    id: 'malformed-break-outside-indefinite',
    category: 'malformed',
    description: 'Break code (0xFF) outside indefinite context',
    inputHex: 'ff',
    expectedOutput: null,
    diagnosticNotation: '<invalid>',
    shouldSucceed: false,
    errorType: 'break-misuse',
    complexity: 'simple',
    tags: ['break', 'indefinite']
  });

  testCases.push({
    id: 'malformed-break-after-definite-array',
    category: 'malformed',
    description: 'Break code after definite-length array',
    inputHex: '83010203ff',
    expectedOutput: null,
    diagnosticNotation: '<invalid>',
    shouldSucceed: false,
    errorType: 'break-misuse',
    complexity: 'simple',
    tags: ['break', 'array']
  });

  testCases.push({
    id: 'malformed-break-as-map-key',
    category: 'malformed',
    description: 'Break code used as map key',
    inputHex: 'bfff01ff',
    expectedOutput: null,
    diagnosticNotation: '<invalid>',
    shouldSucceed: false,
    errorType: 'break-misuse',
    complexity: 'moderate',
    tags: ['break', 'map']
  });

  // Odd-length maps
  testCases.push({
    id: 'malformed-map-odd-elements',
    category: 'malformed',
    description: 'Map with odd number of elements (key without value)',
    inputHex: 'a16161',
    expectedOutput: null,
    diagnosticNotation: '<malformed>',
    shouldSucceed: false,
    errorType: 'odd-length-map',
    complexity: 'simple',
    tags: ['map', 'malformed']
  });

  testCases.push({
    id: 'malformed-map-indefinite-odd',
    category: 'malformed',
    description: 'Indefinite map with odd elements',
    inputHex: 'bf616101616202616303ff',
    expectedOutput: null,
    diagnosticNotation: '<malformed>',
    shouldSucceed: false,
    errorType: 'odd-length-map',
    complexity: 'moderate',
    tags: ['map', 'indefinite', 'malformed']
  });

  // Nested indefinite strings (invalid)
  testCases.push({
    id: 'malformed-nested-indefinite-bytes',
    category: 'malformed',
    description: 'Nested indefinite byte strings',
    inputHex: '5f5f4101ff42020 3ff',
    expectedOutput: null,
    diagnosticNotation: '<invalid>',
    shouldSucceed: false,
    errorType: 'nested-indefinite',
    complexity: 'moderate',
    tags: ['indefinite', 'bytes', 'nested'],
    notes: 'Indefinite strings cannot contain indefinite chunks'
  });

  testCases.push({
    id: 'malformed-nested-indefinite-text',
    category: 'malformed',
    description: 'Nested indefinite text strings',
    inputHex: '7f7f6161ff6262ff',
    expectedOutput: null,
    diagnosticNotation: '<invalid>',
    shouldSucceed: false,
    errorType: 'nested-indefinite',
    complexity: 'moderate',
    tags: ['indefinite', 'text', 'nested']
  });

  // Invalid simple values
  testCases.push({
    id: 'malformed-simple-reserved-0-19',
    category: 'malformed',
    description: 'Reserved simple value 19 in two-byte form',
    inputHex: 'f813',
    expectedOutput: null,
    diagnosticNotation: '<invalid>',
    shouldSucceed: false,
    errorType: 'invalid-simple',
    complexity: 'simple',
    tags: ['simple', 'reserved'],
    notes: 'Simple values 0-19 must use one-byte form'
  });

  testCases.push({
    id: 'malformed-simple-false-twobyte',
    category: 'malformed',
    description: 'False encoded in two-byte form',
    inputHex: 'f814',
    expectedOutput: null,
    diagnosticNotation: '<invalid>',
    shouldSucceed: false,
    errorType: 'invalid-simple',
    complexity: 'simple',
    tags: ['simple', 'boolean']
  });

  // Trailing bytes
  testCases.push({
    id: 'malformed-trailing-bytes-after-int',
    category: 'malformed',
    description: 'Trailing bytes after complete integer',
    inputHex: '0101',
    expectedOutput: null,
    diagnosticNotation: '<trailing-bytes>',
    shouldSucceed: false,
    errorType: 'trailing-bytes',
    complexity: 'simple',
    tags: ['trailing']
  });

  testCases.push({
    id: 'malformed-trailing-bytes-after-array',
    category: 'malformed',
    description: 'Trailing bytes after complete array',
    inputHex: '830102030405',
    expectedOutput: null,
    diagnosticNotation: '<trailing-bytes>',
    shouldSucceed: false,
    errorType: 'trailing-bytes',
    complexity: 'simple',
    tags: ['trailing', 'array']
  });

  // Invalid tag content
  testCases.push({
    id: 'malformed-tag-0-invalid-content',
    category: 'malformed',
    description: 'Tag 0 (datetime) with non-string content',
    inputHex: 'c001',
    expectedOutput: null,
    diagnosticNotation: '<invalid-tag-content>',
    shouldSucceed: false,
    errorType: 'invalid-tag-content',
    complexity: 'moderate',
    tags: ['tag', 'datetime'],
    notes: 'Tag 0 requires text string (RFC 3339)'
  });

  testCases.push({
    id: 'malformed-tag-1-invalid-content',
    category: 'malformed',
    description: 'Tag 1 (epoch) with string content',
    inputHex: 'c1656865 6c6c6f',
    expectedOutput: null,
    diagnosticNotation: '<invalid-tag-content>',
    shouldSucceed: false,
    errorType: 'invalid-tag-content',
    complexity: 'moderate',
    tags: ['tag', 'epoch'],
    notes: 'Tag 1 requires integer or float'
  });

  testCases.push({
    id: 'malformed-tag-2-invalid-content',
    category: 'malformed',
    description: 'Tag 2 (bignum) with non-bytes content',
    inputHex: 'c201',
    expectedOutput: null,
    diagnosticNotation: '<invalid-tag-content>',
    shouldSucceed: false,
    errorType: 'invalid-tag-content',
    complexity: 'moderate',
    tags: ['tag', 'bignum'],
    notes: 'Tag 2 requires byte string'
  });

  return {
    category: 'malformed',
    description: 'Malformed and Invalid CBOR Tests',
    version: '1.0',
    testCases
  };
}

// ============================================================================
// CANONICAL ENCODING TEST GENERATORS
// ============================================================================

function generateCanonicalTests(): TestSuite {
  const testCases: TestCase[] = [];

  // Non-canonical integers (using longer than needed encoding)
  testCases.push({
    id: 'canonical-uint-0-as-uint8',
    category: 'canonical',
    description: 'Non-canonical: 0 encoded with 1 extra byte',
    inputHex: '1800',
    expectedOutput: 0,
    diagnosticNotation: '0',
    shouldSucceed: true,
    errorType: 'non-canonical',
    complexity: 'simple',
    tags: ['non-canonical', 'integer'],
    notes: 'Should be 0x00, not 0x1800'
  });

  testCases.push({
    id: 'canonical-uint-23-as-uint8',
    category: 'canonical',
    description: 'Non-canonical: 23 encoded with 1 extra byte',
    inputHex: '1817',
    expectedOutput: 23,
    diagnosticNotation: '23',
    shouldSucceed: true,
    errorType: 'non-canonical',
    complexity: 'simple',
    tags: ['non-canonical', 'integer'],
    notes: 'Should be 0x17, not 0x1817'
  });

  testCases.push({
    id: 'canonical-uint-24-as-uint16',
    category: 'canonical',
    description: 'Non-canonical: 24 encoded with 2 extra bytes',
    inputHex: '190018',
    expectedOutput: 24,
    diagnosticNotation: '24',
    shouldSucceed: true,
    errorType: 'non-canonical',
    complexity: 'simple',
    tags: ['non-canonical', 'integer']
  });

  testCases.push({
    id: 'canonical-uint-255-as-uint16',
    category: 'canonical',
    description: 'Non-canonical: 255 encoded with 2 extra bytes',
    inputHex: '1900ff',
    expectedOutput: 255,
    diagnosticNotation: '255',
    shouldSucceed: true,
    errorType: 'non-canonical',
    complexity: 'simple',
    tags: ['non-canonical', 'integer']
  });

  testCases.push({
    id: 'canonical-uint-256-as-uint32',
    category: 'canonical',
    description: 'Non-canonical: 256 encoded with 4 extra bytes',
    inputHex: '1a00000100',
    expectedOutput: 256,
    diagnosticNotation: '256',
    shouldSucceed: true,
    errorType: 'non-canonical',
    complexity: 'simple',
    tags: ['non-canonical', 'integer']
  });

  // Non-canonical negative integers
  testCases.push({
    id: 'canonical-nint-minus1-as-int8',
    category: 'canonical',
    description: 'Non-canonical: -1 encoded with 1 extra byte',
    inputHex: '3800',
    expectedOutput: -1,
    diagnosticNotation: '-1',
    shouldSucceed: true,
    errorType: 'non-canonical',
    complexity: 'simple',
    tags: ['non-canonical', 'integer', 'negative']
  });

  // Indefinite-length (not canonical)
  testCases.push({
    id: 'canonical-indefinite-bytes',
    category: 'canonical',
    description: 'Non-canonical: Indefinite-length byte string',
    inputHex: '5f42010243030405ff',
    expectedOutput: '0102030405',
    diagnosticNotation: "(_ h'0102', h'030405')",
    shouldSucceed: true,
    errorType: 'non-canonical',
    complexity: 'moderate',
    tags: ['non-canonical', 'indefinite', 'bytes'],
    cardanoRelevance: 'Cardano requires definite-length encoding'
  });

  testCases.push({
    id: 'canonical-indefinite-text',
    category: 'canonical',
    description: 'Non-canonical: Indefinite-length text string',
    inputHex: '7f6548656c6c6f6120656657 6f726c64ff',
    expectedOutput: 'Hello World',
    diagnosticNotation: '(_ "Hello", " ", "World")',
    shouldSucceed: true,
    errorType: 'non-canonical',
    complexity: 'moderate',
    tags: ['non-canonical', 'indefinite', 'text']
  });

  testCases.push({
    id: 'canonical-indefinite-array',
    category: 'canonical',
    description: 'Non-canonical: Indefinite-length array',
    inputHex: '9f010203ff',
    expectedOutput: [1, 2, 3],
    diagnosticNotation: '[_ 1, 2, 3]',
    shouldSucceed: true,
    errorType: 'non-canonical',
    complexity: 'moderate',
    tags: ['non-canonical', 'indefinite', 'array']
  });

  testCases.push({
    id: 'canonical-indefinite-map',
    category: 'canonical',
    description: 'Non-canonical: Indefinite-length map',
    inputHex: 'bf616101616202ff',
    expectedOutput: { a: 1, b: 2 },
    diagnosticNotation: '{_ "a": 1, "b": 2}',
    shouldSucceed: true,
    errorType: 'non-canonical',
    complexity: 'moderate',
    tags: ['non-canonical', 'indefinite', 'map']
  });

  // Unsorted map keys
  testCases.push({
    id: 'canonical-map-unsorted-text',
    category: 'canonical',
    description: 'Non-canonical: Map with unsorted text keys',
    inputHex: 'a2626262016161 02',
    expectedOutput: { bb: 1, a: 2 },
    diagnosticNotation: '{"bb": 1, "a": 2}',
    shouldSucceed: true,
    errorType: 'unsorted-keys',
    complexity: 'moderate',
    tags: ['non-canonical', 'map', 'unsorted'],
    notes: 'Keys should be sorted by length first (a < bb)'
  });

  testCases.push({
    id: 'canonical-map-unsorted-length',
    category: 'canonical',
    description: 'Non-canonical: Map keys not sorted by length',
    inputHex: 'a2636161616162 016161616161616101',
    expectedOutput: { aaa: 2, aaaaaaa: 1 },
    diagnosticNotation: '{"aaa": 2, "aaaaaaa": 1}',
    shouldSucceed: true,
    errorType: 'unsorted-keys',
    complexity: 'moderate',
    tags: ['non-canonical', 'map', 'unsorted'],
    notes: 'Shorter keys must come first'
  });

  testCases.push({
    id: 'canonical-map-unsorted-lexicographic',
    category: 'canonical',
    description: 'Non-canonical: Same-length keys not in lexicographic order',
    inputHex: 'a261620161610 2',
    expectedOutput: { b: 1, a: 2 },
    diagnosticNotation: '{"b": 1, "a": 2}',
    shouldSucceed: true,
    errorType: 'unsorted-keys',
    complexity: 'moderate',
    tags: ['non-canonical', 'map', 'unsorted'],
    notes: 'Same-length keys must be lexicographically sorted'
  });

  // Duplicate map keys
  testCases.push({
    id: 'canonical-map-duplicate-text-keys',
    category: 'canonical',
    description: 'Non-canonical: Map with duplicate keys',
    inputHex: 'a3616101616102616103',
    expectedOutput: { a: 3 },
    diagnosticNotation: '{"a": 1, "a": 2, "a": 3}',
    shouldSucceed: true,
    errorType: 'duplicate-keys',
    complexity: 'moderate',
    tags: ['non-canonical', 'map', 'duplicate'],
    notes: 'Last value wins, but duplicates not allowed in canonical'
  });

  testCases.push({
    id: 'canonical-map-duplicate-int-keys',
    category: 'canonical',
    description: 'Non-canonical: Map with duplicate integer keys',
    inputHex: 'a40001010201020302',
    expectedOutput: { '0': 1, '1': 2, '2': 2 },
    diagnosticNotation: '{0: 1, 1: 2, 1: 2}',
    shouldSucceed: true,
    errorType: 'duplicate-keys',
    complexity: 'moderate',
    tags: ['non-canonical', 'map', 'duplicate', 'integer-key']
  });

  // Correctly sorted (canonical examples for reference)
  testCases.push({
    id: 'canonical-map-correct-sorting',
    category: 'canonical',
    description: 'Canonical: Correctly sorted map keys',
    inputHex: 'a3616101626262026363636303',
    expectedOutput: { a: 1, bb: 2, ccc: 3 },
    diagnosticNotation: '{"a": 1, "bb": 2, "ccc": 3}',
    shouldSucceed: true,
    complexity: 'moderate',
    tags: ['canonical', 'map', 'sorted'],
    notes: 'Keys sorted by length, then lexicographic - this is correct'
  });

  testCases.push({
    id: 'canonical-map-int-keys-sorted',
    category: 'canonical',
    description: 'Canonical: Integer keys in ascending order',
    inputHex: 'a5000101020203040305',
    expectedOutput: { '0': 0, '1': 1, '2': 2, '3': 3, '4': 4 },
    diagnosticNotation: '{0: 0, 1: 1, 2: 2, 3: 3, 4: 4}',
    shouldSucceed: true,
    complexity: 'simple',
    tags: ['canonical', 'map', 'integer-key'],
    notes: 'Integer keys sorted numerically'
  });

  return {
    category: 'canonical',
    description: 'Canonical Encoding Violation Tests',
    version: '1.0',
    testCases
  };
}

// ============================================================================
// LIMIT AND BOUNDARY TEST GENERATORS
// ============================================================================

function generateLimitTests(): TestSuite {
  const testCases: TestCase[] = [];

  // Excessive nesting
  const depth50 = '81'.repeat(50) + '01';
  testCases.push({
    id: 'limits-nesting-depth-50',
    category: 'limits',
    description: 'Deep nesting: 50 levels',
    inputHex: depth50,
    expectedOutput: JSON.parse('['.repeat(50) + '1' + ']'.repeat(50)),
    diagnosticNotation: '['.repeat(10) + '...' + ']'.repeat(10),
    shouldSucceed: true,
    complexity: 'complex',
    tags: ['nesting', 'deep', 'stack'],
    notes: 'Tests parser stack depth handling'
  });

  const depth100 = '81'.repeat(100) + '01';
  testCases.push({
    id: 'limits-nesting-depth-100',
    category: 'limits',
    description: 'Very deep nesting: 100 levels',
    inputHex: depth100,
    expectedOutput: JSON.parse('['.repeat(100) + '1' + ']'.repeat(100)),
    diagnosticNotation: '['.repeat(10) + '...' + ']'.repeat(10),
    shouldSucceed: true,
    complexity: 'extreme',
    tags: ['nesting', 'deep', 'stack'],
    notes: 'May cause stack overflow in some implementations'
  });

  const depth500 = '81'.repeat(500) + '01';
  testCases.push({
    id: 'limits-nesting-depth-500',
    category: 'limits',
    description: 'Extreme nesting: 500 levels',
    inputHex: depth500,
    expectedOutput: null,
    diagnosticNotation: '['.repeat(500) + '1' + ']'.repeat(500),
    shouldSucceed: false,
    errorType: 'excessive-nesting',
    complexity: 'extreme',
    tags: ['nesting', 'extreme', 'stack', 'negative-test'],
    notes: 'Should fail or limit nesting depth'
  });

  // Large arrays
  const array1000Header = '9903e8'; // Array of 1000 elements
  const array1000Elements = Array(1000).fill('01').join('');
  testCases.push({
    id: 'limits-array-1000-elements',
    category: 'limits',
    description: 'Large array: 1000 elements',
    inputHex: array1000Header + array1000Elements,
    expectedOutput: Array(1000).fill(1),
    diagnosticNotation: '[1, 1, 1, ... (1000 elements)]',
    shouldSucceed: true,
    complexity: 'complex',
    tags: ['array', 'large', 'performance']
  });

  const array10000Header = '9a00002710'; // Array of 10000 elements
  const array10000Elements = Array(10000).fill('01').join('');
  testCases.push({
    id: 'limits-array-10000-elements',
    category: 'limits',
    description: 'Very large array: 10000 elements',
    inputHex: array10000Header + array10000Elements,
    expectedOutput: Array(10000).fill(1),
    diagnosticNotation: '[1, 1, 1, ... (10000 elements)]',
    shouldSucceed: true,
    complexity: 'extreme',
    tags: ['array', 'large', 'performance']
  });

  // Large maps
  const map1000Header = 'b903e8'; // Map of 1000 pairs
  const map1000Pairs = Array.from({ length: 1000 }, (_, i) => {
    const keyHex = i <= 23 ? i.toString(16).padStart(2, '0') :
                   i <= 255 ? '18' + i.toString(16).padStart(2, '0') :
                   '19' + ((i >> 8) & 0xFF).toString(16).padStart(2, '0') + (i & 0xFF).toString(16).padStart(2, '0');
    return keyHex + '01';
  }).join('');

  testCases.push({
    id: 'limits-map-1000-pairs',
    category: 'limits',
    description: 'Large map: 1000 key-value pairs',
    inputHex: map1000Header + map1000Pairs,
    expectedOutput: Object.fromEntries(Array.from({ length: 1000 }, (_, i) => [i.toString(), 1])),
    diagnosticNotation: '{0: 1, 1: 1, ... (1000 pairs)}',
    shouldSucceed: true,
    complexity: 'extreme',
    tags: ['map', 'large', 'performance']
  });

  // Large byte strings
  const bytes64k = '5a00010000' + '00'.repeat(65536);
  testCases.push({
    id: 'limits-bytes-64kb',
    category: 'limits',
    description: 'Large byte string: 64 KB',
    inputHex: bytes64k,
    expectedOutput: '00'.repeat(65536),
    diagnosticNotation: "h'0000...' (64 KB)",
    shouldSucceed: true,
    complexity: 'complex',
    tags: ['bytes', 'large']
  });

  const bytes1mb = '5a000f4240' + '00'.repeat(1000000);
  testCases.push({
    id: 'limits-bytes-1mb',
    category: 'limits',
    description: 'Very large byte string: 1 MB',
    inputHex: bytes1mb,
    expectedOutput: '00'.repeat(1000000),
    diagnosticNotation: "h'0000...' (1 MB)",
    shouldSucceed: true,
    complexity: 'extreme',
    tags: ['bytes', 'large', 'performance']
  });

  // Large text strings
  const textLarge = '7a00002710' + Buffer.from('A'.repeat(10000)).toString('hex');
  testCases.push({
    id: 'limits-text-10k-chars',
    category: 'limits',
    description: 'Large text string: 10,000 characters',
    inputHex: textLarge,
    expectedOutput: 'A'.repeat(10000),
    diagnosticNotation: '"AAA..." (10k chars)',
    shouldSucceed: true,
    complexity: 'complex',
    tags: ['text', 'large']
  });

  // Integer boundaries
  testCases.push({
    id: 'limits-javascript-max-safe-int',
    category: 'limits',
    description: 'JavaScript MAX_SAFE_INTEGER boundary',
    inputHex: '1b001fffffffffffff',
    expectedOutput: 9007199254740991,
    diagnosticNotation: '9007199254740991',
    shouldSucceed: true,
    complexity: 'moderate',
    tags: ['integer', 'boundary', 'javascript'],
    notes: '2^53 - 1, maximum safe integer in JavaScript'
  });

  testCases.push({
    id: 'limits-javascript-beyond-safe-int',
    category: 'limits',
    description: 'Beyond JavaScript safe integer',
    inputHex: '1b0020000000000000',
    expectedOutput: '9007199254740992',
    diagnosticNotation: '9007199254740992',
    shouldSucceed: true,
    complexity: 'moderate',
    tags: ['integer', 'boundary', 'javascript', 'bigint'],
    notes: 'Requires BigInt support'
  });

  testCases.push({
    id: 'limits-uint64-max',
    category: 'limits',
    description: 'Maximum uint64 value',
    inputHex: '1bffffffffffffffff',
    expectedOutput: '18446744073709551615',
    diagnosticNotation: '18446744073709551615',
    shouldSucceed: true,
    complexity: 'moderate',
    tags: ['integer', 'boundary', 'uint64', 'bigint'],
    notes: '2^64 - 1'
  });

  // Cardano-specific limits
  testCases.push({
    id: 'limits-cardano-max-ada-supply',
    category: 'limits',
    description: 'Cardano maximum ADA supply (45 billion ADA)',
    inputHex: '1b0270801d666ab400',
    expectedOutput: '45000000000000000000',
    diagnosticNotation: '45000000000000000000',
    shouldSucceed: true,
    complexity: 'moderate',
    tags: ['cardano', 'ada', 'boundary'],
    cardanoRelevance: 'Maximum possible ADA in lovelace'
  });

  testCases.push({
    id: 'limits-plutus-bytes-64-max',
    category: 'limits',
    description: 'Plutus Data bounded bytes at maximum (64 bytes)',
    inputHex: '5840' + 'ff'.repeat(64),
    expectedOutput: 'ff'.repeat(64),
    diagnosticNotation: "h'FFFF...' (64 bytes)",
    shouldSucceed: true,
    complexity: 'simple',
    tags: ['cardano', 'plutus', 'bytes', 'boundary'],
    cardanoRelevance: 'Maximum Plutus Data byte string length'
  });

  testCases.push({
    id: 'limits-plutus-bytes-65-invalid',
    category: 'limits',
    description: 'Plutus Data bytes exceeding limit (65 bytes)',
    inputHex: '5841' + '00'.repeat(65),
    expectedOutput: null,
    diagnosticNotation: '<invalid>',
    shouldSucceed: false,
    errorType: 'invalid-tag-content',
    complexity: 'moderate',
    tags: ['cardano', 'plutus', 'bytes', 'boundary', 'negative-test'],
    cardanoRelevance: 'Plutus Data CDDL constrains bytes to 0-64 length'
  });

  testCases.push({
    id: 'limits-asset-name-32-max',
    category: 'limits',
    description: 'Cardano asset name at maximum (32 bytes)',
    inputHex: '5820' + '41'.repeat(32),
    expectedOutput: '41'.repeat(32),
    diagnosticNotation: "h'4141...' (32 bytes)",
    shouldSucceed: true,
    complexity: 'simple',
    tags: ['cardano', 'asset-name', 'boundary'],
    cardanoRelevance: 'Maximum asset name length'
  });

  testCases.push({
    id: 'limits-asset-name-33-invalid',
    category: 'limits',
    description: 'Cardano asset name exceeding limit (33 bytes)',
    inputHex: '5821' + '41'.repeat(33),
    expectedOutput: null,
    diagnosticNotation: '<invalid>',
    shouldSucceed: false,
    errorType: 'invalid-tag-content',
    complexity: 'simple',
    tags: ['cardano', 'asset-name', 'boundary', 'negative-test'],
    cardanoRelevance: 'Asset names must be 0-32 bytes'
  });

  return {
    category: 'limits',
    description: 'Boundary and Limit Tests',
    version: '1.0',
    testCases
  };
}

// ============================================================================
// MAIN GENERATOR FUNCTION
// ============================================================================

async function generateEdgeCases() {
  const testsDir = path.join(__dirname, '../../tests');
  const edgeCasesDir = path.join(testsDir, 'edge_cases');

  // Create directories
  if (!fs.existsSync(testsDir)) fs.mkdirSync(testsDir, { recursive: true });
  if (!fs.existsSync(edgeCasesDir)) fs.mkdirSync(edgeCasesDir, { recursive: true });

  console.log('Generating edge case test suites...\n');

  // Generate test suites
  const suites = [
    { file: 'malformed.json', generator: generateMalformedTests },
    { file: 'canonical.json', generator: generateCanonicalTests },
    { file: 'limits.json', generator: generateLimitTests }
  ];

  let totalTests = 0;

  for (const { file, generator } of suites) {
    const suite = generator();
    const filePath = path.join(edgeCasesDir, file);
    fs.writeFileSync(filePath, JSON.stringify(suite, null, 2));
    console.log(`✓ Generated ${file}: ${suite.testCases.length} tests`);
    totalTests += suite.testCases.length;
  }

  console.log(`\nTotal edge case tests generated: ${totalTests}`);
}

// Run if called directly
if (require.main === module) {
  generateEdgeCases().catch(console.error);
}

export { generateEdgeCases };
