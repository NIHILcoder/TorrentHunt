/**
 * Report Generator
 * Generates scan reports in multiple formats (HTML, JSON, TXT, PDF)
 */

import { promises as fs } from 'fs';
import path from 'path';
import { app } from 'electron';
import puppeteer from 'puppeteer';
import type {
  ScanReport,
  ScanResult,
  ExportOptions,
  ExportResult,
  ChartData,
  ScanSummary,
} from '../../shared/scan-report-types';
import { ThreatLevel, FileCategory } from '../../shared/virushunt-types';
import { logger } from '../utils/logger';

const log = logger.child('ReportGenerator');

export class ReportGenerator {
  private appVersion: string;

  constructor() {
    this.appVersion = app.getVersion();
  }

  /**
   * Generate report in specified format
   */
  async generateReport(
    results: ScanResult[],
    summary: ScanSummary,
    options: ExportOptions
  ): Promise<ExportResult> {
    const startTime = Date.now();

    try {
      log.info(`Generating ${options.format} report to ${options.outputPath}`);

      const report: ScanReport = {
        id: this.generateReportId(),
        version: '1.0.0',
        summary,
        results,
        generatedAt: Date.now(),
        appVersion: this.appVersion,
        systemInfo: options.includeSystemInfo
          ? {
              platform: process.platform,
              arch: process.arch,
              nodeVersion: process.version,
            }
          : undefined,
      };

      let content: string | Buffer;
      let filePath: string;

      switch (options.format) {
        case 'html':
          content = await this.generateHTML(report, options);
          filePath = options.outputPath.endsWith('.html')
            ? options.outputPath
            : `${options.outputPath}.html`;
          await fs.writeFile(filePath, content, 'utf-8');
          break;

        case 'json':
          content = this.generateJSON(report);
          filePath = options.outputPath.endsWith('.json')
            ? options.outputPath
            : `${options.outputPath}.json`;
          await fs.writeFile(filePath, content, 'utf-8');
          break;

        case 'txt':
          content = this.generateTXT(report);
          filePath = options.outputPath.endsWith('.txt')
            ? options.outputPath
            : `${options.outputPath}.txt`;
          await fs.writeFile(filePath, content, 'utf-8');
          break;

        case 'pdf':
          filePath = options.outputPath.endsWith('.pdf')
            ? options.outputPath
            : `${options.outputPath}.pdf`;
          await this.generatePDF(report, filePath, options);
          break;

        default:
          throw new Error(`Unsupported format: ${options.format}`);
      }

      const stats = await fs.stat(filePath);
      const duration = Date.now() - startTime;

      log.info(`Report generated successfully in ${duration}ms (${stats.size} bytes)`);

      return {
        success: true,
        filePath,
        fileSize: stats.size,
        duration,
      };
    } catch (error) {
      log.error('Failed to generate report:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Generate HTML report with inline CSS
   */
  async generateHTML(report: ScanReport, options: ExportOptions): Promise<string> {
    const theme = options.theme || 'light';
    const chartData = this.prepareChartData(report.results, report.summary);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VirusHunt Scan Report - ${new Date(report.generatedAt).toLocaleString()}</title>
  <style>
${this.getInlineCSS(theme)}
  </style>
</head>
<body class="theme-${theme}" data-theme="${theme}">
  <div class="container">
    <!-- Header -->
    <header class="report-header">
      <div class="logo">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="20" stroke="currentColor" stroke-width="3"/>
          <path d="M24 14L24 34M14 24L34 24" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
        </svg>
        <div>
          <h1>VirusHunt Scan Report</h1>
          <p class="subtitle">TorrentHunt v${report.appVersion}</p>
        </div>
      </div>
      <div class="report-meta">
        <div class="meta-item">
          <strong>Report ID:</strong> ${report.id}
        </div>
        <div class="meta-item">
          <strong>Generated:</strong> ${new Date(report.generatedAt).toLocaleString()}
        </div>
        <div class="meta-item">
          <strong>Scan Duration:</strong> ${this.formatDuration(report.summary.duration)}
        </div>
      </div>
      <button class="theme-toggle" onclick="toggleTheme()">
        <span class="icon-sun">☀️</span>
        <span class="icon-moon">🌙</span>
      </button>
    </header>

    <!-- Summary Statistics -->
    <section class="summary-section">
      <h2>📊 Scan Summary</h2>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">📁</div>
          <div class="stat-value">${report.summary.totalFiles}</div>
          <div class="stat-label">Total Files</div>
        </div>
        <div class="stat-card stat-success">
          <div class="stat-icon">✅</div>
          <div class="stat-value">${report.summary.cleanFiles}</div>
          <div class="stat-label">Clean</div>
        </div>
        <div class="stat-card stat-warning">
          <div class="stat-icon">⚠️</div>
          <div class="stat-value">${report.summary.suspiciousFiles}</div>
          <div class="stat-label">Suspicious</div>
        </div>
        <div class="stat-card stat-danger">
          <div class="stat-icon">🚫</div>
          <div class="stat-value">${report.summary.dangerousFiles}</div>
          <div class="stat-label">Dangerous</div>
        </div>
        <div class="stat-card stat-critical">
          <div class="stat-icon">☠️</div>
          <div class="stat-value">${report.summary.criticalFiles}</div>
          <div class="stat-label">Critical</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">⚡</div>
          <div class="stat-value">${report.summary.totalThreats}</div>
          <div class="stat-label">Total Threats</div>
        </div>
      </div>
      <div class="scan-info">
        <div><strong>Scanned Path:</strong> <code>${report.summary.scannedPath}</code></div>
        <div><strong>Total Size:</strong> ${this.formatBytes(report.summary.totalSize)}</div>
        <div><strong>Scan Period:</strong> ${new Date(report.summary.startTime).toLocaleString()} - ${new Date(report.summary.endTime).toLocaleString()}</div>
      </div>
    </section>

    ${options.includeCharts ? this.generateChartsHTML(chartData) : ''}

    <!-- Threats Table -->
    <section class="threats-section">
      <h2>🔍 Detected Threats</h2>
      ${this.generateThreatsTable(report.results.filter(r => r.threatLevel !== ThreatLevel.SAFE))}
    </section>

    <!-- All Files Table -->
    <section class="files-section">
      <h2>📋 All Scanned Files</h2>
      <div class="table-controls">
        <input type="text" id="searchInput" placeholder="Search files..." onkeyup="filterTable()">
        <select id="filterSelect" onchange="filterTable()">
          <option value="all">All Files</option>
          <option value="safe">Safe Only</option>
          <option value="suspicious">Suspicious Only</option>
          <option value="dangerous">Dangerous Only</option>
          <option value="critical">Critical Only</option>
        </select>
      </div>
      ${this.generateFilesTable(report.results)}
    </section>

    ${report.systemInfo ? this.generateSystemInfoHTML(report.systemInfo) : ''}

    <!-- Footer -->
    <footer class="report-footer">
      <p>Generated by <strong>TorrentHunt VirusHunt</strong> v${report.appVersion}</p>
      <p>Report ID: ${report.id} | ${new Date(report.generatedAt).toLocaleString()}</p>
    </footer>
  </div>

  <script>
${this.getInlineJavaScript(chartData)}
  </script>
</body>
</html>`;
  }

  /**
   * Generate JSON report
   */
  generateJSON(report: ScanReport): string {
    return JSON.stringify(report, null, 2);
  }

  /**
   * Generate plain text report
   */
  generateTXT(report: ScanReport): string {
    const lines: string[] = [];

    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push('                    VIRUSHUNT SCAN REPORT                      ');
    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push('');
    lines.push(`Report ID:    ${report.id}`);
    lines.push(`Generated:    ${new Date(report.generatedAt).toLocaleString()}`);
    lines.push(`App Version:  TorrentHunt v${report.appVersion}`);
    lines.push('');

    lines.push('─────────────────────────────────────────────────────────────');
    lines.push('SCAN SUMMARY');
    lines.push('─────────────────────────────────────────────────────────────');
    lines.push(`Scanned Path:     ${report.summary.scannedPath}`);
    lines.push(`Total Files:      ${report.summary.totalFiles}`);
    lines.push(`Total Size:       ${this.formatBytes(report.summary.totalSize)}`);
    lines.push(`Scan Duration:    ${this.formatDuration(report.summary.duration)}`);
    lines.push(`Scan Period:      ${new Date(report.summary.startTime).toLocaleString()} - ${new Date(report.summary.endTime).toLocaleString()}`);
    lines.push('');

    lines.push('RESULTS BREAKDOWN:');
    lines.push(`  ✓ Clean:        ${report.summary.cleanFiles} files`);
    lines.push(`  ⚠ Suspicious:   ${report.summary.suspiciousFiles} files`);
    lines.push(`  ✗ Dangerous:    ${report.summary.dangerousFiles} files`);
    lines.push(`  ☠ Critical:     ${report.summary.criticalFiles} files`);
    lines.push(`  ⚡ Total Threats: ${report.summary.totalThreats}`);
    lines.push('');

    const threatsOnly = report.results.filter(r => r.threatLevel !== ThreatLevel.SAFE);
    if (threatsOnly.length > 0) {
      lines.push('─────────────────────────────────────────────────────────────');
      lines.push('DETECTED THREATS');
      lines.push('─────────────────────────────────────────────────────────────');
      lines.push('');

      threatsOnly.forEach((result, index) => {
        lines.push(`[${index + 1}] ${result.name}`);
        lines.push(`    Path:          ${result.path}`);
        lines.push(`    Threat Level:  ${this.getThreatIcon(result.threatLevel)} ${result.threatLevel.toUpperCase()}`);
        lines.push(`    Risk Score:    ${result.riskScore}/100`);
        lines.push(`    Category:      ${result.category}`);
        lines.push(`    Size:          ${this.formatBytes(result.size)}`);
        lines.push(`    Hash (SHA256): ${result.hash}`);

        if (result.threats.length > 0) {
          lines.push(`    Threats:`);
          result.threats.forEach(threat => {
            lines.push(`      - [${threat.confidence}%] ${threat.description}`);
          });
        }

        if (result.reputation) {
          lines.push(`    Reputation:    ${result.reputation}`);
        }

        if (result.releaseGroup) {
          lines.push(`    Release Group: ${result.releaseGroup}`);
        }

        lines.push('');
      });
    }

    lines.push('─────────────────────────────────────────────────────────────');
    lines.push('ALL SCANNED FILES');
    lines.push('─────────────────────────────────────────────────────────────');
    lines.push('');

    report.results.forEach((result, index) => {
      const icon = this.getThreatIcon(result.threatLevel);
      lines.push(`${icon} [${index + 1}/${report.results.length}] ${result.name}`);
      lines.push(`   ${result.path}`);
      lines.push(`   Level: ${result.threatLevel} | Score: ${result.riskScore}/100 | Size: ${this.formatBytes(result.size)}`);
      lines.push('');
    });

    if (report.systemInfo) {
      lines.push('─────────────────────────────────────────────────────────────');
      lines.push('SYSTEM INFORMATION');
      lines.push('─────────────────────────────────────────────────────────────');
      lines.push(`Platform:      ${report.systemInfo.platform}`);
      lines.push(`Architecture:  ${report.systemInfo.arch}`);
      lines.push(`Node Version:  ${report.systemInfo.nodeVersion}`);
      lines.push('');
    }

    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push(`Generated by TorrentHunt VirusHunt v${report.appVersion}`);
    lines.push(`${new Date(report.generatedAt).toLocaleString()}`);
    lines.push('═══════════════════════════════════════════════════════════════');

    return lines.join('\n');
  }

  /**
   * Generate PDF report using puppeteer
   */
  async generatePDF(
    report: ScanReport,
    outputPath: string,
    options: ExportOptions
  ): Promise<void> {
    log.info('Launching puppeteer for PDF generation...');

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1200, height: 800 });

      // Generate HTML content
      const htmlContent = await this.generateHTML(report, {
        ...options,
        includeCharts: options.includeCharts !== false,
      });

      await page.setContent(htmlContent, {
        waitUntil: 'networkidle0',
      });

      // Generate PDF
      await page.pdf({
        path: outputPath,
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm',
        },
      });

      log.info('PDF generated successfully');
    } finally {
      await browser.close();
    }
  }

  /**
   * Generate inline CSS for HTML report
   */
  private getInlineCSS(theme: 'light' | 'dark'): string {
    return `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    :root {
      --primary: #3b82f6;
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #ef4444;
      --critical: #991b1b;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      transition: background-color 0.3s, color 0.3s;
    }

    body.theme-light {
      background: #f9fafb;
      color: #111827;
    }

    body.theme-dark {
      background: #111827;
      color: #f9fafb;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }

    .report-header {
      background: linear-gradient(135deg, var(--primary) 0%, #6366f1 100%);
      color: white;
      padding: 30px;
      border-radius: 12px;
      margin-bottom: 30px;
      position: relative;
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 20px;
      margin-bottom: 20px;
    }

    .logo h1 {
      font-size: 32px;
      font-weight: 700;
    }

    .subtitle {
      opacity: 0.9;
      font-size: 14px;
    }

    .report-meta {
      display: flex;
      gap: 30px;
      flex-wrap: wrap;
      font-size: 14px;
      opacity: 0.95;
    }

    .theme-toggle {
      position: absolute;
      top: 20px;
      right: 20px;
      background: rgba(255, 255, 255, 0.2);
      border: none;
      padding: 10px 15px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 20px;
      transition: background 0.3s;
    }

    .theme-toggle:hover {
      background: rgba(255, 255, 255, 0.3);
    }

    .theme-light .icon-moon { display: inline; }
    .theme-light .icon-sun { display: none; }
    .theme-dark .icon-sun { display: inline; }
    .theme-dark .icon-moon { display: none; }

    section {
      background: white;
      border-radius: 12px;
      padding: 30px;
      margin-bottom: 30px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .theme-dark section {
      background: #1f2937;
    }

    h2 {
      font-size: 24px;
      margin-bottom: 20px;
      color: var(--primary);
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 20px;
      margin-bottom: 20px;
    }

    .stat-card {
      text-align: center;
      padding: 20px;
      border-radius: 8px;
      background: #f3f4f6;
      border: 2px solid transparent;
      transition: transform 0.2s, border-color 0.2s;
    }

    .theme-dark .stat-card {
      background: #374151;
    }

    .stat-card:hover {
      transform: translateY(-2px);
    }

    .stat-icon {
      font-size: 32px;
      margin-bottom: 10px;
    }

    .stat-value {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 5px;
    }

    .stat-label {
      font-size: 14px;
      opacity: 0.7;
    }

    .stat-success { border-color: var(--success); }
    .stat-warning { border-color: var(--warning); }
    .stat-danger { border-color: var(--danger); }
    .stat-critical { border-color: var(--critical); }

    .scan-info {
      background: #f9fafb;
      padding: 15px;
      border-radius: 8px;
      font-size: 14px;
    }

    .theme-dark .scan-info {
      background: #374151;
    }

    .scan-info > div {
      margin: 5px 0;
    }

    .scan-info code {
      background: #e5e7eb;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'Courier New', monospace;
    }

    .theme-dark .scan-info code {
      background: #4b5563;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
    }

    thead {
      background: #f3f4f6;
    }

    .theme-dark thead {
      background: #374151;
    }

    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #e5e7eb;
    }

    .theme-dark th,
    .theme-dark td {
      border-bottom-color: #4b5563;
    }

    th {
      font-weight: 600;
      font-size: 14px;
    }

    td {
      font-size: 13px;
    }

    tbody tr:hover {
      background: #f9fafb;
    }

    .theme-dark tbody tr:hover {
      background: #374151;
    }

    .badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .badge-safe { background: #d1fae5; color: #065f46; }
    .badge-suspicious { background: #fef3c7; color: #92400e; }
    .badge-dangerous { background: #fee2e2; color: #991b1b; }
    .badge-critical { background: #991b1b; color: white; }

    .table-controls {
      display: flex;
      gap: 15px;
      margin-bottom: 15px;
    }

    .table-controls input,
    .table-controls select {
      padding: 8px 12px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 14px;
    }

    .theme-dark .table-controls input,
    .theme-dark .table-controls select {
      background: #374151;
      border-color: #4b5563;
      color: #f9fafb;
    }

    .table-controls input {
      flex: 1;
    }

    .report-footer {
      text-align: center;
      padding: 30px;
      font-size: 14px;
      opacity: 0.7;
    }

    @media print {
      body {
        background: white;
        color: black;
      }

      .theme-toggle {
        display: none;
      }

      section {
        box-shadow: none;
        page-break-inside: avoid;
      }
    }

    .chart-container {
      margin: 20px 0;
      padding: 20px;
      background: #f9fafb;
      border-radius: 8px;
    }

    .theme-dark .chart-container {
      background: #374151;
    }

    canvas {
      max-width: 100%;
      height: auto;
    }
    `;
  }

  /**
   * Generate inline JavaScript for HTML report
   */
  private getInlineJavaScript(chartData: ChartData): string {
    return `
    function toggleTheme() {
      const body = document.body;
      const currentTheme = body.getAttribute('data-theme');
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      body.setAttribute('data-theme', newTheme);
      body.className = 'theme-' + newTheme;
      localStorage.setItem('report-theme', newTheme);
    }

    function filterTable() {
      const searchInput = document.getElementById('searchInput').value.toLowerCase();
      const filterSelect = document.getElementById('filterSelect').value;
      const table = document.querySelector('.files-section table');
      const rows = table.querySelectorAll('tbody tr');

      rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        const level = row.getAttribute('data-level');
        
        const matchesSearch = text.includes(searchInput);
        const matchesFilter = filterSelect === 'all' || level === filterSelect;

        row.style.display = matchesSearch && matchesFilter ? '' : 'none';
      });
    }

    // Load saved theme
    const savedTheme = localStorage.getItem('report-theme');
    if (savedTheme) {
      document.body.setAttribute('data-theme', savedTheme);
      document.body.className = 'theme-' + savedTheme;
    }
    `;
  }

  /**
   * Generate threats table HTML
   */
  private generateThreatsTable(threats: ScanResult[]): string {
    if (threats.length === 0) {
      return '<p style="text-align: center; padding: 40px; opacity: 0.7;">✅ No threats detected!</p>';
    }

    const rows = threats.map(threat => `
      <tr data-level="${threat.threatLevel}">
        <td><strong>${threat.name}</strong><br><small style="opacity: 0.7;">${threat.path}</small></td>
        <td><span class="badge badge-${threat.threatLevel}">${threat.threatLevel}</span></td>
        <td>${threat.riskScore}/100</td>
        <td>${threat.threats.length}</td>
        <td><small>${threat.hash.substring(0, 16)}...</small></td>
      </tr>
    `).join('');

    return `
      <table>
        <thead>
          <tr>
            <th>File</th>
            <th>Level</th>
            <th>Risk</th>
            <th>Threats</th>
            <th>Hash</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
  }

  /**
   * Generate files table HTML
   */
  private generateFilesTable(files: ScanResult[]): string {
    const rows = files.map(file => `
      <tr data-level="${file.threatLevel}">
        <td><strong>${file.name}</strong></td>
        <td>${file.category}</td>
        <td><span class="badge badge-${file.threatLevel}">${file.threatLevel}</span></td>
        <td>${file.riskScore}/100</td>
        <td>${this.formatBytes(file.size)}</td>
      </tr>
    `).join('');

    return `
      <table>
        <thead>
          <tr>
            <th>File Name</th>
            <th>Category</th>
            <th>Level</th>
            <th>Risk</th>
            <th>Size</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
  }

  /**
   * Generate charts HTML
   */
  private generateChartsHTML(chartData: ChartData): string {
    return `
      <section class="charts-section">
        <h2>📈 Statistics</h2>
        <div class="chart-container">
          <h3>Threat Distribution</h3>
          <canvas id="threatChart" width="400" height="200"></canvas>
        </div>
        <div class="chart-container">
          <h3>Category Distribution</h3>
          <canvas id="categoryChart" width="400" height="200"></canvas>
        </div>
      </section>
    `;
  }

  /**
   * Generate system info HTML
   */
  private generateSystemInfoHTML(systemInfo: { platform: string; arch: string; nodeVersion: string }): string {
    return `
      <section class="system-info-section">
        <h2>💻 System Information</h2>
        <div class="scan-info">
          <div><strong>Platform:</strong> ${systemInfo.platform}</div>
          <div><strong>Architecture:</strong> ${systemInfo.arch}</div>
          <div><strong>Node Version:</strong> ${systemInfo.nodeVersion}</div>
        </div>
      </section>
    `;
  }

  /**
   * Prepare chart data from results
   */
  private prepareChartData(results: ScanResult[], summary: ScanSummary): ChartData {
    // Threat distribution
    const threatMap = new Map<string, number>();
    results.forEach(result => {
      result.threats.forEach(threat => {
        const count = threatMap.get(threat.type) || 0;
        threatMap.set(threat.type, count + 1);
      });
    });

    const threatDistribution = Array.from(threatMap.entries()).map(([name, value]) => ({
      name,
      value,
      color: this.getColorForThreatType(name),
    }));

    // Category distribution
    const categoryMap = new Map<FileCategory, number>();
    results.forEach(result => {
      const count = categoryMap.get(result.category) || 0;
      categoryMap.set(result.category, count + 1);
    });

    const categoryDistribution = Array.from(categoryMap.entries()).map(([category, count]) => ({
      category,
      count,
      percentage: (count / results.length) * 100,
    }));

    return {
      threatDistribution,
      directoryStats: [],
      scanTimeline: [],
      categoryDistribution,
      riskHeatmap: results
        .sort((a, b) => b.riskScore - a.riskScore)
        .slice(0, 10)
        .map(r => ({
          path: r.path,
          score: r.riskScore,
          level: r.threatLevel,
        })),
    };
  }

  /**
   * Helper: Generate unique report ID
   */
  private generateReportId(): string {
    return `scan-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Helper: Format bytes to human readable
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  }

  /**
   * Helper: Format duration to human readable
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Helper: Get threat icon
   */
  private getThreatIcon(level: ThreatLevel): string {
    switch (level) {
      case ThreatLevel.SAFE:
        return '✓';
      case ThreatLevel.SUSPICIOUS:
        return '⚠';
      case ThreatLevel.DANGEROUS:
        return '✗';
      case ThreatLevel.CRITICAL:
        return '☠';
      default:
        return '?';
    }
  }

  /**
   * Helper: Get color for threat type
   */
  private getColorForThreatType(type: string): string {
    const colors: Record<string, string> = {
      hash_blacklist: '#ef4444',
      heuristic: '#f59e0b',
      suspicious_extension: '#eab308',
      signature: '#ef4444',
      unknown: '#6b7280',
    };
    return colors[type] || '#6b7280';
  }
}

// Singleton instance
let reportGenerator: ReportGenerator | null = null;

export function getReportGenerator(): ReportGenerator {
  if (!reportGenerator) {
    reportGenerator = new ReportGenerator();
  }
  return reportGenerator;
}
