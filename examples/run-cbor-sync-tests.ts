/**
 * Run CBOR Test Suite against cbor-sync
 */

import { CBORTestRunner } from '../src/test-runner';
import { TestReporter } from '../src/test-runner/reporter';
import { CborSyncAdapter } from './cbor-sync-adapter';
import * as path from 'path';
import * as fs from 'fs';

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  TACO - cbor-sync');
  console.log('═══════════════════════════════════════════════════════\n');

  const reportsDir = path.join(__dirname, '../reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const adapter = new CborSyncAdapter();
  const runner = new CBORTestRunner(adapter, {
    verbose: true,
    testRoundTrip: true,
    testCanonical: false,
    failFast: false
  });

  const results = await runner.runAllTests();

  const reporter = new TestReporter();

  // Save reports
  await reporter.save(results, 'json', path.join(reportsDir, 'cbor-sync-results.json'));
  await reporter.save(results, 'html', path.join(reportsDir, 'cbor-sync-results.html'));
  await reporter.save(results, 'markdown', path.join(reportsDir, 'cbor-sync-results.md'));

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  Summary');
  console.log('═══════════════════════════════════════════════════════\n');
  console.log(`  Total Tests:   ${results.summary.totalTests}`);
  console.log(`  Passed:        ${results.summary.passed}`);
  console.log(`  Failed:        ${results.summary.failed}`);
  console.log(`  Success Rate:  ${results.summary.successRate.toFixed(2)}%`);
  console.log('\n  Category Breakdown:');
  console.log(`    Core CBOR:         ${results.summary.categoryBreakdown['core-cbor']?.successRate.toFixed(2) || '0.00'}%`);
  console.log(`    Cardano Features:  ${results.summary.categoryBreakdown['cardano-features']?.successRate.toFixed(2) || '0.00'}%`);
  console.log(`    Edge Cases:        ${results.summary.categoryBreakdown['edge-cases']?.successRate.toFixed(2) || '0.00'}%`);
  console.log('\n  Reports generated:');
  console.log('    - reports/cbor-sync-results.json');
  console.log('    - reports/cbor-sync-results.html');
  console.log('    - reports/cbor-sync-results.md');
  console.log('═══════════════════════════════════════════════════════\n');

  process.exit(0);
}

main().catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});
