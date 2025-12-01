/**
 * Test Case Validator
 * Validates test case structure and integrity
 */

import { CBORTestCase, ValidationResult } from './types';

export class TestValidator {
  /**
   * Validate a single test case
   */
  validateTestCase(testCase: CBORTestCase): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!testCase.id || testCase.id.trim() === '') {
      errors.push('Test case must have a non-empty id');
    }

    if (!testCase.category) {
      errors.push('Test case must have a category');
    }

    if (!testCase.description || testCase.description.trim() === '') {
      errors.push('Test case must have a non-empty description');
    }

    if (testCase.inputHex === undefined) {
      errors.push('Test case must have inputHex field');
    }

    if (testCase.diagnosticNotation === undefined || testCase.diagnosticNotation === '') {
      warnings.push('Test case should have diagnostic notation');
    }

    if (testCase.shouldSucceed === undefined) {
      errors.push('Test case must specify shouldSucceed');
    }

    if (!testCase.complexity) {
      errors.push('Test case must have complexity rating');
    }

    // Validate hex string
    if (testCase.inputHex) {
      const hex = testCase.inputHex.replace(/\s/g, '');
      if (hex.length > 0) {
        if (!/^[0-9a-fA-F]*$/.test(hex)) {
          errors.push('inputHex contains invalid characters');
        }
        if (hex.length % 2 !== 0) {
          errors.push('inputHex has odd length');
        }
      }
    }

    // Validate complexity
    const validComplexity = ['trivial', 'simple', 'moderate', 'complex', 'extreme'];
    if (testCase.complexity && !validComplexity.includes(testCase.complexity)) {
      errors.push(`Invalid complexity: ${testCase.complexity}`);
    }

    // Validate error type for negative tests
    if (testCase.shouldSucceed === false && !testCase.errorType) {
      warnings.push('Negative test should specify errorType');
    }

    // Validate expected output for positive tests
    if (testCase.shouldSucceed === true && testCase.expectedOutput === undefined) {
      warnings.push('Positive test should have expectedOutput');
    }

    // Cardano relevance for Cardano-specific tests
    if (testCase.category && ['plutus-data', 'transactions', 'metadata', 'primitives'].includes(testCase.category)) {
      if (!testCase.cardanoRelevance) {
        warnings.push('Cardano-specific test should have cardanoRelevance field');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate an entire test suite
   */
  validateSuite(testCases: CBORTestCase[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!testCases || testCases.length === 0) {
      errors.push('Test suite is empty');
      return { valid: false, errors, warnings };
    }

    // Check for duplicate IDs
    const duplicates = this.checkDuplicates(testCases);
    if (duplicates.length > 0) {
      errors.push(`Duplicate test IDs found: ${duplicates.join(', ')}`);
    }

    // Validate each test case
    testCases.forEach((testCase, index) => {
      const result = this.validateTestCase(testCase);
      if (!result.valid) {
        errors.push(`Test case ${index} (${testCase.id || 'unknown'}): ${result.errors.join(', ')}`);
      }
      if (result.warnings.length > 0) {
        warnings.push(`Test case ${index} (${testCase.id || 'unknown'}): ${result.warnings.join(', ')}`);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Check for duplicate test IDs
   */
  checkDuplicates(testCases: CBORTestCase[]): string[] {
    const ids = testCases.map(t => t.id);
    const duplicates: string[] = [];
    const seen = new Set<string>();

    for (const id of ids) {
      if (seen.has(id)) {
        if (!duplicates.includes(id)) {
          duplicates.push(id);
        }
      } else {
        seen.add(id);
      }
    }

    return duplicates;
  }

  /**
   * Generate statistics about a test suite
   */
  generateStatistics(testCases: CBORTestCase[]): {
    total: number;
    byCategory: Record<string, number>;
    byComplexity: Record<string, number>;
    positive: number;
    negative: number;
    withTags: number;
    withCardanoRelevance: number;
  } {
    const byCategory: Record<string, number> = {};
    const byComplexity: Record<string, number> = {};
    let positive = 0;
    let negative = 0;
    let withTags = 0;
    let withCardanoRelevance = 0;

    for (const test of testCases) {
      // Category
      byCategory[test.category] = (byCategory[test.category] || 0) + 1;

      // Complexity
      byComplexity[test.complexity] = (byComplexity[test.complexity] || 0) + 1;

      // Positive/negative
      if (test.shouldSucceed) {
        positive++;
      } else {
        negative++;
      }

      // Tags
      if (test.tags && test.tags.length > 0) {
        withTags++;
      }

      // Cardano relevance
      if (test.cardanoRelevance) {
        withCardanoRelevance++;
      }
    }

    return {
      total: testCases.length,
      byCategory,
      byComplexity,
      positive,
      negative,
      withTags,
      withCardanoRelevance
    };
  }
}
