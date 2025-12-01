/**
 * Test Report Generator
 * Generates reports in various formats (JSON, HTML, Markdown, CSV, Console)
 */

import * as fs from 'fs';
import { TestRunResults, TestSuiteResults, TestResult, ReportFormat } from './types';

export class TestReporter {
  /**
   * Generate report in specified format
   */
  generate(results: TestRunResults, format: ReportFormat): string {
    switch (format) {
      case 'json':
        return this.generateJSON(results);
      case 'html':
        return this.generateHTML(results);
      case 'markdown':
        return this.generateMarkdown(results);
      case 'csv':
        return this.generateCSV(results);
      case 'console':
        return this.generateConsole(results);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Save report to file
   */
  async save(results: TestRunResults, format: ReportFormat, filePath: string): Promise<void> {
    const content = this.generate(results, format);
    fs.writeFileSync(filePath, content, 'utf-8');
  }

  /**
   * Generate JSON report
   */
  private generateJSON(results: TestRunResults): string {
    // Custom replacer to handle BigInt values
    return JSON.stringify(results, (key, value) => {
      if (typeof value === 'bigint') {
        return value.toString() + 'n';
      }
      return value;
    }, 2);
  }

  /**
   * Generate HTML report
   */
  private generateHTML(results: TestRunResults): string {
    const { summary, suites, implementation, timestamp } = results;

    const failedTests = suites.flatMap(suite =>
      suite.tests.filter(t => !t.passed).map(t => ({ suite: suite.category, test: t }))
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CBOR Test Report - ${implementation.name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f5f5f5;
      padding: 20px;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .header h1 { font-size: 2em; margin-bottom: 10px; }
    .header .meta { opacity: 0.9; font-size: 0.9em; }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 20px;
    }
    .summary-card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .summary-card h3 { font-size: 0.9em; color: #666; margin-bottom: 5px; }
    .summary-card .value { font-size: 2em; font-weight: bold; }
    .summary-card.passed .value { color: #10b981; }
    .summary-card.failed .value { color: #ef4444; }
    .summary-card.rate .value { color: #667eea; }
    .suites { background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .suite { margin-bottom: 20px; }
    .suite h2 {
      font-size: 1.3em;
      margin-bottom: 10px;
      padding-bottom: 10px;
      border-bottom: 2px solid #eee;
    }
    .suite-stats {
      display: flex;
      gap: 20px;
      margin-bottom: 10px;
      font-size: 0.9em;
    }
    .stat { padding: 5px 10px; border-radius: 4px; }
    .stat.passed { background: #d1fae5; color: #065f46; }
    .stat.failed { background: #fee2e2; color: #991b1b; }
    .stat.duration { background: #e0e7ff; color: #3730a3; }
    .failures { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .failure {
      background: #fef2f2;
      border-left: 4px solid #ef4444;
      padding: 15px;
      margin-bottom: 15px;
      border-radius: 4px;
    }
    .failure h4 { color: #991b1b; margin-bottom: 8px; }
    .failure .error { color: #7f1d1d; font-size: 0.9em; font-family: 'Courier New', monospace; background: white; padding: 10px; border-radius: 4px; margin-top: 8px; }
    .progress-bar {
      height: 30px;
      background: #e0e7ff;
      border-radius: 4px;
      overflow: hidden;
      margin: 10px 0;
    }
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #10b981 0%, #059669 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: 0.9em;
    }
    .footer {
      text-align: center;
      padding: 20px;
      color: #666;
      font-size: 0.9em;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>CBOR Test Report</h1>
      <div class="meta">
        <div><strong>Implementation:</strong> ${implementation.name} ${implementation.version || ''}</div>
        <div><strong>Timestamp:</strong> ${timestamp.toISOString()}</div>
        <div><strong>Duration:</strong> ${summary.duration}ms</div>
      </div>
    </div>

    <div class="summary">
      <div class="summary-card">
        <h3>Total Tests</h3>
        <div class="value">${summary.totalTests}</div>
      </div>
      <div class="summary-card passed">
        <h3>Passed</h3>
        <div class="value">${summary.passed}</div>
      </div>
      <div class="summary-card failed">
        <h3>Failed</h3>
        <div class="value">${summary.failed}</div>
      </div>
      <div class="summary-card rate">
        <h3>Success Rate</h3>
        <div class="value">${summary.successRate.toFixed(1)}%</div>
      </div>
    </div>

    <div class="progress-bar">
      <div class="progress-fill" style="width: ${summary.successRate}%">
        ${summary.successRate.toFixed(1)}%
      </div>
    </div>

    <div class="suites">
      <h2>Test Suites</h2>
      ${suites.map(suite => `
        <div class="suite">
          <h2>${suite.category}</h2>
          <div class="suite-stats">
            <span class="stat passed">✓ ${suite.passed} passed</span>
            <span class="stat failed">✗ ${suite.failed} failed</span>
            <span class="stat duration">⏱ ${suite.duration}ms</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${suite.coverage || 0}%">
              ${(suite.coverage || 0).toFixed(1)}%
            </div>
          </div>
        </div>
      `).join('')}
    </div>

    ${failedTests.length > 0 ? `
      <div class="failures">
        <h2>Failed Tests (${failedTests.length})</h2>
        ${failedTests.map(({ suite, test }) => `
          <div class="failure">
            <h4>${suite} / ${test.testId}</h4>
            ${test.error ? `<div class="error">${this.escapeHtml(test.error.message)}</div>` : ''}
          </div>
        `).join('')}
      </div>
    ` : ''}

    <div class="footer">
      Generated by CORE (CBOR Open Reference Evaluator)
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Generate Markdown report
   */
  private generateMarkdown(results: TestRunResults): string {
    const { summary, suites, implementation, timestamp } = results;

    const failedTests = suites.flatMap(suite =>
      suite.tests.filter(t => !t.passed).map(t => ({ suite: suite.category, test: t }))
    );

    let md = `# CBOR Test Report

**Implementation:** ${implementation.name} ${implementation.version || ''}
**Timestamp:** ${timestamp.toISOString()}
**Duration:** ${summary.duration}ms

---

## Summary

| Metric | Value |
|--------|-------|
| Total Tests | ${summary.totalTests} |
| Passed | ${summary.passed} |
| Failed | ${summary.failed} |
| Skipped | ${summary.skipped} |
| Success Rate | ${summary.successRate.toFixed(2)}% |

---

## Test Suites

`;

    for (const suite of suites) {
      md += `### ${suite.category}

- **Total:** ${suite.totalTests}
- **Passed:** ${suite.passed} ✓
- **Failed:** ${suite.failed} ✗
- **Coverage:** ${(suite.coverage || 0).toFixed(2)}%
- **Duration:** ${suite.duration}ms

`;
    }

    if (failedTests.length > 0) {
      md += `---

## Failed Tests (${failedTests.length})

`;
      for (const { suite, test } of failedTests) {
        md += `### ${suite} / ${test.testId}

`;
        if (test.error) {
          md += `**Error:** ${test.error.message}

`;
        }
      }
    }

    md += `---

*Generated by CORE (CBOR Open Reference Evaluator)*
`;

    return md;
  }

  /**
   * Generate CSV report
   */
  private generateCSV(results: TestRunResults): string {
    let csv = 'Suite,Test ID,Passed,Duration (ms),Error Type,Error Message\n';

    for (const suite of results.suites) {
      for (const test of suite.tests) {
        const errorType = test.error?.type || '';
        const errorMessage = test.error?.message ? test.error.message.replace(/"/g, '""') : '';
        csv += `"${suite.category}","${test.testId}",${test.passed},${test.duration},"${errorType}","${errorMessage}"\n`;
      }
    }

    return csv;
  }

  /**
   * Generate console-friendly report
   */
  private generateConsole(results: TestRunResults): string {
    const { summary, suites } = results;
    let output = '\n';

    output += '╔══════════════════════════════════════════════════════╗\n';
    output += '║              CBOR TEST RESULTS                       ║\n';
    output += '╚══════════════════════════════════════════════════════╝\n\n';

    output += `Total Tests:   ${summary.totalTests}\n`;
    output += `Passed:        ${summary.passed} (${summary.successRate.toFixed(2)}%)\n`;
    output += `Failed:        ${summary.failed}\n`;
    output += `Skipped:       ${summary.skipped}\n`;
    output += `Duration:      ${summary.duration}ms\n\n`;

    for (const suite of suites) {
      output += `──────────────────────────────────────────────────────\n`;
      output += `Suite: ${suite.category}\n`;
      output += `──────────────────────────────────────────────────────\n`;
      output += `  Passed:     ${suite.passed}/${suite.totalTests}\n`;
      output += `  Failed:     ${suite.failed}\n`;
      output += `  Coverage:   ${(suite.coverage || 0).toFixed(2)}%\n`;
      output += `  Duration:   ${suite.duration}ms\n`;

      const failed = suite.tests.filter(t => !t.passed);
      if (failed.length > 0) {
        output += `\n  Failed Tests:\n`;
        for (const test of failed) {
          output += `    ✗ ${test.testId}\n`;
          if (test.error) {
            output += `      ${test.error.message}\n`;
          }
        }
      }
      output += '\n';
    }

    return output;
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }
}
