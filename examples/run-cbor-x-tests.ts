/**
 * Run CBOR Test Suite against cbor-x library
 */

import { CBORTestRunner } from '../src/test-runner';
import { TestReporter } from '../src/test-runner/reporter';
import { CborXAdapter } from './cbor-x-adapter';
import * as path from 'path';
import * as fs from 'fs';

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  CBOR Test Suite - Testing cbor-x');
  console.log('═══════════════════════════════════════════════════════\n');

  // Create adapter
  const adapter = new CborXAdapter();

  // Create test runner
  const runner = new CBORTestRunner(adapter, {
    verbose: false,
    testRoundTrip: true,
    testCanonical: false,  // cbor-x doesn't guarantee canonical encoding
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

  await reporter.save(results, 'json', path.join(reportsDir, 'cbor-x-results.json'));
  console.log('✓ Saved JSON report: reports/cbor-x-results.json');

  await reporter.save(results, 'html', path.join(reportsDir, 'cbor-x-results.html'));
  console.log('✓ Saved HTML report: reports/cbor-x-results.html');

  await reporter.save(results, 'markdown', path.join(reportsDir, 'cbor-x-results.md'));
  console.log('✓ Saved Markdown report: reports/cbor-x-results.md');

  await reporter.save(results, 'csv', path.join(reportsDir, 'cbor-x-results.csv'));
  console.log('✓ Saved CSV report: reports/cbor-x-results.csv');

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
    process.exit(1);
  } else {
    console.log('🎉 All tests passed!');
    process.exit(0);
  }
}

main().catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});
