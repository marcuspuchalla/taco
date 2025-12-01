/**
 * CBOR Test Runner
 * Main test execution engine for validating CBOR encoder/decoder implementations
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  CBORTestCase,
  CBOREncoder,
  TestRunnerConfig,
  TestResult,
  TestSuiteResults,
  TestRunResults,
  TestCategory
} from './types';
import { TestValidator } from './validator';
import { TestReporter } from './reporter';

export class CBORTestRunner {
  private encoder: CBOREncoder;
  private config: TestRunnerConfig;
  private validator: TestValidator;
  private reporter: TestReporter;

  constructor(encoder: CBOREncoder, config: Partial<TestRunnerConfig> = {}) {
    this.encoder = encoder;
    this.config = {
      testRoundTrip: true,
      testCanonical: false,
      timeout: 5000,
      failFast: false,
      verbose: false,
      ...config
    };
    this.validator = new TestValidator();
    this.reporter = new TestReporter();
  }

  /**
   * Load test cases from a JSON file
   */
  private loadTestFile(filePath: string): CBORTestCase[] {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);
      return data.testCases || [];
    } catch (error) {
      console.error(`Error loading test file ${filePath}:`, error);
      return [];
    }
  }

  /**
   * Load all test files from a directory
   */
  private loadTestDirectory(dirPath: string): CBORTestCase[] {
    const tests: CBORTestCase[] = [];

    if (!fs.existsSync(dirPath)) {
      return tests;
    }

    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(dirPath, file);
        tests.push(...this.loadTestFile(filePath));
      }
    }

    return tests;
  }

  /**
   * Filter test cases based on configuration
   */
  private filterTests(tests: CBORTestCase[]): CBORTestCase[] {
    let filtered = tests;

    if (this.config.categories && this.config.categories.length > 0) {
      filtered = filtered.filter(t =>
        this.config.categories!.includes(t.category as TestCategory)
      );
    }

    if (this.config.tags && this.config.tags.length > 0) {
      filtered = filtered.filter(t =>
        t.tags && t.tags.some(tag => this.config.tags!.includes(tag))
      );
    }

    if (this.config.complexity && this.config.complexity.length > 0) {
      filtered = filtered.filter(t =>
        this.config.complexity!.includes(t.complexity)
      );
    }

    return filtered;
  }

  /**
   * Convert hex string to Uint8Array
   */
  private hexToBytes(hex: string): Uint8Array {
    if (hex.length === 0) {
      return new Uint8Array(0);
    }

    // Remove spaces and validate
    hex = hex.replace(/\s/g, '');
    if (hex.length % 2 !== 0) {
      throw new Error('Invalid hex string: odd length');
    }

    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
  }

  /**
   * Convert Uint8Array to hex string
   */
  private bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Deep equality check for test results
   */
  private deepEqual(a: any, b: any): boolean {
    // Handle special float markers from JSON (since JSON can't represent Infinity/NaN)
    if (typeof a === 'string' && typeof b === 'number') {
      if (a === '::INFINITY::' && b === Infinity) return true;
      if (a === '::NEG_INFINITY::' && b === -Infinity) return true;
      if (a === '::NAN::' && isNaN(b)) return true;
    }
    if (typeof b === 'string' && typeof a === 'number') {
      if (b === '::INFINITY::' && a === Infinity) return true;
      if (b === '::NEG_INFINITY::' && a === -Infinity) return true;
      if (b === '::NAN::' && isNaN(a)) return true;
    }

    // Handle NaN
    if (typeof a === 'number' && typeof b === 'number' && isNaN(a) && isNaN(b)) {
      return true;
    }

    // Handle primitives
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (typeof a !== 'object' || typeof b !== 'object') return false;

    // Handle Uint8Array and Buffer
    if (a instanceof Uint8Array && b instanceof Uint8Array) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
      }
      return true;
    }

    // Handle arrays
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (!this.deepEqual(a[i], b[i])) return false;
      }
      return true;
    }

    // Handle Maps
    if (a instanceof Map && b instanceof Map) {
      if (a.size !== b.size) return false;
      for (const [key, value] of a) {
        if (!b.has(key) || !this.deepEqual(value, b.get(key))) {
          return false;
        }
      }
      return true;
    }

    // Handle objects
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
      if (!keysB.includes(key)) return false;
      if (!this.deepEqual(a[key], b[key])) return false;
    }

    return true;
  }

  /**
   * Safe JSON stringify that handles BigInt and other special values
   */
  private safeStringify(value: any): string {
    return JSON.stringify(value, (key, val) => {
      if (typeof val === 'bigint') {
        return val.toString() + 'n';
      }
      if (val instanceof Uint8Array) {
        return Array.from(val).map(b => b.toString(16).padStart(2, '0')).join('');
      }
      return val;
    });
  }

  /**
   * Run a single test case
   */
  private async runTest(testCase: CBORTestCase): Promise<TestResult> {
    const startTime = Date.now();
    const result: TestResult = {
      testId: testCase.id,
      passed: false,
      duration: 0
    };

    try {
      // Convert hex to bytes
      const inputBytes = this.hexToBytes(testCase.inputHex);

      if (this.config.verbose) {
        console.log(`\nRunning test: ${testCase.id}`);
        console.log(`  Description: ${testCase.description}`);
        console.log(`  Input hex: ${testCase.inputHex.slice(0, 40)}${testCase.inputHex.length > 40 ? '...' : ''}`);
      }

      // Decode the CBOR
      let decoded: any;
      let decodeError: Error | null = null;

      try {
        decoded = this.encoder.decode(inputBytes);
      } catch (error) {
        decodeError = error as Error;
      }

      // Check if test should succeed or fail
      if (testCase.shouldSucceed) {
        // Test should succeed
        if (decodeError) {
          result.passed = false;
          result.error = {
            type: 'unexpected-error',
            message: `Expected success but got error: ${decodeError.message}`,
            stack: decodeError.stack
          };
        } else {
          // Compare decoded value with expected
          result.actualOutput = decoded;
          result.passed = this.deepEqual(decoded, testCase.expectedOutput);

          if (!result.passed) {
            result.error = {
              type: 'value-mismatch',
              message: `Expected ${this.safeStringify(testCase.expectedOutput)} but got ${this.safeStringify(decoded)}`
            };
          }

          // Test round-trip if enabled and test passed
          if (result.passed && this.config.testRoundTrip) {
            try {
              const reencoded = this.encoder.encode(decoded);
              const redecoded = this.encoder.decode(reencoded);
              result.roundTripSuccess = this.deepEqual(decoded, redecoded);

              if (!result.roundTripSuccess) {
                result.passed = false;
                result.error = {
                  type: 'round-trip-failed',
                  message: 'Round-trip encoding/decoding produced different result'
                };
              }
            } catch (error) {
              result.roundTripSuccess = false;
              result.error = {
                type: 'round-trip-error',
                message: `Round-trip failed: ${(error as Error).message}`
              };
            }
          }

          // Test canonical encoding if enabled
          if (result.passed && this.config.testCanonical && this.encoder.encodeCanonical) {
            try {
              const canonical = this.encoder.encodeCanonical(decoded);
              const canonicalHex = this.bytesToHex(canonical);
              result.canonicalMatch = canonicalHex === testCase.inputHex;

              // Only fail if test is marked as requiring canonical encoding
              if (!result.canonicalMatch && !testCase.errorType) {
                result.passed = false;
                result.error = {
                  type: 'non-canonical',
                  message: `Input is not canonical encoding`
                };
              }
            } catch (error) {
              // Canonical encoding failed - may be expected for some tests
            }
          }
        }
      } else {
        // Test should fail
        if (decodeError) {
          // Expected failure - check if error type matches
          result.passed = true;
          result.error = {
            type: 'expected-error',
            message: decodeError.message
          };

          if (testCase.errorType && this.config.verbose) {
            console.log(`  Expected error type: ${testCase.errorType}`);
            console.log(`  Actual error: ${decodeError.message}`);
          }
        } else {
          // Should have failed but didn't
          result.passed = false;
          result.actualOutput = decoded;
          result.error = {
            type: 'unexpected-success',
            message: `Expected error but decoding succeeded with value: ${this.safeStringify(decoded)}`
          };
        }
      }

    } catch (error) {
      result.passed = false;
      result.error = {
        type: 'test-error',
        message: `Test execution failed: ${(error as Error).message}`,
        stack: (error as Error).stack
      };
    }

    result.duration = Date.now() - startTime;

    if (this.config.verbose) {
      console.log(`  Result: ${result.passed ? '✓ PASS' : '✗ FAIL'}`);
      if (result.error) {
        console.log(`  Error: ${result.error.message}`);
      }
    }

    return result;
  }

  /**
   * Run a suite of tests
   */
  private async runTestSuite(category: string, tests: CBORTestCase[]): Promise<TestSuiteResults> {
    const startTime = Date.now();
    const results: TestResult[] = [];
    let passed = 0;
    let failed = 0;
    let skipped = 0;

    console.log(`\nRunning test suite: ${category} (${tests.length} tests)`);

    for (const test of tests) {
      if (this.config.failFast && failed > 0) {
        skipped = tests.length - results.length;
        break;
      }

      const result = await this.runTest(test);
      results.push(result);

      if (result.passed) {
        passed++;
      } else {
        failed++;
        if (!this.config.verbose) {
          console.log(`  ✗ ${test.id}: ${result.error?.message}`);
        }
      }
    }

    const duration = Date.now() - startTime;
    const coverage = tests.length > 0 ? (passed / tests.length) * 100 : 0;

    console.log(`  Results: ${passed} passed, ${failed} failed, ${skipped} skipped (${duration}ms)`);

    return {
      category,
      totalTests: tests.length,
      passed,
      failed,
      skipped,
      duration,
      tests: results,
      coverage
    };
  }

  /**
   * Run all tests
   */
  async runAllTests(testsDir?: string): Promise<TestRunResults> {
    const baseDir = testsDir || path.join(__dirname, '../../tests');
    const startTime = new Date();

    console.log('═══════════════════════════════════════════════════════');
    console.log('  CBOR Test Suite Runner');
    console.log('  Implementation:', this.encoder.name);
    if (this.encoder.version) {
      console.log('  Version:', this.encoder.version);
    }
    console.log('═══════════════════════════════════════════════════════');

    const suites: TestSuiteResults[] = [];

    // Load and run core tests
    const coreDir = path.join(baseDir, 'core');
    if (fs.existsSync(coreDir)) {
      const coreTests = this.filterTests(this.loadTestDirectory(coreDir));
      if (coreTests.length > 0) {
        const coreResults = await this.runTestSuite('core', coreTests);
        suites.push(coreResults);
      }
    }

    // Load and run Cardano tests
    const cardanoDir = path.join(baseDir, 'cardano');
    if (fs.existsSync(cardanoDir)) {
      const cardanoTests = this.filterTests(this.loadTestDirectory(cardanoDir));
      if (cardanoTests.length > 0) {
        const cardanoResults = await this.runTestSuite('cardano', cardanoTests);
        suites.push(cardanoResults);
      }
    }

    // Load and run edge case tests
    const edgeCasesDir = path.join(baseDir, 'edge_cases');
    if (fs.existsSync(edgeCasesDir)) {
      const edgeTests = this.filterTests(this.loadTestDirectory(edgeCasesDir));
      if (edgeTests.length > 0) {
        const edgeResults = await this.runTestSuite('edge_cases', edgeTests);
        suites.push(edgeResults);
      }
    }

    // Calculate summary
    const totalTests = suites.reduce((sum, s) => sum + s.totalTests, 0);
    const totalPassed = suites.reduce((sum, s) => sum + s.passed, 0);
    const totalFailed = suites.reduce((sum, s) => sum + s.failed, 0);
    const totalSkipped = suites.reduce((sum, s) => sum + s.skipped, 0);
    const totalDuration = suites.reduce((sum, s) => sum + s.duration, 0);
    const successRate = totalTests > 0 ? (totalPassed / totalTests) * 100 : 0;

    const results: TestRunResults = {
      timestamp: startTime,
      suites,
      summary: {
        totalTests,
        passed: totalPassed,
        failed: totalFailed,
        skipped: totalSkipped,
        duration: totalDuration,
        successRate
      },
      implementation: {
        name: this.encoder.name,
        version: this.encoder.version,
        features: this.encoder.features
      }
    };

    // Print summary
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('  Summary');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`  Total Tests:   ${totalTests}`);
    console.log(`  Passed:        ${totalPassed} (${successRate.toFixed(2)}%)`);
    console.log(`  Failed:        ${totalFailed}`);
    console.log(`  Skipped:       ${totalSkipped}`);
    console.log(`  Duration:      ${totalDuration}ms`);
    console.log('═══════════════════════════════════════════════════════\n');

    return results;
  }

  /**
   * Run tests for a specific category
   */
  async runCategory(category: TestCategory | string, testsDir?: string): Promise<TestSuiteResults> {
    const baseDir = testsDir || path.join(__dirname, '../../tests');
    let dirPath: string;

    const categoryStr = category as string;
    if (categoryStr === 'edge_cases' || ['malformed', 'canonical', 'limits'].includes(categoryStr)) {
      dirPath = path.join(baseDir, 'edge_cases');
    } else if (['plutus-data', 'transactions', 'metadata', 'primitives'].includes(categoryStr)) {
      dirPath = path.join(baseDir, 'cardano');
    } else {
      dirPath = path.join(baseDir, 'core');
    }

    const tests = this.filterTests(this.loadTestDirectory(dirPath));
    return this.runTestSuite(categoryStr, tests);
  }
}

export * from './types';
export { TestValidator } from './validator';
export { TestReporter } from './reporter';
