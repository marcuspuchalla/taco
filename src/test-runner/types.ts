/**
 * CBOR Test Suite - Type Definitions
 * Comprehensive type system for CBOR testing framework
 */

/**
 * Test complexity levels
 */
export type TestComplexity = 'trivial' | 'simple' | 'moderate' | 'complex' | 'extreme';

/**
 * Test categories for organization
 */
export type TestCategory =
  | 'unsigned-integers'
  | 'negative-integers'
  | 'byte-strings'
  | 'text-strings'
  | 'arrays'
  | 'maps'
  | 'tags'
  | 'simple-floats'
  | 'plutus-data'
  | 'transactions'
  | 'addresses'
  | 'metadata'
  | 'primitives'
  | 'malformed'
  | 'canonical'
  | 'limits'
  | 'integration';

/**
 * Expected error types for negative tests
 */
export type ErrorType =
  | 'truncated'              // Incomplete data
  | 'invalid-additional-info' // Reserved values 28-30
  | 'invalid-utf8'           // Malformed UTF-8 in text strings
  | 'break-misuse'           // Break code outside indefinite
  | 'odd-length-map'         // Map with unpaired items
  | 'nested-indefinite'      // Indefinite within indefinite (strings)
  | 'invalid-tag-content'    // Tag with wrong content type
  | 'integer-overflow'       // Value exceeds implementation limit
  | 'excessive-nesting'      // Stack overflow from deep nesting
  | 'invalid-simple'         // Reserved simple value
  | 'trailing-bytes'         // Extra data after complete item
  | 'non-canonical'          // Valid but not canonical encoding
  | 'duplicate-keys'         // Map with duplicate keys
  | 'unsorted-keys';         // Map keys not in canonical order

/**
 * Plutus Data structure types
 */
export interface PlutusDataConstructor {
  constructor: number;
  fields: PlutusDataValue[];
}

export type PlutusDataValue =
  | number
  | bigint
  | Uint8Array
  | PlutusDataConstructor
  | PlutusDataValue[]
  | Map<PlutusDataValue, PlutusDataValue>;

/**
 * Cardano transaction input
 */
export interface TransactionInput {
  transactionId: string; // Hex-encoded transaction hash
  index: number;
}

/**
 * Cardano address (simplified)
 */
export interface Address {
  type: 'byron' | 'shelley' | 'pointer' | 'stake';
  network: 'mainnet' | 'testnet';
  paymentCredential?: string;
  stakeCredential?: string;
  raw: Uint8Array;
}

/**
 * Multi-asset value
 */
export interface MultiAsset {
  policyId: string; // Hex-encoded policy ID (28 bytes)
  assets: Map<string, bigint>; // asset name -> amount
}

/**
 * Transaction output
 */
export interface TransactionOutput {
  address: Address | Uint8Array;
  amount: bigint; // Lovelace
  multiAsset?: MultiAsset[];
  datum?: Datum;
  referenceScript?: Uint8Array;
}

/**
 * Datum options
 */
export type Datum =
  | { type: 'hash'; hash: string }
  | { type: 'inline'; data: PlutusDataValue };

/**
 * Redeemer with execution units
 */
export interface Redeemer {
  tag: 'spend' | 'mint' | 'cert' | 'reward' | 'voting' | 'proposing';
  index: number;
  data: PlutusDataValue;
  exUnits: {
    mem: bigint;
    steps: bigint;
  };
}

/**
 * CIP-25 NFT metadata structure
 */
export interface CIP25Metadata {
  name: string;
  image: string | string[];
  mediaType?: string;
  description?: string | string[];
  files?: Array<{
    name?: string;
    mediaType: string;
    src: string | string[];
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

/**
 * Core test case structure
 */
export interface CBORTestCase {
  /** Unique test identifier */
  id: string;

  /** Test category for organization */
  category: TestCategory;

  /** Human-readable description of what is being tested */
  description: string;

  /** CBOR bytes as hex string (without 0x prefix) */
  inputHex: string;

  /** Expected decoded value (JSON-serializable) */
  expectedOutput: unknown;

  /** CBOR diagnostic notation (human-readable) */
  diagnosticNotation: string;

  /** Whether this test should succeed or fail */
  shouldSucceed: boolean;

  /** Expected error type if shouldSucceed=false */
  errorType?: ErrorType;

  /** Tags for filtering and search */
  tags?: string[];

  /** Complexity rating */
  complexity: TestComplexity;

  /** Why this test matters for Cardano (optional) */
  cardanoRelevance?: string;

  /** RFC 8949 section reference (optional) */
  rfcSection?: string;

  /** CIP reference if applicable (optional) */
  cip?: string;

  /** Additional notes (optional) */
  notes?: string;
}

/**
 * Test result for a single test case
 */
export interface TestResult {
  testId: string;
  passed: boolean;
  actualOutput?: unknown;
  error?: {
    type: string;
    message: string;
    stack?: string;
  };
  duration: number; // milliseconds
  roundTripSuccess?: boolean; // Did re-encoding match original?
  canonicalMatch?: boolean; // Did canonical encoding match?
}

/**
 * Test suite results
 */
export interface TestSuiteResults {
  category: string;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number; // milliseconds
  tests: TestResult[];
  coverage?: number; // percentage
}

/**
 * Complete test run results
 */
export interface TestRunResults {
  timestamp: Date;
  suites: TestSuiteResults[];
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
    successRate: number;
  };
  implementation: {
    name: string;
    version?: string;
    features?: string[];
  };
}

/**
 * CBOR encoder interface that implementations must provide
 */
export interface CBOREncoder {
  /** Encode value to CBOR bytes */
  encode(value: unknown): Uint8Array;

  /** Decode CBOR bytes to value */
  decode(bytes: Uint8Array): unknown;

  /** Encode value to canonical CBOR (optional) */
  encodeCanonical?(value: unknown): Uint8Array;

  /** Get diagnostic notation (optional) */
  toDiagnostic?(bytes: Uint8Array): string;

  /** Implementation name */
  name: string;

  /** Implementation version (optional) */
  version?: string;

  /** Supported features (optional) */
  features?: string[];
}

/**
 * Test runner configuration
 */
export interface TestRunnerConfig {
  /** Which test categories to run */
  categories?: TestCategory[];

  /** Tags to filter by */
  tags?: string[];

  /** Complexity levels to include */
  complexity?: TestComplexity[];

  /** Whether to test round-trip encoding */
  testRoundTrip?: boolean;

  /** Whether to test canonical encoding */
  testCanonical?: boolean;

  /** Timeout per test in milliseconds */
  timeout?: number;

  /** Whether to stop on first failure */
  failFast?: boolean;

  /** Verbose output */
  verbose?: boolean;
}

/**
 * Report format options
 */
export type ReportFormat = 'json' | 'html' | 'markdown' | 'csv' | 'console';

/**
 * Test report generator interface
 */
export interface TestReporter {
  /** Generate report in specified format */
  generate(results: TestRunResults, format: ReportFormat): string;

  /** Save report to file */
  save(results: TestRunResults, format: ReportFormat, path: string): Promise<void>;
}

/**
 * Validation result for a test case
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Test validator interface
 */
export interface TestValidator {
  /** Validate test case structure */
  validateTestCase(testCase: CBORTestCase): ValidationResult;

  /** Validate entire test suite */
  validateSuite(testCases: CBORTestCase[]): ValidationResult;

  /** Check for duplicate test IDs */
  checkDuplicates(testCases: CBORTestCase[]): string[];
}
