/**
 * Comparison Report Generator
 * Compares results from multiple CBOR implementations
 */

import * as fs from 'fs';
import * as path from 'path';
import { TestRunResults } from './types';

export interface ComparisonData {
  implementations: {
    name: string;
    version?: string;
    results: TestRunResults;
  }[];
}

export class ComparisonReporter {
  /**
   * Load results from JSON files
   */
  loadResults(filePaths: string[]): ComparisonData {
    const implementations = filePaths.map(filePath => {
      const content = fs.readFileSync(filePath, 'utf-8');
      const results: TestRunResults = JSON.parse(content);
      return {
        name: results.implementation.name,
        version: results.implementation.version,
        results
      };
    });

    return { implementations };
  }

  /**
   * Generate HTML comparison report
   */
  generateHTML(data: ComparisonData): string {
    const impls = data.implementations;

    // Calculate comparison stats
    const stats = impls.map(impl => ({
      name: impl.name,
      version: impl.version || '',
      totalTests: impl.results.summary.totalTests,
      passed: impl.results.summary.passed,
      failed: impl.results.summary.failed,
      successRate: impl.results.summary.successRate,
      duration: impl.results.summary.duration,
      corePassRate: this.getCategoryPassRate(impl.results, 'core'),
      cardanoPassRate: this.getCategoryPassRate(impl.results, 'cardano'),
      edgePassRate: this.getCategoryPassRate(impl.results, 'edge_cases')
    }));

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CBOR Implementation Comparison</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f5f5f5;
      padding: 20px;
    }
    .container { max-width: 1400px; margin: 0 auto; }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .header h1 { font-size: 2em; margin-bottom: 10px; }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .impl-card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .impl-card h2 { color: #667eea; margin-bottom: 15px; }
    .impl-card .version { color: #666; font-size: 0.9em; margin-bottom: 10px; }
    .stat-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #eee;
    }
    .stat-row:last-child { border-bottom: none; }
    .stat-label { color: #666; }
    .stat-value { font-weight: bold; }
    .stat-value.good { color: #10b981; }
    .stat-value.medium { color: #f59e0b; }
    .stat-value.bad { color: #ef4444; }
    .comparison-table {
      background: white;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      overflow-x: auto;
      margin-bottom: 30px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th {
      background: #f3f4f6;
      padding: 12px;
      text-align: left;
      font-weight: 600;
    }
    td {
      padding: 12px;
      border-bottom: 1px solid #e5e7eb;
    }
    tr:last-child td { border-bottom: none; }
    .best { background: #d1fae5; font-weight: bold; }
    .chart {
      background: white;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      margin-bottom: 30px;
    }
    .bar-chart {
      display: flex;
      flex-direction: column;
      gap: 15px;
    }
    .bar-row {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .bar-label {
      width: 200px;
      font-weight: 500;
    }
    .bar-container {
      flex: 1;
      height: 30px;
      background: #e5e7eb;
      border-radius: 4px;
      overflow: hidden;
    }
    .bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #10b981 0%, #059669 100%);
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding-right: 10px;
      color: white;
      font-weight: bold;
      font-size: 0.85em;
    }
    .recommendation {
      background: white;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      margin-bottom: 30px;
    }
    .recommendation h2 { margin-bottom: 15px; color: #667eea; }
    .rec-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
    }
    .rec-card {
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      padding: 15px;
    }
    .rec-card h3 { color: #059669; margin-bottom: 10px; }
    .rec-card.not-recommended h3 { color: #dc2626; }
    .rec-card ul { margin-left: 20px; margin-top: 10px; }
    .rec-card li { margin: 5px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>CBOR Implementation Comparison</h1>
      <p>Comparing ${impls.length} CBOR libraries against Cardano requirements</p>
      <p style="opacity: 0.9; font-size: 0.9em;">Generated: ${new Date().toISOString()}</p>
    </div>

    <div class="summary-grid">
      ${stats.map(s => `
        <div class="impl-card">
          <h2>${s.name}</h2>
          <div class="version">Version: ${s.version || 'Unknown'}</div>
          <div class="stat-row">
            <span class="stat-label">Total Tests</span>
            <span class="stat-value">${s.totalTests}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Passed</span>
            <span class="stat-value good">${s.passed}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Failed</span>
            <span class="stat-value bad">${s.failed}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Success Rate</span>
            <span class="stat-value ${s.successRate >= 90 ? 'good' : s.successRate >= 60 ? 'medium' : 'bad'}">
              ${s.successRate.toFixed(2)}%
            </span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Duration</span>
            <span class="stat-value">${s.duration}ms</span>
          </div>
        </div>
      `).join('')}
    </div>

    <div class="chart">
      <h2>Overall Success Rates</h2>
      <div class="bar-chart">
        ${stats.map(s => `
          <div class="bar-row">
            <div class="bar-label">${s.name}</div>
            <div class="bar-container">
              <div class="bar-fill" style="width: ${s.successRate}%">
                ${s.successRate.toFixed(1)}%
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="comparison-table">
      <h2>Detailed Comparison by Category</h2>
      <table>
        <thead>
          <tr>
            <th>Implementation</th>
            <th>Core CBOR</th>
            <th>Cardano Features</th>
            <th>Edge Cases</th>
            <th>Overall</th>
          </tr>
        </thead>
        <tbody>
          ${stats.map(s => {
            const isBestCore = s.corePassRate === Math.max(...stats.map(x => x.corePassRate));
            const isBestCardano = s.cardanoPassRate === Math.max(...stats.map(x => x.cardanoPassRate));
            const isBestEdge = s.edgePassRate === Math.max(...stats.map(x => x.edgePassRate));
            const isBestOverall = s.successRate === Math.max(...stats.map(x => x.successRate));

            return `
              <tr>
                <td><strong>${s.name}</strong></td>
                <td class="${isBestCore ? 'best' : ''}">${s.corePassRate.toFixed(1)}%</td>
                <td class="${isBestCardano ? 'best' : ''}">${s.cardanoPassRate.toFixed(1)}%</td>
                <td class="${isBestEdge ? 'best' : ''}">${s.edgePassRate.toFixed(1)}%</td>
                <td class="${isBestOverall ? 'best' : ''}">${s.successRate.toFixed(1)}%</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>

    <div class="chart">
      <h2>Category Performance Comparison</h2>
      ${['Core CBOR', 'Cardano Features', 'Edge Cases'].map((category, idx) => {
        const key = ['corePassRate', 'cardanoPassRate', 'edgePassRate'][idx] as keyof typeof stats[0];
        return `
          <h3 style="margin: 20px 0 10px 0;">${category}</h3>
          <div class="bar-chart">
            ${stats.map(s => `
              <div class="bar-row">
                <div class="bar-label">${s.name}</div>
                <div class="bar-container">
                  <div class="bar-fill" style="width: ${s[key]}%">
                    ${(s[key] as number).toFixed(1)}%
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        `;
      }).join('')}
    </div>

    <div class="recommendation">
      <h2>Recommendations</h2>
      <div class="rec-grid">
        ${this.generateRecommendations(stats).map(rec => `
          <div class="rec-card ${rec.recommended ? '' : 'not-recommended'}">
            <h3>${rec.recommended ? '✅' : '❌'} ${rec.name}</h3>
            <p><strong>Use Case:</strong> ${rec.useCase}</p>
            <p><strong>Strengths:</strong></p>
            <ul>
              ${rec.strengths.map((s: any) => `<li>${s}</li>`).join('')}
            </ul>
            <p><strong>Weaknesses:</strong></p>
            <ul>
              ${rec.weaknesses.map((w: any) => `<li>${w}</li>`).join('')}
            </ul>
          </div>
        `).join('')}
      </div>
    </div>

    <div style="text-align: center; padding: 20px; color: #666; font-size: 0.9em;">
      Generated by TACO (TACO's A CBOR Observer)
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Get pass rate for a specific category
   */
  private getCategoryPassRate(results: TestRunResults, category: string): number {
    const suite = results.suites.find(s => s.category === category);
    if (!suite) return 0;
    return suite.totalTests > 0 ? (suite.passed / suite.totalTests) * 100 : 0;
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(stats: any[]): any[] {
    return stats.map(s => {
      const rec: any = {
        name: s.name,
        recommended: false,
        useCase: '',
        strengths: [],
        weaknesses: []
      };

      if (s.cardanoPassRate < 20) {
        rec.recommended = false;
        rec.useCase = 'NOT suitable for Cardano development';
        rec.weaknesses.push(`Only ${s.cardanoPassRate.toFixed(1)}% Cardano compatibility`);
      } else if (s.cardanoPassRate >= 90) {
        rec.recommended = true;
        rec.useCase = 'Excellent for Cardano development';
        rec.strengths.push('High Cardano compatibility');
      } else {
        rec.recommended = false;
        rec.useCase = 'Limited Cardano support';
        rec.weaknesses.push('Moderate Cardano compatibility');
      }

      if (s.corePassRate >= 90) {
        rec.strengths.push('Excellent core CBOR support');
      } else if (s.corePassRate >= 60) {
        rec.strengths.push('Good core CBOR support');
      } else {
        rec.weaknesses.push('Limited core CBOR support');
      }

      if (s.duration < 100) {
        rec.strengths.push('Very fast performance');
      } else if (s.duration < 500) {
        rec.strengths.push('Good performance');
      }

      return rec;
    });
  }

  /**
   * Generate Markdown comparison
   */
  generateMarkdown(data: ComparisonData): string {
    const impls = data.implementations;
    const stats = impls.map(impl => ({
      name: impl.name,
      version: impl.version || '',
      totalTests: impl.results.summary.totalTests,
      passed: impl.results.summary.passed,
      failed: impl.results.summary.failed,
      successRate: impl.results.summary.successRate,
      corePassRate: this.getCategoryPassRate(impl.results, 'core'),
      cardanoPassRate: this.getCategoryPassRate(impl.results, 'cardano'),
      edgePassRate: this.getCategoryPassRate(impl.results, 'edge_cases')
    }));

    let md = `# CBOR Implementation Comparison\n\n`;
    md += `**Generated**: ${new Date().toISOString()}\n\n`;
    md += `Comparing ${impls.length} CBOR libraries against Cardano requirements.\n\n`;
    md += `## Overall Results\n\n`;
    md += `| Implementation | Version | Total | Passed | Failed | Success Rate |\n`;
    md += `|---------------|---------|-------|--------|--------|-------------|\n`;
    stats.forEach(s => {
      md += `| ${s.name} | ${s.version} | ${s.totalTests} | ${s.passed} | ${s.failed} | ${s.successRate.toFixed(2)}% |\n`;
    });

    md += `\n## Category Breakdown\n\n`;
    md += `| Implementation | Core CBOR | Cardano Features | Edge Cases |\n`;
    md += `|---------------|-----------|-----------------|------------|\n`;
    stats.forEach(s => {
      md += `| ${s.name} | ${s.corePassRate.toFixed(1)}% | ${s.cardanoPassRate.toFixed(1)}% | ${s.edgePassRate.toFixed(1)}% |\n`;
    });

    md += `\n## Recommendations\n\n`;
    this.generateRecommendations(stats).forEach(rec => {
      md += `### ${rec.recommended ? '✅' : '❌'} ${rec.name}\n\n`;
      md += `**Use Case**: ${rec.useCase}\n\n`;
      md += `**Strengths**:\n`;
      rec.strengths.forEach((s: any) => md += `- ${s}\n`);
      md += `\n**Weaknesses**:\n`;
      rec.weaknesses.forEach((w: any) => md += `- ${w}\n`);
      md += `\n`;
    });

    return md;
  }

  /**
   * Save comparison report
   */
  save(data: ComparisonData, format: 'html' | 'markdown', filePath: string): void {
    const content = format === 'html'
      ? this.generateHTML(data)
      : this.generateMarkdown(data);
    fs.writeFileSync(filePath, content, 'utf-8');
  }
}
