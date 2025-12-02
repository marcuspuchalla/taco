# API Reference

**Version:** 1.0
**Last Updated:** 2025-10-26

---

## Table of Contents

1. [Overview](#overview)
2. [CBORTestRunner](#cbortestrunner)
3. [TestValidator](#testvalidator)
4. [TestReporter](#testreporter)
5. [Types and Interfaces](#types-and-interfaces)
6. [Examples](#examples)

---

## Overview

The CBOR Test Suite provides a comprehensive TypeScript API for testing CBOR encoder/decoder implementations. This document covers all public APIs.

### Installation

```bash
npm install cbor-cardano-test-suite
```

### Basic Usage

```typescript
import { CBORTestRunner, CBOREncoder } from 'cbor-cardano-test-suite';

// Implement CBOREncoder interface
const myEncoder: CBOREncoder = {
  name: 'my-cbor-lib',
  version: '1.0.0',
  encode: (value) => { /* ... */ },
  decode: (bytes) => { /* ... */ }
};

// Run tests
const runner = new CBORTestRunner(myEncoder);
const results = await runner.runAllTests();
```

---

## CBORTestRunner

Main class for executing test suites.

### Constructor

```typescript
constructor(encoder: CBOREncoder, config?: Partial<TestRunnerConfig>)
```

**Parameters:**
- `encoder`: CBOREncoder - Your CBOR implementation
- `config`: Partial<TestRunnerConfig> - Optional configuration

**Example:**

```typescript
const runner = new CBORTestRunner(myEncoder, {
  verbose: true,
  testRoundTrip: true,
  testCanonical: false,
  timeout: 5000,
  failFast: false
});
```

### Methods

#### `runAllTests(testsDir?: string): Promise<TestRunResults>`

Run all test suites (core, Cardano, edge cases).

**Parameters:**
- `testsDir`: string (optional) - Path to tests directory (defaults to `./tests`)

**Returns:** `Promise<TestRunResults>`

**Example:**

```typescript
const results = await runner.runAllTests();
console.log(`Passed: ${results.summary.passed}/${results.summary.totalTests}`);
```

#### `runCategory(category: TestCategory, testsDir?: string): Promise<TestSuiteResults>`

Run tests for a specific category.

**Parameters:**
- `category`: TestCategory - Category to run
- `testsDir`: string (optional) - Path to tests directory

**Returns:** `Promise<TestSuiteResults>`

**Example:**

```typescript
const plutusResults = await runner.runCategory('plutus-data');
console.log(`Plutus tests: ${plutusResults.passed}/${plutusResults.totalTests} passed`);
```

---

## TestValidator

Validates test case structure and integrity.

### Constructor

```typescript
constructor()
```

### Methods

#### `validateTestCase(testCase: CBORTestCase): ValidationResult`

Validate a single test case.

**Parameters:**
- `testCase`: CBORTestCase - Test case to validate

**Returns:** `ValidationResult`

**Example:**

```typescript
import { TestValidator } from 'cbor-cardano-test-suite';

const validator = new TestValidator();
const result = validator.validateTestCase(testCase);

if (!result.valid) {
  console.error('Validation errors:', result.errors);
}
```

#### `validateSuite(testCases: CBORTestCase[]): ValidationResult`

Validate an entire test suite.

**Parameters:**
- `testCases`: CBORTestCase[] - Array of test cases

**Returns:** `ValidationResult`

**Example:**

```typescript
const result = validator.validateSuite(allTests);
console.log(`Valid: ${result.valid}`);
console.log(`Errors: ${result.errors.length}`);
console.log(`Warnings: ${result.warnings.length}`);
```

#### `checkDuplicates(testCases: CBORTestCase[]): string[]`

Check for duplicate test IDs.

**Parameters:**
- `testCases`: CBORTestCase[] - Array of test cases

**Returns:** `string[]` - Array of duplicate IDs

**Example:**

```typescript
const duplicates = validator.checkDuplicates(testCases);
if (duplicates.length > 0) {
  console.warn('Duplicate test IDs:', duplicates);
}
```

#### `generateStatistics(testCases: CBORTestCase[]): Statistics`

Generate statistics about a test suite.

**Parameters:**
- `testCases`: CBORTestCase[] - Array of test cases

**Returns:** Object with statistics

**Example:**

```typescript
const stats = validator.generateStatistics(testCases);
console.log('Total tests:', stats.total);
console.log('By category:', stats.byCategory);
console.log('By complexity:', stats.byComplexity);
console.log('Positive/Negative:', stats.positive, stats.negative);
```

---

## TestReporter

Generates test reports in various formats.

### Constructor

```typescript
constructor()
```

### Methods

#### `generate(results: TestRunResults, format: ReportFormat): string`

Generate report in specified format.

**Parameters:**
- `results`: TestRunResults - Test execution results
- `format`: ReportFormat - Output format ('json' | 'html' | 'markdown' | 'csv' | 'console')

**Returns:** `string` - Generated report

**Example:**

```typescript
import { TestReporter } from 'cbor-cardano-test-suite';

const reporter = new TestReporter();

// Generate HTML report
const htmlReport = reporter.generate(results, 'html');

// Generate Markdown report
const mdReport = reporter.generate(results, 'markdown');

// Generate CSV report
const csvReport = reporter.generate(results, 'csv');
```

#### `save(results: TestRunResults, format: ReportFormat, filePath: string): Promise<void>`

Save report to file.

**Parameters:**
- `results`: TestRunResults - Test execution results
- `format`: ReportFormat - Output format
- `filePath`: string - Destination file path

**Returns:** `Promise<void>`

**Example:**

```typescript
// Save HTML report
await reporter.save(results, 'html', './reports/results.html');

// Save JSON report
await reporter.save(results, 'json', './reports/results.json');

// Save Markdown report
await reporter.save(results, 'markdown', './reports/RESULTS.md');
```

---

## Types and Interfaces

### CBOREncoder

Interface that your CBOR implementation must satisfy.

```typescript
interface CBOREncoder {
  /** Implementation name */
  name: string;

  /** Implementation version (optional) */
  version?: string;

  /** Supported features (optional) */
  features?: string[];

  /** Encode value to CBOR bytes */
  encode(value: unknown): Uint8Array;

  /** Decode CBOR bytes to value */
  decode(bytes: Uint8Array): unknown;

  /** Encode value to canonical CBOR (optional) */
  encodeCanonical?(value: unknown): Uint8Array;

  /** Get diagnostic notation (optional) */
  toDiagnostic?(bytes: Uint8Array): string;
}
```

**Example Implementation:**

```typescript
const myEncoder: CBOREncoder = {
  name: 'my-cbor-lib',
  version: '1.0.0',
  features: ['bigint', 'maps', 'canonical'],

  encode(value: unknown): Uint8Array {
    // Your encoding logic
    return new Uint8Array([/* ... */]);
  },

  decode(bytes: Uint8Array): unknown {
    // Your decoding logic
    return /* decoded value */;
  },

  encodeCanonical(value: unknown): Uint8Array {
    // Your canonical encoding logic
    return new Uint8Array([/* ... */]);
  },

  toDiagnostic(bytes: Uint8Array): string {
    // Your diagnostic notation logic
    return '/* diagnostic notation */';
  }
};
```

### CBORTestCase

Structure of a single test case.

```typescript
interface CBORTestCase {
  /** Unique test identifier */
  id: string;

  /** Test category */
  category: TestCategory;

  /** Human-readable description */
  description: string;

  /** CBOR bytes as hex string */
  inputHex: string;

  /** Expected decoded value */
  expectedOutput: unknown;

  /** CBOR diagnostic notation */
  diagnosticNotation: string;

  /** Should decoding succeed? */
  shouldSucceed: boolean;

  /** Expected error type (if shouldSucceed=false) */
  errorType?: ErrorType;

  /** Tags for filtering */
  tags?: string[];

  /** Complexity rating */
  complexity: TestComplexity;

  /** Cardano relevance (optional) */
  cardanoRelevance?: string;

  /** RFC section reference (optional) */
  rfcSection?: string;

  /** CIP reference (optional) */
  cip?: string;

  /** Additional notes (optional) */
  notes?: string;
}
```

### TestRunnerConfig

Configuration options for test runner.

```typescript
interface TestRunnerConfig {
  /** Filter by categories */
  categories?: TestCategory[];

  /** Filter by tags */
  tags?: string[];

  /** Filter by complexity */
  complexity?: TestComplexity[];

  /** Test round-trip encoding (default: true) */
  testRoundTrip?: boolean;

  /** Test canonical encoding (default: false) */
  testCanonical?: boolean;

  /** Timeout per test in ms (default: 5000) */
  timeout?: number;

  /** Stop on first failure (default: false) */
  failFast?: boolean;

  /** Verbose output (default: false) */
  verbose?: boolean;
}
```

### TestResult

Result of a single test execution.

```typescript
interface TestResult {
  /** Test identifier */
  testId: string;

  /** Did the test pass? */
  passed: boolean;

  /** Actual decoded output (if any) */
  actualOutput?: unknown;

  /** Error information (if failed) */
  error?: {
    type: string;
    message: string;
    stack?: string;
  };

  /** Execution duration in ms */
  duration: number;

  /** Round-trip test success (if tested) */
  roundTripSuccess?: boolean;

  /** Canonical encoding match (if tested) */
  canonicalMatch?: boolean;
}
```

### TestSuiteResults

Results for a test suite (category).

```typescript
interface TestSuiteResults {
  /** Suite category name */
  category: string;

  /** Total number of tests */
  totalTests: number;

  /** Number of passed tests */
  passed: number;

  /** Number of failed tests */
  failed: number;

  /** Number of skipped tests */
  skipped: number;

  /** Total duration in ms */
  duration: number;

  /** Individual test results */
  tests: TestResult[];

  /** Coverage percentage (optional) */
  coverage?: number;
}
```

### TestRunResults

Complete test run results.

```typescript
interface TestRunResults {
  /** Execution timestamp */
  timestamp: Date;

  /** Results for each suite */
  suites: TestSuiteResults[];

  /** Overall summary */
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
    successRate: number;  // Percentage
  };

  /** Implementation information */
  implementation: {
    name: string;
    version?: string;
    features?: string[];
  };
}
```

### ValidationResult

Result of test case validation.

```typescript
interface ValidationResult {
  /** Is the test case valid? */
  valid: boolean;

  /** Validation errors */
  errors: string[];

  /** Validation warnings */
  warnings: string[];
}
```

### Type Unions

```typescript
type TestCategory =
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
  | 'metadata'
  | 'primitives'
  | 'malformed'
  | 'canonical'
  | 'limits'
  | 'integration';

type TestComplexity =
  | 'trivial'
  | 'simple'
  | 'moderate'
  | 'complex'
  | 'extreme';

type ErrorType =
  | 'truncated'
  | 'invalid-additional-info'
  | 'invalid-utf8'
  | 'break-misuse'
  | 'odd-length-map'
  | 'nested-indefinite'
  | 'invalid-tag-content'
  | 'integer-overflow'
  | 'excessive-nesting'
  | 'invalid-simple'
  | 'trailing-bytes'
  | 'non-canonical'
  | 'duplicate-keys'
  | 'unsorted-keys';

type ReportFormat =
  | 'json'
  | 'html'
  | 'markdown'
  | 'csv'
  | 'console';
```

---

## Examples

### Example 1: Basic Test Execution

```typescript
import { CBORTestRunner, CBOREncoder } from 'cbor-cardano-test-suite';

const encoder: CBOREncoder = {
  name: 'my-library',
  version: '1.0.0',
  encode: (val) => myEncode(val),
  decode: (bytes) => myDecode(bytes)
};

const runner = new CBORTestRunner(encoder);
const results = await runner.runAllTests();

console.log(`Success rate: ${results.summary.successRate.toFixed(2)}%`);
```

### Example 2: Filtered Test Execution

```typescript
// Run only Cardano-specific tests
const runner = new CBORTestRunner(encoder, {
  categories: ['plutus-data', 'transactions', 'metadata'],
  verbose: true
});

const results = await runner.runAllTests();
```

### Example 3: Test with Round-Trip Validation

```typescript
const runner = new CBORTestRunner(encoder, {
  testRoundTrip: true,
  testCanonical: true,
  verbose: false
});

const results = await runner.runAllTests();

// Check if any round-trip failures
const roundTripFailures = results.suites.flatMap(suite =>
  suite.tests.filter(t => t.roundTripSuccess === false)
);

if (roundTripFailures.length > 0) {
  console.error('Round-trip failures:', roundTripFailures.length);
}
```

### Example 4: Generate Multiple Report Formats

```typescript
import { TestReporter } from 'cbor-cardano-test-suite';

const reporter = new TestReporter();

// Run tests
const results = await runner.runAllTests();

// Save in multiple formats
await reporter.save(results, 'html', './reports/results.html');
await reporter.save(results, 'json', './reports/results.json');
await reporter.save(results, 'markdown', './reports/RESULTS.md');
await reporter.save(results, 'csv', './reports/results.csv');

console.log('Reports generated successfully!');
```

### Example 5: Validate Test Cases

```typescript
import { TestValidator } from 'cbor-cardano-test-suite';
import * as fs from 'fs';

// Load test file
const testFile = JSON.parse(fs.readFileSync('./tests/core/01_unsigned_integers.json', 'utf-8'));

// Validate
const validator = new TestValidator();
const result = validator.validateSuite(testFile.testCases);

if (result.valid) {
  console.log('✓ All test cases are valid');
} else {
  console.error('✗ Validation errors:', result.errors);
}

if (result.warnings.length > 0) {
  console.warn('⚠ Warnings:', result.warnings);
}
```

### Example 6: Custom Test Filtering

```typescript
// Run only complex Plutus Data tests
const runner = new CBORTestRunner(encoder, {
  categories: ['plutus-data'],
  complexity: ['complex', 'extreme'],
  tags: ['nested', 'constructor'],
  verbose: true
});

const results = await runner.runCategory('plutus-data');
```

### Example 7: Performance Testing

```typescript
const runner = new CBORTestRunner(encoder, {
  categories: ['limits'],
  tags: ['performance', 'large'],
  timeout: 60000,  // 60 seconds for stress tests
  verbose: true
});

const results = await runner.runAllTests();

// Analyze performance
const slowTests = results.suites.flatMap(suite =>
  suite.tests.filter(t => t.duration > 1000)  // > 1 second
);

console.log(`Slow tests (>1s): ${slowTests.length}`);
slowTests.forEach(t => {
  console.log(`  ${t.testId}: ${t.duration}ms`);
});
```

### Example 8: CI/CD Integration

```typescript
// ci-test.ts
import { CBORTestRunner } from 'cbor-cardano-test-suite';

async function runCITests() {
  const encoder = createYourEncoder();
  const runner = new CBORTestRunner(encoder, {
    failFast: false,
    verbose: false
  });

  const results = await runner.runAllTests();

  // Generate reports
  await reporter.save(results, 'json', './reports/ci-results.json');
  await reporter.save(results, 'html', './reports/ci-results.html');

  // Exit with appropriate code
  if (results.summary.failed > 0) {
    console.error(`✗ ${results.summary.failed} tests failed`);
    process.exit(1);
  } else {
    console.log(`✓ All ${results.summary.totalTests} tests passed`);
    process.exit(0);
  }
}

runCITests().catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});
```

### Example 9: Comparing Two Implementations

```typescript
// Compare two CBOR libraries
async function compareImplementations(encoder1: CBOREncoder, encoder2: CBOREncoder) {
  const runner1 = new CBORTestRunner(encoder1);
  const runner2 = new CBORTestRunner(encoder2);

  const results1 = await runner1.runAllTests();
  const results2 = await runner2.runAllTests();

  console.log(`${encoder1.name}: ${results1.summary.successRate.toFixed(2)}%`);
  console.log(`${encoder2.name}: ${results2.summary.successRate.toFixed(2)}%`);

  // Find tests that pass in one but fail in the other
  const results1Map = new Map(
    results1.suites.flatMap(s => s.tests).map(t => [t.testId, t.passed])
  );
  const results2Map = new Map(
    results2.suites.flatMap(s => s.tests).map(t => [t.testId, t.passed])
  );

  const differences: string[] = [];
  for (const [testId, passed1] of results1Map) {
    const passed2 = results2Map.get(testId);
    if (passed1 !== passed2) {
      differences.push(testId);
    }
  }

  if (differences.length > 0) {
    console.log(`\nTests with different results: ${differences.length}`);
    differences.forEach(id => console.log(`  - ${id}`));
  }
}
```

### Example 10: Custom Error Handling

```typescript
const runner = new CBORTestRunner(encoder, {
  verbose: true
});

try {
  const results = await runner.runAllTests();

  // Analyze failures
  const failures = results.suites.flatMap(suite =>
    suite.tests.filter(t => !t.passed)
  );

  // Group failures by error type
  const byErrorType = new Map<string, TestResult[]>();
  failures.forEach(result => {
    const errorType = result.error?.type || 'unknown';
    if (!byErrorType.has(errorType)) {
      byErrorType.set(errorType, []);
    }
    byErrorType.get(errorType)!.push(result);
  });

  // Report grouped failures
  console.log('\n=== Failure Analysis ===');
  byErrorType.forEach((tests, errorType) => {
    console.log(`\n${errorType} (${tests.length} tests):`);
    tests.forEach(t => console.log(`  - ${t.testId}`));
  });

} catch (error) {
  console.error('Test execution error:', error);
  process.exit(1);
}
```

---

## Additional Resources

- [Test Suite Guide](./TEST_SUITE_GUIDE.md)
- [Cardano CBOR Handbook](./CARDANO_CBOR_HANDBOOK.md)
- [CBOR Research Report](./CBOR_RESEARCH.md)
- [GitHub Repository](https://github.com/your-org/cbor-cardano-test-suite)

---

**Version:** 1.0
**Maintainer:** TACO Team
**License:** MIT
