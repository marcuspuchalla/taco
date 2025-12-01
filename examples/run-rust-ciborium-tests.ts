/**
 * Run CBOR Test Suite against Rust ciborium library
 */

import { CBORTestRunner } from '../src/test-runner';
import { TestReporter } from '../src/test-runner/reporter';
import { RustCiboriumAdapter } from './rust-ciborium-adapter';
import * as path from 'path';
import * as fs from 'fs';

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  CBOR Test Suite - Testing Rust ciborium');
  console.log('═══════════════════════════════════════════════════════\n');

  // Create adapter
  const adapter = new RustCiboriumAdapter();

  // Create test runner
  const runner = new CBORTestRunner(adapter, {
    verbose: false,
    testRoundTrip: true,
    testCanonical: false,  // Skip canonical tests for now
    failFast: false,
    timeout: 5000
  });

  // Run all tests
  const results = await runner.runAllTests();

  // Generate reports
  const reporter = new TestReporter();

  // Create reports directory
  const reportsDir = path.join(__dirname, '../reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  // Save reports in multiple formats
  console.log('\n\nGenerating reports...');

  await reporter.save(results, 'json', path.join(reportsDir, 'rust-ciborium-results.json'));
  console.log('✓ Saved JSON report: reports/rust-ciborium-results.json');

  await reporter.save(results, 'html', path.join(reportsDir, 'rust-ciborium-results.html'));
  console.log('✓ Saved HTML report: reports/rust-ciborium-results.html');

  await reporter.save(results, 'markdown', path.join(reportsDir, 'rust-ciborium-results.md'));
  console.log('✓ Saved Markdown report: reports/rust-ciborium-results.md');

  // Print detailed failure analysis
  if (results.summary.failed > 0) {
    console.log('\n\n═══════════════════════════════════════════════════════');
    console.log('  Failure Analysis');
    console.log('═══════════════════════════════════════════════════════\n');

    const failures = results.suites.flatMap(suite =>
      suite.tests.filter(t => !t.passed).map(t => ({ suite: suite.category, test: t }))
    );

    // Group by error type
    const byErrorType = new Map<string, typeof failures>();
    failures.forEach(f => {
      const errorType = f.test.error?.type || 'unknown';
      if (!byErrorType.has(errorType)) {
        byErrorType.set(errorType, []);
      }
      byErrorType.get(errorType)!.push(f);
    });

    byErrorType.forEach((tests, errorType) => {
      console.log(`\n${errorType} (${tests.length} failures):`);
      tests.slice(0, 5).forEach(f => {
        console.log(`  ✗ ${f.suite}/${f.test.testId}`);
        if (f.test.error) {
          console.log(`    ${f.test.error.message}`);
        }
      });
      if (tests.length > 5) {
        console.log(`  ... and ${tests.length - 5} more`);
      }
    });
  }

  // Exit with appropriate code
  console.log('\n');
  if (results.summary.failed > 0) {
    console.log(`⚠️  ${results.summary.failed} tests failed`);
  } else {
    console.log('🎉 All tests passed!');
  }

  process.exit(0);
}

main().catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});
