/**
 * Run CBOR Test Suite against all implementations and generate comparison
 */

import { CBORTestRunner } from '../src/test-runner';
import { TestReporter } from '../src/test-runner/reporter';
import { ComparisonReporter } from '../src/test-runner/compare';
import { CborXAdapter } from './cbor-x-adapter';
import { CborAdapter } from './cbor-adapter';
import { BorcAdapter } from './borc-adapter';
import { CborDecoderAdapter } from './cbor-decoder-adapter';
import { HarmoniclabsCborAdapter } from './harmoniclabs-cbor-adapter';
import { CborSyncAdapter } from './cbor-sync-adapter';
import { CborJsAdapter } from './cbor-js-adapter';
import { CborReduxAdapter } from './cbor-redux-adapter';
import { TinyCborAdapter } from './tiny-cbor-adapter';
import { PythonCbor2Adapter } from './python-cbor2-adapter';
import { PythonDagCborAdapter } from './python-dag-cbor-adapter';
import * as path from 'path';
import * as fs from 'fs';

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  TACO - Testing All Implementations');
  console.log('  Total Libraries: 11 (6 original + 5 new CommonJS)');
  console.log('═══════════════════════════════════════════════════════\n');

  const reportsDir = path.join(__dirname, '../reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const reporter = new TestReporter();
  const resultFiles: string[] = [];

  // Test 1: cbor-x
  console.log('\n[1/11] Testing cbor-x...\n');
  const cborXAdapter = new CborXAdapter();
  const cborXRunner = new CBORTestRunner(cborXAdapter, {
    verbose: false,
    testRoundTrip: true,
    testCanonical: false,
    failFast: false
  });
  const cborXResults = await cborXRunner.runAllTests();
  const cborXPath = path.join(reportsDir, 'cbor-x-results.json');
  await reporter.save(cborXResults, 'json', cborXPath);
  resultFiles.push(cborXPath);
  console.log(`✓ cbor-x: ${cborXResults.summary.passed}/${cborXResults.summary.totalTests} passed (${cborXResults.summary.successRate.toFixed(2)}%)`);

  // Test 2: cbor (node-cbor)
  console.log('\n[2/11] Testing cbor (node-cbor)...\n');
  const cborAdapter = new CborAdapter();
  const cborRunner = new CBORTestRunner(cborAdapter, {
    verbose: false,
    testRoundTrip: true,
    testCanonical: true,
    failFast: false
  });
  const cborResults = await cborRunner.runAllTests();
  const cborPath = path.join(reportsDir, 'cbor-results.json');
  await reporter.save(cborResults, 'json', cborPath);
  resultFiles.push(cborPath);
  console.log(`✓ cbor: ${cborResults.summary.passed}/${cborResults.summary.totalTests} passed (${cborResults.summary.successRate.toFixed(2)}%)`);

  // Test 3: borc
  console.log('\n[3/11] Testing borc...\n');
  const borcAdapter = new BorcAdapter();
  const borcRunner = new CBORTestRunner(borcAdapter, {
    verbose: false,
    testRoundTrip: true,
    testCanonical: false,
    failFast: false
  });
  const borcResults = await borcRunner.runAllTests();
  const borcPath = path.join(reportsDir, 'borc-results.json');
  await reporter.save(borcResults, 'json', borcPath);
  resultFiles.push(borcPath);
  console.log(`✓ borc: ${borcResults.summary.passed}/${borcResults.summary.totalTests} passed (${borcResults.summary.successRate.toFixed(2)}%)`);

  // Test 4: cbor_decoder
  console.log('\n[4/11] Testing cbor_decoder...\n');
  const cborDecoderAdapter = new CborDecoderAdapter();
  const cborDecoderRunner = new CBORTestRunner(cborDecoderAdapter, {
    verbose: false,
    testRoundTrip: true,
    testCanonical: false,
    failFast: false
  });
  const cborDecoderResults = await cborDecoderRunner.runAllTests();
  const cborDecoderPath = path.join(reportsDir, 'cbor-decoder-results.json');
  await reporter.save(cborDecoderResults, 'json', cborDecoderPath);
  resultFiles.push(cborDecoderPath);
  console.log(`✓ cbor_decoder: ${cborDecoderResults.summary.passed}/${cborDecoderResults.summary.totalTests} passed (${cborDecoderResults.summary.successRate.toFixed(2)}%)`);

  // Test 5: @harmoniclabs/cbor
  console.log('\n[5/11] Testing @harmoniclabs/cbor...\n');
  const harmoniclabsAdapter = new HarmoniclabsCborAdapter();
  const harmoniclabsRunner = new CBORTestRunner(harmoniclabsAdapter, {
    verbose: false,
    testRoundTrip: true,
    testCanonical: true,
    failFast: false
  });
  const harmoniclabsResults = await harmoniclabsRunner.runAllTests();
  const harmoniclabsPath = path.join(reportsDir, 'harmoniclabs-cbor-results.json');
  await reporter.save(harmoniclabsResults, 'json', harmoniclabsPath);
  resultFiles.push(harmoniclabsPath);
  console.log(`✓ @harmoniclabs/cbor: ${harmoniclabsResults.summary.passed}/${harmoniclabsResults.summary.totalTests} passed (${harmoniclabsResults.summary.successRate.toFixed(2)}%)`);

  // Test 6: cbor-sync
  console.log('\n[6/11] Testing cbor-sync...\n');
  const cborSyncAdapter = new CborSyncAdapter();
  const cborSyncRunner = new CBORTestRunner(cborSyncAdapter, {
    verbose: false,
    testRoundTrip: true,
    testCanonical: false,
    failFast: false
  });
  const cborSyncResults = await cborSyncRunner.runAllTests();
  const cborSyncPath = path.join(reportsDir, 'cbor-sync-results.json');
  await reporter.save(cborSyncResults, 'json', cborSyncPath);
  resultFiles.push(cborSyncPath);
  console.log(`✓ cbor-sync: ${cborSyncResults.summary.passed}/${cborSyncResults.summary.totalTests} passed (${cborSyncResults.summary.successRate.toFixed(2)}%)`);

  // Test 7: cbor-js
  console.log('\n[7/11] Testing cbor-js...\n');
  const cborJsAdapter = new CborJsAdapter();
  const cborJsRunner = new CBORTestRunner(cborJsAdapter, {
    verbose: false,
    testRoundTrip: true,
    testCanonical: false,
    failFast: false
  });
  const cborJsResults = await cborJsRunner.runAllTests();
  const cborJsPath = path.join(reportsDir, 'cbor-js-results.json');
  await reporter.save(cborJsResults, 'json', cborJsPath);
  resultFiles.push(cborJsPath);
  console.log(`✓ cbor-js: ${cborJsResults.summary.passed}/${cborJsResults.summary.totalTests} passed (${cborJsResults.summary.successRate.toFixed(2)}%)`);

  // Test 8: cbor-redux
  console.log('\n[8/11] Testing cbor-redux...\n');
  const cborReduxAdapter = new CborReduxAdapter();
  const cborReduxRunner = new CBORTestRunner(cborReduxAdapter, {
    verbose: false,
    testRoundTrip: true,
    testCanonical: false,
    failFast: false
  });
  const cborReduxResults = await cborReduxRunner.runAllTests();
  const cborReduxPath = path.join(reportsDir, 'cbor-redux-results.json');
  await reporter.save(cborReduxResults, 'json', cborReduxPath);
  resultFiles.push(cborReduxPath);
  console.log(`✓ cbor-redux: ${cborReduxResults.summary.passed}/${cborReduxResults.summary.totalTests} passed (${cborReduxResults.summary.successRate.toFixed(2)}%)`);

  // Test 9: tiny-cbor
  console.log('\n[9/11] Testing tiny-cbor...\n');
  const tinyCborAdapter = new TinyCborAdapter();
  const tinyCborRunner = new CBORTestRunner(tinyCborAdapter, {
    verbose: false,
    testRoundTrip: true,
    testCanonical: false,
    failFast: false
  });
  const tinyCborResults = await tinyCborRunner.runAllTests();
  const tinyCborPath = path.join(reportsDir, 'tiny-cbor-results.json');
  await reporter.save(tinyCborResults, 'json', tinyCborPath);
  resultFiles.push(tinyCborPath);
  console.log(`✓ tiny-cbor: ${tinyCborResults.summary.passed}/${tinyCborResults.summary.totalTests} passed (${tinyCborResults.summary.successRate.toFixed(2)}%)`);

  // Test 10: python-cbor2
  console.log('\n[10/11] Testing python-cbor2...\n');
  const pythonCbor2Adapter = new PythonCbor2Adapter();
  const pythonCbor2Runner = new CBORTestRunner(pythonCbor2Adapter, {
    verbose: false,
    testRoundTrip: true,
    testCanonical: false,
    failFast: false
  });
  const pythonCbor2Results = await pythonCbor2Runner.runAllTests();
  const pythonCbor2Path = path.join(reportsDir, 'python-cbor2-results.json');
  await reporter.save(pythonCbor2Results, 'json', pythonCbor2Path);
  resultFiles.push(pythonCbor2Path);
  console.log(`✓ python-cbor2: ${pythonCbor2Results.summary.passed}/${pythonCbor2Results.summary.totalTests} passed (${pythonCbor2Results.summary.successRate.toFixed(2)}%)`);

  // Test 11: python-dag-cbor
  console.log('\n[11/11] Testing python-dag-cbor...\n');
  const pythonDagCborAdapter = new PythonDagCborAdapter();
  const pythonDagCborRunner = new CBORTestRunner(pythonDagCborAdapter, {
    verbose: false,
    testRoundTrip: true,
    testCanonical: true,
    failFast: false
  });
  const pythonDagCborResults = await pythonDagCborRunner.runAllTests();
  const pythonDagCborPath = path.join(reportsDir, 'python-dag-cbor-results.json');
  await reporter.save(pythonDagCborResults, 'json', pythonDagCborPath);
  resultFiles.push(pythonDagCborPath);
  console.log(`✓ python-dag-cbor: ${pythonDagCborResults.summary.passed}/${pythonDagCborResults.summary.totalTests} passed (${pythonDagCborResults.summary.successRate.toFixed(2)}%)`);

  // Generate comparison reports
  console.log('\n\nGenerating comparison reports...\n');
  const comparer = new ComparisonReporter();
  const comparisonData = comparer.loadResults(resultFiles);

  const htmlPath = path.join(reportsDir, 'comparison.html');
  comparer.save(comparisonData, 'html', htmlPath);
  console.log(`✓ Saved HTML comparison: reports/comparison.html`);

  const mdPath = path.join(reportsDir, 'comparison.md');
  comparer.save(comparisonData, 'markdown', mdPath);
  console.log(`✓ Saved Markdown comparison: reports/comparison.md`);

  // Generate individual reports
  console.log('\nGenerating individual reports...\n');

  await reporter.save(cborXResults, 'html', path.join(reportsDir, 'cbor-x-results.html'));
  console.log('✓ cbor-x HTML report');

  await reporter.save(cborResults, 'html', path.join(reportsDir, 'cbor-results.html'));
  console.log('✓ cbor HTML report');

  await reporter.save(borcResults, 'html', path.join(reportsDir, 'borc-results.html'));
  console.log('✓ borc HTML report');

  await reporter.save(cborDecoderResults, 'html', path.join(reportsDir, 'cbor-decoder-results.html'));
  console.log('✓ cbor_decoder HTML report');

  await reporter.save(harmoniclabsResults, 'html', path.join(reportsDir, 'harmoniclabs-cbor-results.html'));
  console.log('✓ @harmoniclabs/cbor HTML report');

  await reporter.save(cborSyncResults, 'html', path.join(reportsDir, 'cbor-sync-results.html'));
  console.log('✓ cbor-sync HTML report');

  await reporter.save(cborJsResults, 'html', path.join(reportsDir, 'cbor-js-results.html'));
  console.log('✓ cbor-js HTML report');

  await reporter.save(cborReduxResults, 'html', path.join(reportsDir, 'cbor-redux-results.html'));
  console.log('✓ cbor-redux HTML report');

  await reporter.save(tinyCborResults, 'html', path.join(reportsDir, 'tiny-cbor-results.html'));
  console.log('✓ tiny-cbor HTML report');

  await reporter.save(pythonCbor2Results, 'html', path.join(reportsDir, 'python-cbor2-results.html'));
  console.log('✓ python-cbor2 HTML report');

  await reporter.save(pythonDagCborResults, 'html', path.join(reportsDir, 'python-dag-cbor-results.html'));
  console.log('✓ python-dag-cbor HTML report');

  // Summary
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  Summary');
  console.log('═══════════════════════════════════════════════════════\n');
  console.log('  Original Libraries:');
  console.log(`    cbor-x:              ${cborXResults.summary.passed}/${cborXResults.summary.totalTests} (${cborXResults.summary.successRate.toFixed(2)}%)`);
  console.log(`    cbor:                ${cborResults.summary.passed}/${cborResults.summary.totalTests} (${cborResults.summary.successRate.toFixed(2)}%)`);
  console.log(`    borc:                ${borcResults.summary.passed}/${borcResults.summary.totalTests} (${borcResults.summary.successRate.toFixed(2)}%)`);
  console.log(`    cbor_decoder:        ${cborDecoderResults.summary.passed}/${cborDecoderResults.summary.totalTests} (${cborDecoderResults.summary.successRate.toFixed(2)}%)`);
  console.log(`    @harmoniclabs/cbor:  ${harmoniclabsResults.summary.passed}/${harmoniclabsResults.summary.totalTests} (${harmoniclabsResults.summary.successRate.toFixed(2)}%)`);
  console.log(`    cbor-sync:           ${cborSyncResults.summary.passed}/${cborSyncResults.summary.totalTests} (${cborSyncResults.summary.successRate.toFixed(2)}%)`);
  console.log('\n  New Libraries:');
  console.log(`    cbor-js:             ${cborJsResults.summary.passed}/${cborJsResults.summary.totalTests} (${cborJsResults.summary.successRate.toFixed(2)}%)`);
  console.log(`    cbor-redux:          ${cborReduxResults.summary.passed}/${cborReduxResults.summary.totalTests} (${cborReduxResults.summary.successRate.toFixed(2)}%)`);
  console.log(`    tiny-cbor:           ${tinyCborResults.summary.passed}/${tinyCborResults.summary.totalTests} (${tinyCborResults.summary.successRate.toFixed(2)}%)`);
  console.log(`    python-cbor2:        ${pythonCbor2Results.summary.passed}/${pythonCbor2Results.summary.totalTests} (${pythonCbor2Results.summary.successRate.toFixed(2)}%)`);
  console.log(`    python-dag-cbor:     ${pythonDagCborResults.summary.passed}/${pythonDagCborResults.summary.totalTests} (${pythonDagCborResults.summary.successRate.toFixed(2)}%)`);
  console.log('\n  Reports generated:');
  console.log('    - reports/comparison.html (open this for visual comparison)');
  console.log('    - reports/comparison.md');
  console.log('    - reports/cbor-x-results.html');
  console.log('    - reports/cbor-results.html');
  console.log('    - reports/borc-results.html');
  console.log('    - reports/cbor-decoder-results.html');
  console.log('    - reports/harmoniclabs-cbor-results.html');
  console.log('    - reports/cbor-sync-results.html');
  console.log('    - reports/cbor-js-results.html');
  console.log('    - reports/cbor-redux-results.html');
  console.log('    - reports/tiny-cbor-results.html');
  console.log('    - reports/python-cbor2-results.html');
  console.log('    - reports/python-dag-cbor-results.html');
  console.log('═══════════════════════════════════════════════════════\n');

  process.exit(0);
}

main().catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});
