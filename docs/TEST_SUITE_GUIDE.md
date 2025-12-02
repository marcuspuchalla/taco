# CBOR Test Suite Guide

**Version:** 1.0
**Last Updated:** 2025-10-26

---

## Table of Contents

1. [Introduction](#introduction)
2. [Test Organization](#test-organization)
3. [Test Case Format](#test-case-format)
4. [Running Tests](#running-tests)
5. [Adding New Tests](#adding-new-tests)
6. [Test Categories](#test-categories)
7. [Filtering and Selection](#filtering-and-selection)
8. [Report Generation](#report-generation)
9. [Troubleshooting](#troubleshooting)

---

## Introduction

TACO (TACO's A CBOR Observer) provides comprehensive test coverage for CBOR encoder/decoder implementations, with special emphasis on Cardano blockchain requirements. This guide explains how to use the test suite effectively.

### Key Features

- **1000+ test cases** covering RFC 8949 and Cardano extensions
- **Automated test runners** with multiple output formats
- **Comprehensive coverage** of edge cases and error conditions
- **Cardano-specific tests** for Plutus Data, transactions, and metadata
- **Multiple report formats** (JSON, HTML, Markdown, CSV)

---

## Test Organization

### Directory Structure

```
tests/
├── core/                    # RFC 8949 CBOR compliance tests
│   ├── 01_unsigned_integers.json
│   ├── 02_negative_integers.json
│   ├── 03_byte_strings.json
│   ├── 04_text_strings.json
│   ├── 05_arrays.json
│   ├── 06_maps.json
│   ├── 07_tags.json
│   └── 08_simple_floats.json
├── cardano/                 # Cardano-specific tests
│   ├── plutus_data.json
│   ├── transactions.json
│   ├── metadata_cip25.json
│   └── primitives.json
├── edge_cases/              # Error conditions and limits
│   ├── malformed.json
│   ├── canonical.json
│   └── limits.json
└── integration/             # Real-world examples
    ├── real_transactions.json
    └── smart_contracts.json
```

### Test Categories

| Category | Count | Description |
|----------|-------|-------------|
| **Core CBOR** |
| unsigned-integers | 36+ | RFC 8949 major type 0 |
| negative-integers | 29+ | RFC 8949 major type 1 |
| byte-strings | 20+ | RFC 8949 major type 2 |
| text-strings | 25+ | RFC 8949 major type 3 |
| arrays | 20+ | RFC 8949 major type 4 |
| maps | 25+ | RFC 8949 major type 5 |
| tags | 20+ | RFC 8949 major type 6 |
| simple-floats | 20+ | RFC 8949 major type 7 |
| **Cardano** |
| plutus-data | 40+ | All 5 Plutus Data variants |
| transactions | 20+ | Transaction components |
| metadata | 10+ | CIP-25 NFT metadata |
| primitives | 15+ | Ed25519, hashes, policy IDs |
| **Edge Cases** |
| malformed | 40+ | Invalid CBOR patterns |
| canonical | 20+ | Non-canonical encodings |
| limits | 25+ | Boundary and stress tests |

---

## Test Case Format

Each test case is a JSON object with the following structure:

```typescript
{
  "id": "uint-000",                    // Unique identifier
  "category": "unsigned-integers",     // Test category
  "description": "Minimum value: 0",  // Human-readable description
  "inputHex": "00",                    // CBOR bytes as hex
  "expectedOutput": 0,                 // Expected decoded value
  "diagnosticNotation": "0",           // CBOR diagnostic notation
  "shouldSucceed": true,               // Should decode successfully?
  "complexity": "trivial",             // Complexity rating

  // Optional fields
  "errorType": "truncated",            // Expected error type (if shouldSucceed=false)
  "tags": ["boundary", "minimum"],     // Tags for filtering
  "rfcSection": "3.1",                 // RFC 8949 section reference
  "cardanoRelevance": "...",           // Why this matters for Cardano
  "cip": "CIP-25",                     // CIP reference
  "notes": "Additional context"        // Implementation notes
}
```

### Field Descriptions

#### Required Fields

- **`id`**: Unique test identifier (e.g., `"uint-000"`, `"plutus-constructor-0"`)
- **`category`**: Test category from the predefined list
- **`description`**: Clear description of what is being tested
- **`inputHex`**: CBOR bytes as hexadecimal string (no `0x` prefix)
- **`expectedOutput`**: The expected decoded value (JSON-serializable)
- **`diagnosticNotation`**: Human-readable CBOR diagnostic format
- **`shouldSucceed`**: `true` if decode should succeed, `false` for negative tests
- **`complexity`**: One of: `trivial`, `simple`, `moderate`, `complex`, `extreme`

#### Optional Fields

- **`errorType`**: For negative tests, the expected error type
- **`tags`**: Array of tags for filtering (e.g., `["boundary", "bigint"]`)
- **`rfcSection`**: RFC 8949 section reference
- **`cardanoRelevance`**: Explanation of Cardano-specific importance
- **`cip`**: Cardano Improvement Proposal reference
- **`notes`**: Additional context or implementation guidance

### Complexity Ratings

- **Trivial**: Single-byte, most basic cases
- **Simple**: Straightforward, no special handling needed
- **Moderate**: Requires some special consideration
- **Complex**: Multiple edge cases or nested structures
- **Extreme**: Stress tests, very large data, deep nesting

---

## Running Tests

### Basic Usage

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run specific category
npm run test:core
npm run test:cardano
npm run test:edge

# Run with verbose output
npm run test:verbose
```

### Programmatic Usage

```typescript
import { CBORTestRunner } from './src/test-runner';
import { YourCBOREncoder } from './your-library';

// Create encoder instance
const encoder = new YourCBOREncoder();

// Create test runner
const runner = new CBORTestRunner(encoder, {
  verbose: true,
  testRoundTrip: true,
  testCanonical: false,
  failFast: false
});

// Run all tests
const results = await runner.runAllTests();

// Check results
console.log(`Passed: ${results.summary.passed}/${results.summary.totalTests}`);
console.log(`Success rate: ${results.summary.successRate.toFixed(2)}%`);
```

### Configuration Options

```typescript
interface TestRunnerConfig {
  categories?: TestCategory[];     // Filter by categories
  tags?: string[];                 // Filter by tags
  complexity?: TestComplexity[];   // Filter by complexity
  testRoundTrip?: boolean;         // Test re-encoding (default: true)
  testCanonical?: boolean;         // Test canonical encoding (default: false)
  timeout?: number;                // Timeout per test (ms, default: 5000)
  failFast?: boolean;              // Stop on first failure (default: false)
  verbose?: boolean;               // Verbose output (default: false)
}
```

### Example: Filter by Category

```typescript
const runner = new CBORTestRunner(encoder, {
  categories: ['plutus-data', 'transactions'],
  verbose: true
});

const results = await runner.runAllTests();
```

### Example: Filter by Tags

```typescript
const runner = new CBORTestRunner(encoder, {
  tags: ['cardano', 'bigint'],
  verbose: false
});

const results = await runner.runAllTests();
```

### Example: Filter by Complexity

```typescript
// Run only simple tests
const runner = new CBORTestRunner(encoder, {
  complexity: ['trivial', 'simple'],
  verbose: true
});

const results = await runner.runAllTests();
```

---

## Adding New Tests

### Manual Test Creation

1. Choose the appropriate category and file
2. Create a new test case object
3. Assign a unique ID (follow existing naming convention)
4. Generate the CBOR hex manually or using a tool
5. Add the test to the testCases array

**Example:**

```json
{
  "id": "uint-new-test",
  "category": "unsigned-integers",
  "description": "Your test description",
  "inputHex": "19 0400",
  "expectedOutput": 1024,
  "diagnosticNotation": "1024",
  "shouldSucceed": true,
  "complexity": "simple",
  "tags": ["custom"],
  "notes": "Your notes here"
}
```

### Using Generators

For bulk test creation, use the generator scripts:

```bash
# Generate core CBOR tests
npm run generate-tests

# This creates tests/core/ files from generators
```

### Creating Custom Generators

Create a new generator file in `src/generators/`:

```typescript
import { TestCase, TestSuite } from '../test-runner/types';

function generateMyTests(): TestSuite {
  const testCases: TestCase[] = [];

  // Add your test generation logic
  testCases.push({
    id: 'my-test-001',
    category: 'my-category',
    description: 'My custom test',
    inputHex: '00',
    expectedOutput: 0,
    diagnosticNotation: '0',
    shouldSucceed: true,
    complexity: 'simple'
  });

  return {
    category: 'my-category',
    description: 'My Custom Tests',
    version: '1.0',
    testCases
  };
}

export { generateMyTests };
```

---

## Test Categories

### Core CBOR Tests

#### Unsigned Integers (`unsigned-integers`)
- Tests major type 0 (0-2^64)
- Boundary values (23/24, 255/256, etc.)
- Non-canonical encodings
- JavaScript safe integer limits

#### Negative Integers (`negative-integers`)
- Tests major type 1 (-1 to -2^64)
- Boundary values
- BigInt requirements

#### Byte Strings (`byte-strings`)
- Empty strings
- Ed25519 keys/signatures
- Hashes (Blake2b-256)
- Policy IDs and asset names
- Large byte strings

#### Text Strings (`text-strings`)
- ASCII and UTF-8
- Emojis and Unicode
- IPFS URIs
- Invalid UTF-8 sequences

#### Arrays (`arrays`)
- Empty and single-element
- Nested structures
- Mixed types
- Large arrays (1000+ elements)

#### Maps (`maps`)
- Integer and text keys
- Canonical key ordering
- Duplicate keys
- Multi-asset value structures

#### Tags (`tags`)
- Standard tags (0, 1, 2, 3)
- Cardano tags (121-127, 102, 258, 24)
- Bignums
- CBOR-in-CBOR

#### Simple Values & Floats (`simple-floats`)
- Booleans, null, undefined
- Float16/32/64
- Special values (Infinity, NaN)

### Cardano-Specific Tests

#### Plutus Data (`plutus-data`)
- All 5 variants: constructor, map, list, integer, bytes
- Constructors 0-6 (tags 121-127)
- General constructors (tag 102)
- Bounded bytes (0-64 length)
- Nested structures

#### Transactions (`transactions`)
- Transaction inputs/outputs
- Multi-asset values
- Redeemers with execution units
- Transaction body structure

#### Metadata (`metadata`)
- CIP-25 NFT metadata
- Name, image, description fields
- Files arrays
- IPFS URIs

#### Primitives (`primitives`)
- Ed25519 public keys (32 bytes)
- Ed25519 signatures (64 bytes)
- Blake2b-256 hashes
- Policy IDs (28 bytes)
- Asset names (0-32 bytes)

### Edge Case Tests

#### Malformed (`malformed`)
- Truncated data
- Invalid UTF-8
- Break code misuse
- Reserved values
- Invalid tag content

#### Canonical (`canonical`)
- Non-canonical integers
- Indefinite-length encodings
- Unsorted map keys
- Duplicate keys

#### Limits (`limits`)
- Deep nesting (100+ levels)
- Large arrays/maps (10000+ elements)
- Large byte strings (1MB+)
- JavaScript integer limits
- Cardano-specific limits

---

## Filtering and Selection

### By Category

```typescript
const runner = new CBORTestRunner(encoder, {
  categories: ['unsigned-integers', 'negative-integers']
});
```

### By Tags

```typescript
const runner = new CBORTestRunner(encoder, {
  tags: ['cardano', 'plutus', 'bigint']
});
```

### By Complexity

```typescript
// Only run simple tests
const runner = new CBORTestRunner(encoder, {
  complexity: ['trivial', 'simple']
});

// Only run stress tests
const runner = new CBORTestRunner(encoder, {
  complexity: ['extreme']
});
```

### Combined Filters

```typescript
const runner = new CBORTestRunner(encoder, {
  categories: ['plutus-data'],
  tags: ['constructor'],
  complexity: ['simple', 'moderate'],
  verbose: true
});
```

---

## Report Generation

### JSON Report

```typescript
import { TestReporter } from './src/test-runner/reporter';

const reporter = new TestReporter();
const jsonReport = reporter.generate(results, 'json');
await reporter.save(results, 'json', './reports/results.json');
```

### HTML Report

```typescript
const htmlReport = reporter.generate(results, 'html');
await reporter.save(results, 'html', './reports/results.html');
```

The HTML report includes:
- Visual summary cards
- Progress bars
- Detailed failure information
- Suite breakdowns

### Markdown Report

```typescript
const mdReport = reporter.generate(results, 'markdown');
await reporter.save(results, 'markdown', './reports/RESULTS.md');
```

### CSV Report

```typescript
const csvReport = reporter.generate(results, 'csv');
await reporter.save(results, 'csv', './reports/results.csv');
```

CSV format is useful for:
- Spreadsheet analysis
- Data processing
- Long-term tracking

### Console Report

```typescript
const consoleReport = reporter.generate(results, 'console');
console.log(consoleReport);
```

---

## Troubleshooting

### Common Issues

#### 1. Test File Not Found

**Error:** `Error loading test file: ENOENT`

**Solution:** Ensure test files exist. Run generators:
```bash
npm run generate-tests
```

#### 2. Invalid Hex String

**Error:** `Invalid hex string: odd length`

**Solution:** Check that `inputHex` has even number of characters

#### 3. Deep Nesting Stack Overflow

**Error:** `RangeError: Maximum call stack size exceeded`

**Solution:** Increase Node.js stack size:
```bash
node --stack-size=2000 src/test-runner/index.ts
```

#### 4. BigInt Not Supported

**Error:** `BigInt is not defined`

**Solution:** Ensure Node.js version >= 10.4.0

#### 5. Test Timeout

**Error:** `Test exceeded timeout`

**Solution:** Increase timeout in config:
```typescript
const runner = new CBORTestRunner(encoder, {
  timeout: 10000  // 10 seconds
});
```

### Debugging Tips

1. **Enable verbose mode** to see detailed test execution
2. **Run single category** to isolate issues
3. **Check diagnostic notation** for human-readable format
4. **Use fail-fast mode** to stop at first failure
5. **Review test notes** for implementation guidance

### Performance Tips

1. **Filter tests** to reduce execution time
2. **Disable round-trip testing** if not needed
3. **Run in parallel** for multiple implementations
4. **Cache test files** to avoid re-reading

---

## Best Practices

### For Test Writers

1. **Use descriptive IDs** following existing conventions
2. **Include diagnostic notation** for readability
3. **Add Cardano relevance** for Cardano-specific tests
4. **Tag appropriately** for easy filtering
5. **Document edge cases** in notes field

### For Test Users

1. **Run full suite** before releases
2. **Generate HTML reports** for stakeholders
3. **Track results over time** using CSV exports
4. **Test canonical encoding** for Cardano implementations
5. **Validate round-trip** to ensure consistency

### For CI/CD Integration

```yaml
# Example GitHub Actions workflow
name: CBOR Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm run generate-tests
      - run: npm test
      - uses: actions/upload-artifact@v2
        with:
          name: test-reports
          path: reports/
```

---

## Additional Resources

- [RFC 8949 - CBOR Specification](https://www.rfc-editor.org/rfc/rfc8949.html)
- [CBOR Research Report](./CBOR_RESEARCH.md)
- [Cardano CBOR Handbook](./CARDANO_CBOR_HANDBOOK.md)
- [API Reference](./API_REFERENCE.md)

---

**Version:** 1.0
**Maintainer:** TACO Team
**License:** MIT
