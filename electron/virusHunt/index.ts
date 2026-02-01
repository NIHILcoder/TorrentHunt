/**
 * VirusHunt Main Module
 * 
 * Coordinates reputation database, scanning, and IPC integration.
 */

import { ReputationDatabase, getReputationDatabase } from './reputation-db';
import {
  WhitelistEntry,
  BlacklistEntry,
  TorrentReputation,
  ReleaseGroup,
  ReputationResult,
  TorrentReputationResult,
  DatabaseStats,
} from '../../shared/virushunt-reputation-types';

export class VirusHunt {
  private reputationDb: ReputationDatabase;
  private initialized: boolean = false;

  constructor() {
    this.reputationDb = getReputationDatabase();
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('[VirusHunt] Already initialized');
      return;
    }

    try {
      await this.reputationDb.initialize();
      this.initialized = true;
      console.log('[VirusHunt] Initialized successfully');
    } catch (error) {
      console.error('[VirusHunt] Initialization failed:', error);
      throw error;
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  // ============================================================================
  // Hash Reputation
  // ============================================================================

  checkFileHash(hash: string): ReputationResult {
    this.ensureInitialized();
    return this.reputationDb.checkFileHash(hash);
  }

  async addToWhitelist(
    hash: string,
    fileName?: string,
    size?: number,
    source?: string
  ): Promise<void> {
    this.ensureInitialized();
    
    await this.reputationDb.addToWhitelist({
      hash,
      name: fileName || 'Unknown',
      size: size || 0,
      verified_by: 'user',
      source,
    });
  }

  async addToBlacklist(
    hash: string,
    threatType: 'malware' | 'trojan' | 'miner' | 'ransomware' | 'keylogger' | 'backdoor' | 'adware' | 'pup',
    fileName?: string,
    description?: string
  ): Promise<void> {
    this.ensureInitialized();
    
    await this.reputationDb.addToBlacklist({
      hash,
      name: fileName || 'Unknown',
      threat_type: threatType,
      severity: this.mapThreatToSeverity(threatType),
      verified_by: 'user',
      description,
    });
  }

  async removeHash(hash: string): Promise<boolean> {
    this.ensureInitialized();
    return this.reputationDb.removeHash(hash);
  }

  private mapThreatToSeverity(threatType: string): 'low' | 'medium' | 'high' | 'critical' {
    switch (threatType) {
      case 'ransomware':
      case 'backdoor':
        return 'critical';
      case 'malware':
      case 'trojan':
      case 'miner':
      case 'keylogger':
        return 'high';
      case 'adware':
        return 'medium';
      case 'pup':
        return 'low';
      default:
        return 'medium';
    }
  }

  // ============================================================================
  // Torrent Reputation
  // ============================================================================

  checkTorrentReputation(infoHash: string): TorrentReputationResult {
    this.ensureInitialized();
    return this.reputationDb.checkTorrentReputation(infoHash);
  }

  async updateTorrentReputation(
    infoHash: string,
    data: Partial<TorrentReputation>
  ): Promise<void> {
    this.ensureInitialized();
    await this.reputationDb.updateTorrentReputation(infoHash, data);
  }

  async removeTorrentReputation(infoHash: string): Promise<boolean> {
    this.ensureInitialized();
    return this.reputationDb.removeTorrentReputation(infoHash);
  }

  // ============================================================================
  // Release Groups
  // ============================================================================

  checkReleaseGroup(text: string): ReleaseGroup | null {
    this.ensureInitialized();
    return this.reputationDb.checkReleaseGroup(text);
  }

  async addReleaseGroup(group: Omit<ReleaseGroup, 'added_at' | 'last_seen'>): Promise<void> {
    this.ensureInitialized();
    await this.reputationDb.addReleaseGroup(group);
  }

  async updateReleaseGroup(name: string, updates: Partial<ReleaseGroup>): Promise<boolean> {
    this.ensureInitialized();
    return this.reputationDb.updateReleaseGroup(name, updates);
  }

  async removeReleaseGroup(name: string): Promise<boolean> {
    this.ensureInitialized();
    return this.reputationDb.removeReleaseGroup(name);
  }

  getReleaseGroups(): ReleaseGroup[] {
    this.ensureInitialized();
    return this.reputationDb.getReleaseGroups();
  }

  // ============================================================================
  // Pattern Matching
  // ============================================================================

  checkPatterns(data: {
    urls?: string[];
    apis?: string[];
    strings?: string[];
    registryKeys?: string[];
  }) {
    this.ensureInitialized();
    return this.reputationDb.checkPatterns(data);
  }

  // ============================================================================
  // Statistics
  // ============================================================================

  getStats(): DatabaseStats {
    this.ensureInitialized();
    return this.reputationDb.getStats();
  }

  // ============================================================================
  // Import/Export
  // ============================================================================

  async exportDatabase(
    type: 'hashes' | 'torrents' | 'release-groups' | 'patterns',
    outputPath: string
  ): Promise<void> {
    this.ensureInitialized();
    await this.reputationDb.exportDatabase(type, outputPath);
  }

  async importDatabase(
    type: 'hashes' | 'torrents' | 'release-groups' | 'patterns',
    inputPath: string
  ) {
    this.ensureInitialized();
    return this.reputationDb.importDatabase(type, inputPath);
  }

  // ============================================================================
  // Configuration
  // ============================================================================

  getConfig() {
    return {
      enabled: true,
      autoScan: false,
      sensitivity: 50,
      quarantinePath: '',
    };
  }

  async updateConfig(updates: any) {
    // Config is stored in electron-store, implement if needed
    console.log('[VirusHunt] Config update:', updates);
  }

  async resetConfig() {
    console.log('[VirusHunt] Config reset');
  }

  getDatabaseVersions() {
    this.ensureInitialized();
    return this.reputationDb.getDatabaseVersions();
  }

  setEnabled(enabled: boolean) {
    console.log('[VirusHunt] Set enabled:', enabled);
  }

  isEnabled() {
    return true;
  }

  getActiveScans(): string[] {
    return [];
  }

  isScanActive(scanId: string): boolean {
    return false;
  }

  async exportConfig(outputPath: string) {
    console.log('[VirusHunt] Export config to:', outputPath);
  }

  async importConfig(inputPath: string) {
    console.log('[VirusHunt] Import config from:', inputPath);
  }

  getQuarantinePath(): string {
    return '';
  }

  async setQuarantinePath(path: string) {
    console.log('[VirusHunt] Set quarantine path:', path);
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('VirusHunt not initialized. Call initialize() first.');
    }
  }
}

// Singleton instance
let virusHuntInstance: VirusHunt | null = null;

export function getVirusHunt(): VirusHunt {
  if (!virusHuntInstance) {
    virusHuntInstance = new VirusHunt();
  }
  return virusHuntInstance;
}
