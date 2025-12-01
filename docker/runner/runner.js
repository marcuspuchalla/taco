/**
 * CORE Test Runner
 * Orchestrates tests across multiple CBOR library containers
 */

import { readFile, readdir, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Configuration from environment
const CONTAINERS = (process.env.CONTAINERS || 'node-borc:8081,python-cbor2:8082,rust-ciborium:8083')
  .split(',')
  .map(c => {
    const [name, port] = c.split(':');
    return { name, port: parseInt(port), host: name };
  });

const TEST_DIR = process.env.TEST_DIR || '/tests';
const REPORT_DIR = process.env.REPORT_DIR || '/reports';
const TIMEOUT_MS = parseInt(process.env.TIMEOUT_MS || '5000');

/**
 * Make HTTP request to container
 */
async function request(host, port, method, path, body = null) {
  const url = `http://${host}:${port}${path}`;
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  options.signal = controller.signal;

  try {
    const response = await fetch(url, options);
    clearTimeout(timeout);
    return await response.json();
  } catch (error) {
    clearTimeout(timeout);
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${TIMEOUT_MS}ms`);
    }
    throw error;
  }
}

/**
 * Check container health
 */
async function checkHealth(container) {
  try {
    const result = await request(container.host, container.port, 'GET', '/health');
    return result.status === 'ok';
  } catch {
    return false;
  }
}

/**
 * Wait for container to be healthy
 */
async function waitForContainer(container, maxRetries = 30, delayMs = 1000) {
  console.log(`Waiting for ${container.name}...`);

  for (let i = 0; i < maxRetries; i++) {
    if (await checkHealth(container)) {
      console.log(`  ${container.name} is ready`);
      return true;
    }
    await new Promise(r => setTimeout(r, delayMs));
  }

  console.error(`  ${container.name} failed to start`);
  return false;
}

/**
 * Load all test cases from directory
 */
async function loadTestCases(testDir) {
  const testCases = [];

  async function scanDir(dir) {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        await scanDir(fullPath);
      } else if (entry.name.endsWith('.json')) {
        try {
          const content = await readFile(fullPath, 'utf-8');
          const data = JSON.parse(content);

          // Handle both single test and array of tests
          if (data.testCases && Array.isArray(data.testCases)) {
            testCases.push(...data.testCases.map(tc => ({
              ...tc,
              sourceFile: fullPath.replace(testDir, '')
            })));
          } else if (data.id) {
            testCases.push({ ...data, sourceFile: fullPath.replace(testDir, '') });
          }
        } catch (e) {
          console.warn(`Warning: Could not parse ${fullPath}: ${e.message}`);
        }
      }
    }
  }

  await scanDir(testDir);
  return testCases;
}

/**
 * Compare values for equality (handles special types)
 */
function deepEqual(actual, expected) {
  if (actual === expected) return true;

  // Handle NaN
  if (typeof actual === 'number' && typeof expected === 'number') {
    if (Number.isNaN(actual) && Number.isNaN(expected)) return true;
  }

  // Handle null/undefined
  if (actual == null || expected == null) return actual === expected;

  // Handle arrays
  if (Array.isArray(actual) && Array.isArray(expected)) {
    if (actual.length !== expected.length) return false;
    return actual.every((v, i) => deepEqual(v, expected[i]));
  }

  // Handle objects
  if (typeof actual === 'object' && typeof expected === 'object') {
    const actualKeys = Object.keys(actual);
    const expectedKeys = Object.keys(expected);

    if (actualKeys.length !== expectedKeys.length) return false;

    return actualKeys.every(key => deepEqual(actual[key], expected[key]));
  }

  // Handle string vs number comparison for large integers
  if (typeof actual === 'string' && typeof expected === 'number') {
    return actual === String(expected);
  }
  if (typeof actual === 'number' && typeof expected === 'string') {
    return String(actual) === expected;
  }

  return false;
}

/**
 * Normalize result for comparison
 */
function normalizeResult(result) {
  if (result === null || result === undefined) return result;

  // Handle byte string markers
  if (typeof result === 'object' && '__cbor_bytes__' in result) {
    return result.__cbor_bytes__;
  }

  // Handle float markers
  if (typeof result === 'object' && '__cbor_float__' in result) {
    switch (result.__cbor_float__) {
      case 'NaN': return NaN;
      case 'Infinity': return Infinity;
      case '-Infinity': return -Infinity;
    }
  }

  // Handle tag markers
  if (typeof result === 'object' && '__cbor_tag__' in result) {
    return {
      tag: result.__cbor_tag__,
      value: normalizeResult(result.__cbor_value__)
    };
  }

  // Handle arrays
  if (Array.isArray(result)) {
    return result.map(normalizeResult);
  }

  // Handle objects
  if (typeof result === 'object') {
    const normalized = {};
    for (const [k, v] of Object.entries(result)) {
      normalized[k] = normalizeResult(v);
    }
    return normalized;
  }

  return result;
}

/**
 * Run a single test against a container
 */
async function runTest(container, testCase) {
  const startTime = Date.now();

  try {
    const response = await request(
      container.host,
      container.port,
      'POST',
      '/decode',
      { hex: testCase.inputHex }
    );

    const duration = Date.now() - startTime;

    if (!response.success) {
      // Test expected to fail?
      if (!testCase.shouldSucceed) {
        return {
          testId: testCase.id,
          passed: true,
          expectedFailure: true,
          error: response.error,
          duration
        };
      }

      return {
        testId: testCase.id,
        passed: false,
        error: response.error,
        duration
      };
    }

    // Test expected to fail but succeeded?
    if (!testCase.shouldSucceed) {
      return {
        testId: testCase.id,
        passed: false,
        error: 'Expected decode to fail, but it succeeded',
        actualOutput: response.result,
        duration
      };
    }

    // Compare results
    const normalizedActual = normalizeResult(response.result);
    const normalizedExpected = normalizeResult(testCase.expectedOutput);
    const passed = deepEqual(normalizedActual, normalizedExpected);

    return {
      testId: testCase.id,
      passed,
      actualOutput: normalizedActual,
      expectedOutput: normalizedExpected,
      duration,
      ...(passed ? {} : { error: 'Output mismatch' })
    };

  } catch (error) {
    return {
      testId: testCase.id,
      passed: false,
      error: error.message,
      duration: Date.now() - startTime
    };
  }
}

/**
 * Run all tests against a container
 */
async function runTestsForContainer(container, testCases) {
  console.log(`\nRunning ${testCases.length} tests against ${container.name}...`);

  const results = {
    container: container.name,
    timestamp: new Date().toISOString(),
    tests: [],
    summary: {
      total: testCases.length,
      passed: 0,
      failed: 0,
      duration: 0
    }
  };

  const startTime = Date.now();

  for (const testCase of testCases) {
    const result = await runTest(container, testCase);
    results.tests.push(result);

    if (result.passed) {
      results.summary.passed++;
    } else {
      results.summary.failed++;
    }
  }

  results.summary.duration = Date.now() - startTime;
  results.summary.passRate = ((results.summary.passed / results.summary.total) * 100).toFixed(2);

  console.log(`  ${container.name}: ${results.summary.passed}/${results.summary.total} passed (${results.summary.passRate}%)`);

  return results;
}

/**
 * Generate summary report
 */
function generateSummary(allResults) {
  const summary = {
    timestamp: new Date().toISOString(),
    containers: [],
    rankings: []
  };

  for (const result of allResults) {
    summary.containers.push({
      name: result.container,
      total: result.summary.total,
      passed: result.summary.passed,
      failed: result.summary.failed,
      passRate: parseFloat(result.summary.passRate),
      duration: result.summary.duration
    });
  }

  // Sort by pass rate
  summary.rankings = [...summary.containers].sort((a, b) => b.passRate - a.passRate);

  return summary;
}

/**
 * Get language from container name
 */
function getLanguage(containerName) {
  if (containerName.startsWith('node-')) return 'Node.js';
  if (containerName.startsWith('python-')) return 'Python';
  if (containerName.startsWith('rust-')) return 'Rust';
  if (containerName.startsWith('go-')) return 'Go';
  if (containerName.startsWith('c-')) return 'C';
  if (containerName.startsWith('java-')) return 'Java';
  if (containerName.startsWith('csharp-')) return 'C#';
  if (containerName.startsWith('php-')) return 'PHP';
  if (containerName.startsWith('ruby-')) return 'Ruby';
  if (containerName.startsWith('perl-')) return 'Perl';
  return 'Unknown';
}

/**
 * Generate markdown report
 */
function generateMarkdownReport(summary) {
  const now = new Date();
  const timestamp = now.toISOString();
  const dateStr = now.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });

  // Count languages
  const languages = new Set(summary.rankings.map(r => getLanguage(r.name)));

  let md = `# CORE Test Results

> **⚠️ AUTO-GENERATED FILE - DO NOT EDIT**
>
> This file is automatically generated by the CBOR test runner.
> Any manual changes will be overwritten on the next test run.
>
> Generated: ${dateStr}

## Summary

- **Total Libraries Tested:** ${summary.rankings.length}
- **Programming Languages:** ${languages.size}
- **Test Cases:** ${summary.rankings[0]?.total || 0}
- **Timestamp:** ${timestamp}

## Rankings

| Rank | Library | Language | Pass Rate | Passed | Failed | Duration |
|------|---------|----------|-----------|--------|--------|----------|
`;

  summary.rankings.forEach((r, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
    const lang = getLanguage(r.name);
    md += `| ${medal} ${i + 1} | ${r.name} | ${lang} | **${r.passRate.toFixed(2)}%** | ${r.passed} | ${r.failed} | ${r.duration}ms |\n`;
  });

  md += `
## Libraries by Language

`;

  // Group by language
  const byLanguage = {};
  summary.rankings.forEach(r => {
    const lang = getLanguage(r.name);
    if (!byLanguage[lang]) byLanguage[lang] = [];
    byLanguage[lang].push(r);
  });

  for (const [lang, libs] of Object.entries(byLanguage).sort()) {
    md += `### ${lang}\n\n`;
    libs.forEach(r => {
      md += `- **${r.name}**: ${r.passRate.toFixed(2)}% (${r.passed}/${r.total})\n`;
    });
    md += '\n';
  }

  md += `## Test Categories

The test suite covers:

- **Core CBOR (RFC 8949)**: Integers, strings, byte strings, arrays, maps, tags, floats
- **Cardano-specific**: Plutus data, transactions, addresses, metadata
- **Edge cases**: Malformed data, canonical encoding, boundary values

## Running the Tests

\`\`\`bash
cd docker
docker compose up --abort-on-container-exit
\`\`\`

Results are saved to \`docker/reports/\` directory.
`;

  return md;
}

/**
 * Generate compact results table for README
 */
function generateReadmeTable(summary) {
  let md = `| Rank | Library | Language | Pass Rate |
|------|---------|----------|-----------|
`;

  // Top 10 only for README
  const topN = summary.rankings.slice(0, Math.min(10, summary.rankings.length));
  topN.forEach((r, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
    const lang = getLanguage(r.name);
    md += `| ${medal} ${i + 1} | ${r.name} | ${lang} | **${r.passRate.toFixed(2)}%** |\n`;
  });

  if (summary.rankings.length > 10) {
    md += `\n*See [TEST_RESULTS.md](TEST_RESULTS.md) for full results (${summary.rankings.length} libraries tested)*\n`;
  }

  return md;
}

/**
 * Main entry point
 */
async function main() {
  console.log('CORE Test Runner');
  console.log('======================\n');

  // Wait for all containers
  console.log('Checking container health...');
  const healthyContainers = [];

  for (const container of CONTAINERS) {
    if (await waitForContainer(container)) {
      healthyContainers.push(container);
    }
  }

  if (healthyContainers.length === 0) {
    console.error('\nNo healthy containers found. Exiting.');
    process.exit(1);
  }

  // Load test cases
  console.log(`\nLoading test cases from ${TEST_DIR}...`);
  const testCases = await loadTestCases(TEST_DIR);
  console.log(`  Found ${testCases.length} test cases`);

  if (testCases.length === 0) {
    console.error('\nNo test cases found. Exiting.');
    process.exit(1);
  }

  // Run tests against each container
  const allResults = [];

  for (const container of healthyContainers) {
    const results = await runTestsForContainer(container, testCases);
    allResults.push(results);
  }

  // Generate summary
  const summary = generateSummary(allResults);

  // Create reports directory
  await mkdir(REPORT_DIR, { recursive: true });

  // Save individual results
  for (const result of allResults) {
    const filename = join(REPORT_DIR, `${result.container}-results.json`);
    await writeFile(filename, JSON.stringify(result, null, 2));
    console.log(`\nSaved: ${filename}`);
  }

  // Save summary
  const summaryFile = join(REPORT_DIR, 'summary.json');
  await writeFile(summaryFile, JSON.stringify(summary, null, 2));
  console.log(`Saved: ${summaryFile}`);

  // Generate and save markdown report
  const markdownReport = generateMarkdownReport(summary);
  const markdownFile = join(REPORT_DIR, 'TEST_RESULTS.md');
  await writeFile(markdownFile, markdownReport);
  console.log(`Saved: ${markdownFile}`);

  // Generate README table snippet
  const readmeTable = generateReadmeTable(summary);
  const readmeTableFile = join(REPORT_DIR, 'README_TABLE.md');
  await writeFile(readmeTableFile, readmeTable);
  console.log(`Saved: ${readmeTableFile}`);

  // Print final summary
  console.log('\n\n=== FINAL RESULTS ===\n');
  console.log('Rankings:');
  summary.rankings.forEach((r, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
    console.log(`${medal} ${i + 1}. ${r.name}: ${r.passRate}% (${r.passed}/${r.total})`);
  });

  console.log('\nTest run complete!');
}

main().catch(console.error);
