import { promises as fs } from 'fs';
import { join } from 'path';
import { app } from 'electron';
import { VirusHuntConfig } from '../../../shared/virushunt-types';

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: VirusHuntConfig = {
  enabled: true,
  enableHeuristics: true,
  autoUpdateDatabase: true,
  updateInterval: 24, // 24 hours
  maxFileSizeToScan: 100 * 1024 * 1024, // 100MB
  scanTimeout: 30000, // 30 seconds per file
  skipExtensions: [
    '.txt', '.nfo', '.jpg', '.jpeg', '.png', '.gif', '.bmp',
    '.mp3', '.flac', '.wav', '.ogg', '.m4a',
    '.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv',
    '.pdf', '.epub', '.mobi'
  ],
  autoQuarantine: false,
  quarantinePath: undefined,
  realTimeProtection: false,
  scanNewTorrents: true,
  enableLogging: true
};

/**
 * Service for managing VirusHunt settings
 */
export class VirusHuntSettings {
  private config: VirusHuntConfig;
  private configPath: string;
  private configFile: string;
  private changeListeners: Set<(config: VirusHuntConfig) => void> = new Set();

  constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.configPath = join(app.getPath('userData'), 'virushunt');
    this.configFile = join(this.configPath, 'config.json');
  }

  /**
   * Initialize settings service
   * Loads configuration from disk or creates default
   */
  async initialize(): Promise<void> {
    // Ensure config directory exists
    await fs.mkdir(this.configPath, { recursive: true });

    // Try to load existing configuration
    try {
      const data = await fs.readFile(this.configFile, 'utf-8');
      const loaded = JSON.parse(data);
      
      // Merge with defaults to ensure all properties exist
      this.config = { ...DEFAULT_CONFIG, ...loaded };
      
      // Validate and fix configuration
      this.validateConfig();
      
      // Save back to ensure any missing fields are added
      await this.save();
    } catch (error) {
      // Config file doesn't exist or is corrupted, use defaults
      console.log('Using default VirusHunt configuration');
      await this.save();
    }
  }

  /**
   * Get current configuration
   * @returns Copy of current configuration
   */
  getConfig(): VirusHuntConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   * @param updates Partial configuration updates
   */
  async updateConfig(updates: Partial<VirusHuntConfig>): Promise<void> {
    this.config = { ...this.config, ...updates };
    this.validateConfig();
    await this.save();
    this.notifyListeners();
  }

  /**
   * Reset configuration to defaults
   */
  async resetToDefaults(): Promise<void> {
    this.config = { ...DEFAULT_CONFIG };
    await this.save();
    this.notifyListeners();
  }

  /**
   * Check if VirusHunt is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Enable or disable VirusHunt
   * @param enabled Whether to enable VirusHunt
   */
  async setEnabled(enabled: boolean): Promise<void> {
    await this.updateConfig({ enabled });
  }

  /**
   * Check if heuristic analysis is enabled
   */
  isHeuristicsEnabled(): boolean {
    return this.config.enableHeuristics;
  }

  /**
   * Enable or disable heuristic analysis
   * @param enabled Whether to enable heuristics
   */
  async setHeuristicsEnabled(enabled: boolean): Promise<void> {
    await this.updateConfig({ enableHeuristics: enabled });
  }

  /**
   * Check if file should be scanned based on extension
   * @param fileName File name to check
   * @returns True if file should be scanned
   */
  shouldScanFile(fileName: string): boolean {
    const ext = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
    return !this.config.skipExtensions.includes(ext);
  }

  /**
   * Check if file should be scanned based on size
   * @param fileSize File size in bytes
   * @returns True if file should be scanned
   */
  shouldScanFileSize(fileSize: number): boolean {
    // If maxFileSizeToScan is 0, no limit
    if (this.config.maxFileSizeToScan === 0) {
      return true;
    }
    return fileSize <= this.config.maxFileSizeToScan;
  }

  /**
   * Get scan timeout in milliseconds
   */
  getScanTimeout(): number {
    return this.config.scanTimeout;
  }

  /**
   * Check if auto-quarantine is enabled
   */
  isAutoQuarantineEnabled(): boolean {
    return this.config.autoQuarantine;
  }

  /**
   * Get quarantine path
   * @returns Quarantine directory path or default
   */
  getQuarantinePath(): string {
    if (this.config.quarantinePath) {
      return this.config.quarantinePath;
    }
    // Default quarantine path
    return join(app.getPath('userData'), 'virushunt', 'quarantine');
  }

  /**
   * Set quarantine path
   * @param path Quarantine directory path
   */
  async setQuarantinePath(path: string): Promise<void> {
    await this.updateConfig({ quarantinePath: path });
  }

  /**
   * Check if real-time protection is enabled
   */
  isRealTimeProtectionEnabled(): boolean {
    return this.config.realTimeProtection;
  }

  /**
   * Check if new torrents should be scanned automatically
   */
  shouldScanNewTorrents(): boolean {
    return this.config.scanNewTorrents;
  }

  /**
   * Check if logging is enabled
   */
  isLoggingEnabled(): boolean {
    return this.config.enableLogging;
  }

  /**
   * Get database update interval in hours
   */
  getUpdateInterval(): number {
    return this.config.updateInterval;
  }

  /**
   * Check if auto-update is enabled
   */
  isAutoUpdateEnabled(): boolean {
    return this.config.autoUpdateDatabase;
  }

  /**
   * Add configuration change listener
   * @param listener Callback function
   */
  addChangeListener(listener: (config: VirusHuntConfig) => void): void {
    this.changeListeners.add(listener);
  }

  /**
   * Remove configuration change listener
   * @param listener Callback function
   */
  removeChangeListener(listener: (config: VirusHuntConfig) => void): void {
    this.changeListeners.delete(listener);
  }

  /**
   * Export configuration to file
   * @param outputPath Output file path
   */
  async exportConfig(outputPath: string): Promise<void> {
    const data = JSON.stringify(this.config, null, 2);
    await fs.writeFile(outputPath, data, 'utf-8');
  }

  /**
   * Import configuration from file
   * @param inputPath Input file path
   */
  async importConfig(inputPath: string): Promise<void> {
    const data = await fs.readFile(inputPath, 'utf-8');
    const imported = JSON.parse(data);
    
    this.config = { ...DEFAULT_CONFIG, ...imported };
    this.validateConfig();
    await this.save();
    this.notifyListeners();
  }

  /**
   * Save configuration to disk
   */
  private async save(): Promise<void> {
    const data = JSON.stringify(this.config, null, 2);
    await fs.writeFile(this.configFile, data, 'utf-8');
  }

  /**
   * Validate and fix configuration values
   */
  private validateConfig(): void {
    // Ensure enabled is boolean
    if (typeof this.config.enabled !== 'boolean') {
      this.config.enabled = DEFAULT_CONFIG.enabled;
    }

    // Ensure numeric values are valid
    if (typeof this.config.updateInterval !== 'number' || this.config.updateInterval < 1) {
      this.config.updateInterval = DEFAULT_CONFIG.updateInterval;
    }

    if (typeof this.config.maxFileSizeToScan !== 'number' || this.config.maxFileSizeToScan < 0) {
      this.config.maxFileSizeToScan = DEFAULT_CONFIG.maxFileSizeToScan;
    }

    if (typeof this.config.scanTimeout !== 'number' || this.config.scanTimeout < 1000) {
      this.config.scanTimeout = DEFAULT_CONFIG.scanTimeout;
    }

    // Ensure arrays are valid
    if (!Array.isArray(this.config.skipExtensions)) {
      this.config.skipExtensions = DEFAULT_CONFIG.skipExtensions;
    }

    // Ensure all required fields exist
    const requiredFields: (keyof VirusHuntConfig)[] = [
      'enabled',
      'enableHeuristics',
      'autoUpdateDatabase',
      'updateInterval',
      'maxFileSizeToScan',
      'scanTimeout',
      'skipExtensions',
      'autoQuarantine',
      'realTimeProtection',
      'scanNewTorrents',
      'enableLogging'
    ];

    for (const field of requiredFields) {
      if (this.config[field] === undefined) {
        (this.config as any)[field] = DEFAULT_CONFIG[field];
      }
    }
  }

  /**
   * Notify all listeners of configuration change
   */
  private notifyListeners(): void {
    const configCopy = this.getConfig();
    for (const listener of this.changeListeners) {
      try {
        listener(configCopy);
      } catch (error) {
        console.error('Error in config change listener:', error);
      }
    }
  }

  /**
   * Get specific setting value
   * @param key Setting key
   * @returns Setting value
   */
  get<K extends keyof VirusHuntConfig>(key: K): VirusHuntConfig[K] {
    return this.config[key];
  }

  /**
   * Set specific setting value
   * @param key Setting key
   * @param value Setting value
   */
  async set<K extends keyof VirusHuntConfig>(
    key: K,
    value: VirusHuntConfig[K]
  ): Promise<void> {
    await this.updateConfig({ [key]: value } as Partial<VirusHuntConfig>);
  }

  /**
   * Get all settings as key-value pairs
   * @returns Settings object
   */
  getAllSettings(): Record<string, any> {
    return { ...this.config };
  }
}

// Export singleton instance
export const virusHuntSettings = new VirusHuntSettings();
