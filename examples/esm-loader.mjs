/**
 * ESM Loader for dynamic imports of ESM-only modules
 * This file uses .mjs extension to be treated as ESM
 */

// Re-export the test runner infrastructure
export { CBORTestRunner } from '../src/test-runner/index.js';
export { TestReporter } from '../src/test-runner/reporter.js';

// Helper to load ESM adapters
export async function loadEsmAdapter(adapterPath) {
  const module = await import(adapterPath);
  return module;
}

// Helper to run tests with ESM adapter
export async function runEsmTest(AdapterClass, options = {}) {
  const { CBORTestRunner } = await import('../src/test-runner/index.js');

  const adapter = new AdapterClass();
  const runner = new CBORTestRunner(adapter, {
    verbose: options.verbose !== undefined ? options.verbose : false,
    testRoundTrip: options.testRoundTrip !== undefined ? options.testRoundTrip : true,
    testCanonical: options.testCanonical !== undefined ? options.testCanonical : false,
    failFast: options.failFast !== undefined ? options.failFast : false
  });

  return await runner.runAllTests();
}
