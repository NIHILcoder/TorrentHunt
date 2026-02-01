import { promises as fs } from 'fs';
import { join, basename } from 'path';
import { app, BrowserWindow } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import {
  ScanResult,
  ScanStatus,
  FileScanResult,
  ThreatLevel,
  ThreatInfo,
  ReputationStatus,
  ScanOptions,
  ScanProgress,
  FileReputation,
  HeuristicMatch
} from '../../../shared/virushunt-types';
import { FileHashService } from './FileHashService';
import { ReputationDatabase } from './ReputationDatabase';
import { HeuristicAnalyzer } from './AdvancedHeuristicAnalyzer';
import { VirusHuntSettings } from './VirusHuntSettings';
import { fileHashService } from './FileHashService';
import { reputationDatabase } from './ReputationDatabase';
import { heuristicAnalyzer } from './AdvancedHeuristicAnalyzer';
import { virusHuntSettings } from './VirusHuntSettings';

/**
 * Active scan tracking
 */
interface ActiveScan {
  id: string;
  controller: AbortController;
  startTime: number;
  paths: string[];
}

/**
 * Main VirusHunt scanning service
 */
export class VirusHuntService {
  private hashService: FileHashService;
  private reputationDb: ReputationDatabase;
  private heuristicAnalyzer: HeuristicAnalyzer;
  private settings: VirusHuntSettings;
  private activeScans: Map<string, ActiveScan> = new Map();
  private initialized = false;
  private mainWindow: BrowserWindow | null = null;

  constructor(
    hashService: FileHashService,
    reputationDb: ReputationDatabase,
    heuristicAnalyzer: HeuristicAnalyzer,
    settings: VirusHuntSettings
  ) {
    this.hashService = hashService;
    this.reputationDb = reputationDb;
    this.heuristicAnalyzer = heuristicAnalyzer;
    this.settings = settings;
  }

  /**
   * Initialize the VirusHunt service
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Initialize all dependencies
    await Promise.all([
      this.settings.initialize(),
      this.reputationDb.initialize()
    ]);

    this.initialized = true;
    console.log('VirusHunt service initialized');
  }

  /**
   * Set main window for sending progress updates
   * @param window Main browser window
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  /**
   * Start a new scan
   * @param options Scan options
   * @returns Scan ID immediately, results come via events
   */
  async startScan(options: ScanOptions): Promise<{ scanId: string }> {
    await this.ensureInitialized();

    if (!this.settings.isEnabled()) {
      throw new Error('VirusHunt is disabled');
    }

    const scanId = uuidv4();
    const controller = new AbortController();
    const startTime = Date.now();

    // Register active scan
    const activeScan: ActiveScan = {
      id: scanId,
      controller,
      startTime,
      paths: options.paths
    };
    this.activeScans.set(scanId, activeScan);

    // Run scan in background (don't await!)
    this.performScan(scanId, options, controller, startTime).catch(error => {
      console.error('Background scan error:', error);
      this.sendScanError(scanId, error instanceof Error ? error.message : 'Unknown error');
    });

    // Return scanId immediately
    return { scanId };
  }

  /**
   * Perform the actual scanning in background
   */
  private async performScan(
    scanId: string,
    options: ScanOptions,
    controller: AbortController,
    startTime: number
  ): Promise<void> {

    try {
      // Collect all files to scan
      const filesToScan = await this.collectFiles(options.paths, controller.signal);

      // Create initial scan result
      const scanResult: ScanResult = {
        scanId,
        status: ScanStatus.SCANNING,
        totalFiles: filesToScan.length,
        scannedFiles: 0,
        threatsDetected: 0,
        safeFiles: 0,
        suspiciousFiles: 0,
        fileResults: [],
        startedAt: startTime
      };

      // Send initial progress
      this.sendProgress({
        scanId,
        currentFile: '',
        progress: 0,
        scannedFiles: 0,
        totalFiles: filesToScan.length,
        threatsFound: 0
      });

      // Scan each file
      for (let i = 0; i < filesToScan.length; i++) {
        if (controller.signal.aborted) {
          scanResult.status = ScanStatus.CANCELLED;
          break;
        }

        const filePath = filesToScan[i];
        
        try {
          // Send progress update
          this.sendProgress({
            scanId,
            currentFile: basename(filePath),
            progress: Math.round((i / filesToScan.length) * 100),
            scannedFiles: i,
            totalFiles: filesToScan.length,
            threatsFound: scanResult.threatsDetected
          });

          // Scan the file
          const fileResult = await this.scanFile(
            filePath,
            options.enableHeuristics ?? this.settings.isHeuristicsEnabled(),
            options.timeout ?? this.settings.getScanTimeout(),
            controller.signal
          );

          scanResult.fileResults.push(fileResult);
          scanResult.scannedFiles++;

          // Update counters
          if (fileResult.isSafe) {
            scanResult.safeFiles++;
          } else if (fileResult.threatLevel === ThreatLevel.SUSPICIOUS) {
            scanResult.suspiciousFiles++;
          }
          
          if (fileResult.threats.length > 0) {
            scanResult.threatsDetected++;
          }

          // Auto-quarantine if enabled and dangerous
          if (
            this.settings.isAutoQuarantineEnabled() &&
            [ThreatLevel.DANGEROUS, ThreatLevel.CRITICAL].includes(fileResult.threatLevel)
          ) {
            await this.quarantineFile(filePath, fileResult);
          }

        } catch (error) {
          console.error(`Error scanning file ${filePath}:`, error);
          // Continue with next file
        }
      }

      // Finalize scan result
      const endTime = Date.now();
      scanResult.completedAt = endTime;
      scanResult.duration = endTime - startTime;
      
      if (scanResult.status !== ScanStatus.CANCELLED) {
        scanResult.status = ScanStatus.COMPLETED;
      }

      // Send final progress
      this.sendProgress({
        scanId,
        currentFile: '',
        progress: 100,
        scannedFiles: scanResult.scannedFiles,
        totalFiles: scanResult.totalFiles,
        threatsFound: scanResult.threatsDetected
      });

      // Send completion event
      this.sendScanComplete(scanId, scanResult);

    } catch (error) {
      console.error('Scan error:', error);
      
      const errorResult: ScanResult = {
        scanId,
        status: ScanStatus.FAILED,
        totalFiles: 0,
        scannedFiles: 0,
        threatsDetected: 0,
        safeFiles: 0,
        suspiciousFiles: 0,
        fileResults: [],
        startedAt: startTime,
        completedAt: Date.now(),
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      // Send error event
      this.sendScanError(scanId, error instanceof Error ? error.message : 'Unknown error');

    } finally {
      this.activeScans.delete(scanId);
    }
  }

  /**
   * Cancel an active scan
   * @param scanId Scan ID to cancel
   */
  async cancelScan(scanId: string): Promise<boolean> {
    const scan = this.activeScans.get(scanId);
    
    if (!scan) {
      return false;
    }

    scan.controller.abort();
    this.activeScans.delete(scanId);
    return true;
  }

  /**
   * Scan a single file
   * @param filePath Absolute path to file
   * @param enableHeuristics Whether to enable heuristic analysis
   * @param timeout Scan timeout in milliseconds
   * @param signal Abort signal for cancellation
   * @returns File scan result
   */
  private async scanFile(
    filePath: string,
    enableHeuristics: boolean,
    timeout: number,
    signal?: AbortSignal
  ): Promise<FileScanResult> {
    const startTime = Date.now();
    const fileName = basename(filePath);

    try {
      // Get file stats
      const stats = await fs.stat(filePath);

      // Check if should skip based on settings
      if (!this.settings.shouldScanFile(fileName)) {
        return this.createSafeResult(filePath, fileName, stats.size, startTime);
      }

      if (!this.settings.shouldScanFileSize(stats.size)) {
        return this.createSafeResult(filePath, fileName, stats.size, startTime);
      }

      // Compute file hash
      const hash = await this.hashService.computeFileHash(filePath, signal);

      if (signal?.aborted) {
        throw new Error('Scan cancelled');
      }

      // Check hash against database
      const reputation = await this.reputationDb.checkFileHash(hash);

      const threats: ThreatInfo[] = [];
      let threatLevel = ThreatLevel.SAFE;

      // Check reputation status
      if (reputation.status === ReputationStatus.BLACKLISTED) {
        threats.push({
          type: 'hash_blacklist',
          level: ThreatLevel.DANGEROUS,
          description: 'File hash found in blacklist database',
          details: `File identified as known threat`,
          confidence: 95,
          detectedAt: Date.now()
        });
        threatLevel = ThreatLevel.DANGEROUS;
      } else if (reputation.status === ReputationStatus.WHITELISTED) {
        // File is whitelisted, mark as safe
        return {
          filePath,
          fileName,
          size: stats.size,
          hash,
          threatLevel: ThreatLevel.SAFE,
          reputation: ReputationStatus.WHITELISTED,
          threats: [],
          heuristicMatches: [],
          isSafe: true,
          scanDuration: Date.now() - startTime,
          scannedAt: Date.now()
        };
      }

      // Perform heuristic analysis if enabled
      let heuristicMatches: HeuristicMatch[] = [];
      
      if (enableHeuristics) {
        // Note: deepScan flag will be passed from options, using regular analysis here
        // For deep analysis, use scanFileDeep method
        heuristicMatches = await this.heuristicAnalyzer.analyzeFile(filePath, signal);
      }

      if (signal?.aborted) {
        throw new Error('Scan cancelled');
      }

      // Process heuristic matches
      if (heuristicMatches.length > 0) {
        const heuristicThreatLevel = this.heuristicAnalyzer.getOverallThreatLevel(heuristicMatches);
        
        if (heuristicThreatLevel !== ThreatLevel.SAFE) {
          threats.push({
            type: 'heuristic',
            level: heuristicThreatLevel,
            description: `Heuristic analysis detected ${heuristicMatches.length} suspicious pattern(s)`,
            details: heuristicMatches.map(m => m.ruleName).join(', '),
            confidence: this.heuristicAnalyzer.getConfidenceScore(heuristicMatches),
            detectedAt: Date.now()
          });

          // Update overall threat level if heuristic level is higher
          if (this.compareThreatLevels(heuristicThreatLevel, threatLevel) > 0) {
            threatLevel = heuristicThreatLevel;
          }
        }
      }

      const isSafe = threatLevel === ThreatLevel.SAFE;
      const reputationStatus = isSafe 
        ? ReputationStatus.UNKNOWN 
        : (threatLevel === ThreatLevel.SUSPICIOUS ? ReputationStatus.SUSPICIOUS : ReputationStatus.BLACKLISTED);

      return {
        filePath,
        fileName,
        size: stats.size,
        hash,
        threatLevel,
        reputation: reputationStatus,
        threats,
        heuristicMatches,
        isSafe,
        scanDuration: Date.now() - startTime,
        scannedAt: Date.now()
      };

    } catch (error) {
      if (signal?.aborted) {
        throw error;
      }

      console.error(`Error scanning file ${filePath}:`, error);
      
      // Return error result
      return {
        filePath,
        fileName,
        size: 0,
        hash: '',
        threatLevel: ThreatLevel.SAFE,
        reputation: ReputationStatus.UNKNOWN,
        threats: [],
        heuristicMatches: [],
        isSafe: true,
        scanDuration: Date.now() - startTime,
        scannedAt: Date.now()
      };
    }
  }

  /**
   * Collect all files from given paths
   * @param paths Array of file or directory paths
   * @param signal Abort signal
   * @returns Array of file paths
   */
  private async collectFiles(paths: string[], signal?: AbortSignal): Promise<string[]> {
    const files: string[] = [];

    for (const path of paths) {
      if (signal?.aborted) {
        break;
      }

      try {
        const stats = await fs.stat(path);

        if (stats.isFile()) {
          files.push(path);
        } else if (stats.isDirectory()) {
          const dirFiles = await this.collectFilesFromDirectory(path, signal);
          files.push(...dirFiles);
        }
      } catch (error) {
        console.error(`Error accessing path ${path}:`, error);
      }
    }

    return files;
  }

  /**
   * Recursively collect files from directory
   * @param dirPath Directory path
   * @param signal Abort signal
   * @returns Array of file paths
   */
  private async collectFilesFromDirectory(
    dirPath: string,
    signal?: AbortSignal
  ): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (signal?.aborted) {
          break;
        }

        const fullPath = join(dirPath, entry.name);

        if (entry.isFile()) {
          files.push(fullPath);
        } else if (entry.isDirectory()) {
          const subFiles = await this.collectFilesFromDirectory(fullPath, signal);
          files.push(...subFiles);
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${dirPath}:`, error);
    }

    return files;
  }

  /**
   * Quarantine a dangerous file
   * @param filePath File to quarantine
   * @param scanResult Scan result
   */
  private async quarantineFile(
    filePath: string,
    scanResult: FileScanResult
  ): Promise<void> {
    try {
      const quarantinePath = this.settings.getQuarantinePath();
      await fs.mkdir(quarantinePath, { recursive: true });

      const fileName = basename(filePath);
      const timestamp = Date.now();
      const quarantineFileName = `${timestamp}_${fileName}`;
      const quarantineFilePath = join(quarantinePath, quarantineFileName);

      // Move file to quarantine
      await fs.rename(filePath, quarantineFilePath);

      // Save metadata
      const metadataPath = join(quarantinePath, `${quarantineFileName}.json`);
      const metadata = {
        originalPath: filePath,
        quarantinedAt: timestamp,
        scanResult
      };
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');

      console.log(`File quarantined: ${filePath} -> ${quarantineFilePath}`);
    } catch (error) {
      console.error(`Failed to quarantine file ${filePath}:`, error);
    }
  }

  /**
   * Create a safe file result (for skipped files)
   */
  private createSafeResult(
    filePath: string,
    fileName: string,
    size: number,
    startTime: number
  ): FileScanResult {
    return {
      filePath,
      fileName,
      size,
      hash: '',
      threatLevel: ThreatLevel.SAFE,
      reputation: ReputationStatus.UNKNOWN,
      threats: [],
      heuristicMatches: [],
      isSafe: true,
      scanDuration: Date.now() - startTime,
      scannedAt: Date.now()
    };
  }

  /**
   * Compare threat levels
   * @returns -1 if a < b, 0 if a === b, 1 if a > b
   */
  private compareThreatLevels(a: ThreatLevel, b: ThreatLevel): number {
    const order = [ThreatLevel.SAFE, ThreatLevel.SUSPICIOUS, ThreatLevel.DANGEROUS, ThreatLevel.CRITICAL];
    return order.indexOf(a) - order.indexOf(b);
  }

  /**
   * Send progress update to renderer
   */
  private sendProgress(progress: ScanProgress): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('virushunt:scan-progress', progress);
    }
  }

  /**
   * Send scan complete event to renderer
   */
  private sendScanComplete(scanId: string, result: ScanResult): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('virushunt:scan-complete', { scanId, result });
    }
  }

  /**
   * Send scan error event to renderer
   */
  private sendScanError(scanId: string, error: string): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('virushunt:scan-error', { scanId, error });
    }
  }

  /**
   * Get file reputation
   * @param hash File hash (SHA256)
   * @returns File reputation
   */
  async getFileReputation(hash: string): Promise<FileReputation> {
    await this.ensureInitialized();
    return await this.reputationDb.checkFileHash(hash);
  }

  /**
   * Add file to whitelist
   * @param hash File hash (SHA256)
   * @param fileName Optional file name
   * @param size Optional file size
   */
  async addToWhitelist(hash: string, fileName?: string, size?: number): Promise<void> {
    await this.ensureInitialized();
    await this.reputationDb.addToWhitelist(hash, fileName, size, 'manual');
  }

  /**
   * Add file to blacklist
   * @param hash File hash (SHA256)
   * @param threatType Threat type
   * @param fileName Optional file name
   * @param description Optional description
   */
  async addToBlacklist(
    hash: string,
    threatType: string,
    fileName?: string,
    description?: string
  ): Promise<void> {
    await this.ensureInitialized();
    await this.reputationDb.addToBlacklist(
      hash,
      threatType,
      ThreatLevel.DANGEROUS,
      fileName,
      description,
      'manual'
    );
  }

  /**
   * Get active scans
   * @returns Array of active scan IDs
   */
  getActiveScans(): string[] {
    return Array.from(this.activeScans.keys());
  }

  /**
   * Check if scan is active
   * @param scanId Scan ID
   * @returns True if scan is active
   */
  isScanActive(scanId: string): boolean {
    return this.activeScans.has(scanId);
  }

  /**
   * Perform deep analysis on a single file
   * Uses all available analysis modules: YARA, Import Table, Packer Detection, String Signatures
   * For large files (>100MB), only first 100MB is analyzed to prevent memory issues
   * @param filePath Path to file
   * @param signal Optional abort signal
   * @param onProgress Optional progress callback
   * @returns Deep analysis result
   */
  async deepScanFile(
    filePath: string, 
    signal?: AbortSignal,
    onProgress?: (progress: number, message: string) => void
  ): Promise<{
    success: boolean;
    result?: any;
    error?: string;
  }> {
    await this.ensureInitialized();

    try {
      // Check file size
      const stats = await fs.stat(filePath);
      const fileSizeMB = stats.size / 1024 / 1024;
      
      // Create timeout based on file size (max 5 minutes for very large files)
      const timeoutMs = Math.min(fileSizeMB > 50 ? 180000 : 60000, 300000);
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
      
      try {
        // Always run in main thread, but with optimized reading for large files
        const combinedSignal = signal || timeoutController.signal;
        
        // Send progress updates
        onProgress?.(10, 'Starting analysis...');
        onProgress?.(20, 'Reading file...');
        
        const deepResult = await this.heuristicAnalyzer.analyzeDeep(filePath, combinedSignal);
        
        onProgress?.(100, 'Complete!');
        clearTimeout(timeoutId);
        
        return {
          success: true,
          result: deepResult
        };
      } catch (error) {
        clearTimeout(timeoutId);
        
        if (timeoutController.signal.aborted && !signal?.aborted) {
          return {
            success: false,
            error: `Analysis timeout (${timeoutMs / 1000}s limit exceeded for ${fileSizeMB.toFixed(1)}MB file)`
          };
        }
        throw error;
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Deep scan failed'
      };
    }
  }

  /**
   * Ensure service is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}

// Create and export singleton instance
// Export singleton instance
export const virusHuntService = new VirusHuntService(
  fileHashService,
  reputationDatabase,
  heuristicAnalyzer,
  virusHuntSettings
);
