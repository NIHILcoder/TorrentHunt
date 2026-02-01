/**
 * Scan History Manager
 * Manages scan history database and provides comparison functionality
 */

import { promises as fs } from 'fs';
import path from 'path';
import { app } from 'electron';
import type {
  ScanHistoryEntry,
  ScanHistoryDatabase,
  ScanReport,
  ScanResult,
  ScanSummary,
  ComparisonResult,
  HistoryFilter,
} from '../../shared/scan-report-types';
import { ThreatLevel } from '../../shared/virushunt-types';
import { logger } from '../utils/logger';

const log = logger.child('HistoryManager');

const HISTORY_VERSION = '1.0.0';
const HISTORY_FILE = 'scans_history.json';
const RESULTS_DIR = 'scan_results';

export class HistoryManager {
  private historyPath: string;
  private resultsDir: string;
  private database: ScanHistoryDatabase | null = null;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.historyPath = path.join(userDataPath, 'virusHunt', HISTORY_FILE);
    this.resultsDir = path.join(userDataPath, 'virusHunt', RESULTS_DIR);
  }

  /**
   * Initialize history manager
   */
  async initialize(): Promise<void> {
    log.info('Initializing history manager...');

    // Ensure directories exist
    await fs.mkdir(path.dirname(this.historyPath), { recursive: true });
    await fs.mkdir(this.resultsDir, { recursive: true });

    // Load or create history database
    await this.load();

    log.info('History manager initialized');
  }

  /**
   * Load history database from disk
   */
  private async load(): Promise<void> {
    try {
      const data = await fs.readFile(this.historyPath, 'utf-8');
      this.database = JSON.parse(data);

      // Version migration if needed
      if (this.database && this.database.version !== HISTORY_VERSION) {
        await this.migrate(this.database.version, HISTORY_VERSION);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        log.info('History database not found, creating new one');
        this.database = this.createEmptyDatabase();
        await this.save();
      } else {
        throw error;
      }
    }
  }

  /**
   * Save history database to disk
   */
  private async save(): Promise<void> {
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    this.database.lastUpdated = Date.now();

    const tempPath = `${this.historyPath}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(this.database, null, 2), 'utf-8');
    await fs.rename(tempPath, this.historyPath);

    log.debug('History database saved');
  }

  /**
   * Create empty history database
   */
  private createEmptyDatabase(): ScanHistoryDatabase {
    return {
      version: HISTORY_VERSION,
      lastUpdated: Date.now(),
      scans: [],
    };
  }

  /**
   * Migrate database to new version
   */
  private async migrate(fromVersion: string, toVersion: string): Promise<void> {
    log.info(`Migrating history database from ${fromVersion} to ${toVersion}`);
    // Add migration logic here if needed
    if (this.database) {
      this.database.version = toVersion;
      await this.save();
    }
  }

  /**
   * Add scan to history
   */
  async addScan(report: ScanReport): Promise<ScanHistoryEntry> {
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    // Save full results to separate file
    const resultsFileName = `${report.id}.json`;
    const resultsPath = path.join(this.resultsDir, resultsFileName);
    await fs.writeFile(resultsPath, JSON.stringify(report, null, 2), 'utf-8');

    // Create history entry
    const entry: ScanHistoryEntry = {
      id: report.id,
      timestamp: report.generatedAt,
      path: report.summary.scannedPath,
      summary: report.summary,
      resultsPath,
      tags: this.generateTags(report.summary),
    };

    this.database.scans.unshift(entry); // Add to beginning

    // Limit history to 100 most recent scans
    if (this.database.scans.length > 100) {
      const removed = this.database.scans.splice(100);
      // Delete old result files
      for (const old of removed) {
        try {
          await fs.unlink(old.resultsPath);
        } catch (error) {
          log.warn(`Failed to delete old scan results: ${old.resultsPath}`);
        }
      }
    }

    await this.save();
    log.info(`Scan added to history: ${entry.id}`);

    return entry;
  }

  /**
   * Get all scan history
   */
  getHistory(filter?: HistoryFilter): ScanHistoryEntry[] {
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    let scans = [...this.database.scans];

    if (filter) {
      // Filter by date range
      if (filter.dateRange) {
        scans = scans.filter(
          scan =>
            scan.timestamp >= filter.dateRange!.start &&
            scan.timestamp <= filter.dateRange!.end
        );
      }

      // Filter by path pattern
      if (filter.pathPattern) {
        const pattern = filter.pathPattern.toLowerCase();
        scans = scans.filter(scan => scan.path.toLowerCase().includes(pattern));
      }

      // Filter by threat level
      if (filter.threatLevel && filter.threatLevel.length > 0) {
        scans = scans.filter(scan => {
          const hasLevel =
            (filter.threatLevel!.includes(ThreatLevel.CRITICAL) &&
              scan.summary.criticalFiles > 0) ||
            (filter.threatLevel!.includes(ThreatLevel.DANGEROUS) &&
              scan.summary.dangerousFiles > 0) ||
            (filter.threatLevel!.includes(ThreatLevel.SUSPICIOUS) &&
              scan.summary.suspiciousFiles > 0) ||
            (filter.threatLevel!.includes(ThreatLevel.SAFE) &&
              scan.summary.cleanFiles > 0);
          return hasLevel;
        });
      }

      // Filter by tags
      if (filter.tags && filter.tags.length > 0) {
        scans = scans.filter(scan =>
          filter.tags!.some(tag => scan.tags?.includes(tag))
        );
      }

      // Filter by threats count
      if (filter.minThreats !== undefined) {
        scans = scans.filter(scan => scan.summary.totalThreats >= filter.minThreats!);
      }

      if (filter.maxThreats !== undefined) {
        scans = scans.filter(scan => scan.summary.totalThreats <= filter.maxThreats!);
      }
    }

    return scans;
  }

  /**
   * Get single scan entry
   */
  getScan(id: string): ScanHistoryEntry | null {
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    return this.database.scans.find(scan => scan.id === id) || null;
  }

  /**
   * Get full scan report
   */
  async getScanReport(id: string): Promise<ScanReport | null> {
    const entry = this.getScan(id);
    if (!entry) {
      return null;
    }

    try {
      const data = await fs.readFile(entry.resultsPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      log.error(`Failed to load scan report: ${id}`, error);
      return null;
    }
  }

  /**
   * Delete scan from history
   */
  async deleteScan(id: string): Promise<boolean> {
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    const index = this.database.scans.findIndex(scan => scan.id === id);
    if (index === -1) {
      return false;
    }

    const entry = this.database.scans[index];

    // Delete results file
    try {
      await fs.unlink(entry.resultsPath);
    } catch (error) {
      log.warn(`Failed to delete scan results file: ${entry.resultsPath}`);
    }

    // Remove from database
    this.database.scans.splice(index, 1);
    await this.save();

    log.info(`Scan deleted from history: ${id}`);
    return true;
  }

  /**
   * Delete multiple scans
   */
  async deleteScans(ids: string[]): Promise<{ deleted: number; failed: number }> {
    let deleted = 0;
    let failed = 0;

    for (const id of ids) {
      const success = await this.deleteScan(id);
      if (success) {
        deleted++;
      } else {
        failed++;
      }
    }

    return { deleted, failed };
  }

  /**
   * Clear all history
   */
  async clearHistory(): Promise<void> {
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    // Delete all result files
    for (const entry of this.database.scans) {
      try {
        await fs.unlink(entry.resultsPath);
      } catch (error) {
        log.warn(`Failed to delete scan results: ${entry.resultsPath}`);
      }
    }

    this.database.scans = [];
    await this.save();

    log.info('All scan history cleared');
  }

  /**
   * Update scan entry
   */
  async updateScan(
    id: string,
    updates: Partial<Pick<ScanHistoryEntry, 'tags' | 'notes'>>
  ): Promise<boolean> {
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    const scan = this.database.scans.find(s => s.id === id);
    if (!scan) {
      return false;
    }

    if (updates.tags !== undefined) {
      scan.tags = updates.tags;
    }

    if (updates.notes !== undefined) {
      scan.notes = updates.notes;
    }

    await this.save();
    log.info(`Scan updated: ${id}`);

    return true;
  }

  /**
   * Compare two scans
   */
  async compareScans(id1: string, id2: string): Promise<ComparisonResult | null> {
    const entry1 = this.getScan(id1);
    const entry2 = this.getScan(id2);

    if (!entry1 || !entry2) {
      log.error('One or both scans not found for comparison');
      return null;
    }

    const report1 = await this.getScanReport(id1);
    const report2 = await this.getScanReport(id2);

    if (!report1 || !report2) {
      log.error('Failed to load scan reports for comparison');
      return null;
    }

    log.info(`Comparing scans: ${id1} vs ${id2}`);

    // Build file maps for quick lookup
    const files1 = new Map(report1.results.map(r => [r.path, r]));
    const files2 = new Map(report2.results.map(r => [r.path, r]));

    // Find new files (in scan2 but not in scan1)
    const newFiles: ScanResult[] = [];
    for (const [path, result] of files2) {
      if (!files1.has(path)) {
        newFiles.push(result);
      }
    }

    // Find removed files (in scan1 but not in scan2)
    const removedFiles: ScanResult[] = [];
    for (const [path, result] of files1) {
      if (!files2.has(path)) {
        removedFiles.push(result);
      }
    }

    // Find changed files
    const changedFiles: ComparisonResult['changedFiles'] = [];
    for (const [path, result2] of files2) {
      const result1 = files1.get(path);
      if (result1) {
        const changes = this.compareResults(result1, result2);
        if (changes.length > 0) {
          changedFiles.push({
            path,
            scan1Result: result1,
            scan2Result: result2,
            changes,
          });
        }
      }
    }

    // Find new threats (threats in scan2 that weren't in scan1)
    const newThreats: ScanResult[] = [];
    for (const result2 of report2.results) {
      const result1 = files1.get(result2.path);
      if (!result1) {
        // New file with threats
        if (result2.threatLevel !== ThreatLevel.SAFE) {
          newThreats.push(result2);
        }
      } else {
        // Existing file with new threats
        if (
          result2.threatLevel !== ThreatLevel.SAFE &&
          result1.threatLevel === ThreatLevel.SAFE
        ) {
          newThreats.push(result2);
        }
      }
    }

    // Find resolved threats (threats in scan1 that are gone in scan2)
    const resolvedThreats: ScanResult[] = [];
    for (const result1 of report1.results) {
      const result2 = files2.get(result1.path);
      if (result2) {
        if (
          result1.threatLevel !== ThreatLevel.SAFE &&
          result2.threatLevel === ThreatLevel.SAFE
        ) {
          resolvedThreats.push(result1);
        }
      }
    }

    // Calculate statistics comparison
    const threatChange = entry2.summary.totalThreats - entry1.summary.totalThreats;
    const cleanFilesChange = entry2.summary.cleanFiles - entry1.summary.cleanFiles;

    // Calculate average risk score change
    const avgRiskScore1 =
      report1.results.reduce((sum, r) => sum + r.riskScore, 0) /
      report1.results.length;
    const avgRiskScore2 =
      report2.results.reduce((sum, r) => sum + r.riskScore, 0) /
      report2.results.length;
    const riskScoreChange = avgRiskScore2 - avgRiskScore1;

    const comparison: ComparisonResult = {
      scan1: entry1,
      scan2: entry2,
      newThreats,
      resolvedThreats,
      changedFiles,
      newFiles,
      removedFiles,
      statsComparison: {
        threatChange,
        cleanFilesChange,
        riskScoreChange,
      },
    };

    log.info(`Comparison complete: ${newThreats.length} new threats, ${resolvedThreats.length} resolved`);

    return comparison;
  }

  /**
   * Compare two scan results
   */
  private compareResults(result1: ScanResult, result2: ScanResult): string[] {
    const changes: string[] = [];

    // Check hash change
    if (result1.hash !== result2.hash) {
      changes.push('File content changed (different hash)');
    }

    // Check threat level change
    if (result1.threatLevel !== result2.threatLevel) {
      changes.push(
        `Threat level changed: ${result1.threatLevel} → ${result2.threatLevel}`
      );
    }

    // Check risk score change
    const scoreDiff = result2.riskScore - result1.riskScore;
    if (Math.abs(scoreDiff) >= 10) {
      changes.push(
        `Risk score changed: ${result1.riskScore} → ${result2.riskScore} (${scoreDiff > 0 ? '+' : ''}${scoreDiff})`
      );
    }

    // Check threat count change
    if (result1.threats.length !== result2.threats.length) {
      changes.push(
        `Threat count changed: ${result1.threats.length} → ${result2.threats.length}`
      );
    }

    // Check category change
    if (result1.category !== result2.category) {
      changes.push(`Category changed: ${result1.category} → ${result2.category}`);
    }

    // Check reputation change
    if (result1.reputation !== result2.reputation) {
      changes.push(
        `Reputation changed: ${result1.reputation || 'none'} → ${result2.reputation || 'none'}`
      );
    }

    return changes;
  }

  /**
   * Generate tags for scan based on summary
   */
  private generateTags(summary: ScanSummary): string[] {
    const tags: string[] = [];

    if (summary.totalThreats === 0) {
      tags.push('clean');
    }

    if (summary.criticalFiles > 0) {
      tags.push('critical');
    }

    if (summary.dangerousFiles > 0) {
      tags.push('dangerous');
    }

    if (summary.suspiciousFiles > 0) {
      tags.push('suspicious');
    }

    // Add time-based tags
    const now = Date.now();
    const age = now - summary.startTime;
    const dayMs = 24 * 60 * 60 * 1000;

    if (age < dayMs) {
      tags.push('recent');
    } else if (age < 7 * dayMs) {
      tags.push('this-week');
    } else if (age < 30 * dayMs) {
      tags.push('this-month');
    }

    return tags;
  }

  /**
   * Get statistics about scan history
   */
  getStatistics(): {
    totalScans: number;
    totalThreatsDetected: number;
    averageThreatsPerScan: number;
    mostDangerousScan: ScanHistoryEntry | null;
    cleanestScan: ScanHistoryEntry | null;
    totalFilesScanned: number;
  } {
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    const scans = this.database.scans;

    if (scans.length === 0) {
      return {
        totalScans: 0,
        totalThreatsDetected: 0,
        averageThreatsPerScan: 0,
        mostDangerousScan: null,
        cleanestScan: null,
        totalFilesScanned: 0,
      };
    }

    const totalThreatsDetected = scans.reduce(
      (sum, scan) => sum + scan.summary.totalThreats,
      0
    );
    const totalFilesScanned = scans.reduce(
      (sum, scan) => sum + scan.summary.totalFiles,
      0
    );

    const mostDangerousScan = scans.reduce((most, scan) =>
      scan.summary.totalThreats > most.summary.totalThreats ? scan : most
    );

    const cleanestScan = scans.reduce((cleanest, scan) =>
      scan.summary.totalThreats < cleanest.summary.totalThreats ? scan : cleanest
    );

    return {
      totalScans: scans.length,
      totalThreatsDetected,
      averageThreatsPerScan: totalThreatsDetected / scans.length,
      mostDangerousScan,
      cleanestScan,
      totalFilesScanned,
    };
  }
}

// Singleton instance
let historyManager: HistoryManager | null = null;

export function getHistoryManager(): HistoryManager {
  if (!historyManager) {
    historyManager = new HistoryManager();
  }
  return historyManager;
}
