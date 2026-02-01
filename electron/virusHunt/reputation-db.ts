/**
 * VirusHunt Reputation Database
 * 
 * Manages JSON-based reputation databases for files, torrents, release groups,
 * and malicious patterns. Stored in userData/virusHunt/ directory.
 */

import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import {
  HashesDatabase,
  TorrentsReputationDatabase,
  ReleaseGroupsDatabase,
  MaliciousPatternsDatabase,
  WhitelistEntry,
  BlacklistEntry,
  TorrentReputation,
  ReleaseGroup,
  MaliciousPattern,
  ReputationResult,
  TorrentReputationResult,
  PatternMatchResult,
  DatabaseStats,
  DatabaseImportResult,
} from '../../shared/virushunt-reputation-types';

const DB_VERSION = '1.0.0';

export class ReputationDatabase {
  private dbPath: string;
  private hashesDb: HashesDatabase;
  private torrentsDb: TorrentsReputationDatabase;
  private releaseGroupsDb: ReleaseGroupsDatabase;
  private patternsDb: MaliciousPatternsDatabase;
  private loaded: boolean = false;

  constructor() {
    this.dbPath = path.join(app.getPath('userData'), 'virusHunt');
    this.hashesDb = this.createEmptyHashesDb();
    this.torrentsDb = this.createEmptyTorrentsDb();
    this.releaseGroupsDb = this.createEmptyReleaseGroupsDb();
    this.patternsDb = this.createEmptyPatternsDb();
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  async initialize(): Promise<void> {
    try {
      // Ensure database directory exists
      await fs.mkdir(this.dbPath, { recursive: true });
      
      // Load all databases
      await this.load();
      
      console.log('[ReputationDB] Initialized successfully');
    } catch (error) {
      console.error('[ReputationDB] Initialization failed:', error);
      throw error;
    }
  }

  async load(): Promise<void> {
    try {
      await Promise.all([
        this.loadHashesDb(),
        this.loadTorrentsDb(),
        this.loadReleaseGroupsDb(),
        this.loadPatternsDb(),
      ]);

      this.loaded = true;
      console.log('[ReputationDB] All databases loaded');
    } catch (error) {
      console.error('[ReputationDB] Load failed:', error);
      throw error;
    }
  }

  async save(): Promise<void> {
    if (!this.loaded) {
      console.warn('[ReputationDB] Cannot save - not loaded');
      return;
    }

    try {
      await Promise.all([
        this.saveHashesDb(),
        this.saveTorrentsDb(),
        this.saveReleaseGroupsDb(),
        this.savePatternsDb(),
      ]);

      console.log('[ReputationDB] All databases saved');
    } catch (error) {
      console.error('[ReputationDB] Save failed:', error);
      throw error;
    }
  }

  // ============================================================================
  // Hashes Database
  // ============================================================================

  private async loadHashesDb(): Promise<void> {
    const filePath = path.join(this.dbPath, 'hashes.json');
    
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(data) as HashesDatabase;

      // Check version compatibility
      if (parsed.version !== DB_VERSION) {
        console.warn(`[ReputationDB] Hashes DB version mismatch: ${parsed.version} -> ${DB_VERSION}`);
        // Migrate if needed
        this.hashesDb = await this.migrateHashesDb(parsed);
      } else {
        this.hashesDb = parsed;
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.log('[ReputationDB] Creating new hashes.json');
        this.hashesDb = this.createEmptyHashesDb();
        await this.saveHashesDb();
      } else {
        throw error;
      }
    }
  }

  private async saveHashesDb(): Promise<void> {
    const filePath = path.join(this.dbPath, 'hashes.json');
    this.hashesDb.last_updated = new Date().toISOString();
    await fs.writeFile(filePath, JSON.stringify(this.hashesDb, null, 2), 'utf-8');
  }

  private createEmptyHashesDb(): HashesDatabase {
    return {
      version: DB_VERSION,
      last_updated: new Date().toISOString(),
      whitelist: {},
      blacklist: {},
    };
  }

  private async migrateHashesDb(old: HashesDatabase): Promise<HashesDatabase> {
    // Simple migration: copy data and update version
    return {
      ...old,
      version: DB_VERSION,
      last_updated: new Date().toISOString(),
    };
  }

  // ============================================================================
  // Torrents Database
  // ============================================================================

  private async loadTorrentsDb(): Promise<void> {
    const filePath = path.join(this.dbPath, 'torrents_reputation.json');
    
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(data) as TorrentsReputationDatabase;

      if (parsed.version !== DB_VERSION) {
        console.warn(`[ReputationDB] Torrents DB version mismatch: ${parsed.version} -> ${DB_VERSION}`);
        this.torrentsDb = await this.migrateTorrentsDb(parsed);
      } else {
        this.torrentsDb = parsed;
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.log('[ReputationDB] Creating new torrents_reputation.json');
        this.torrentsDb = this.createEmptyTorrentsDb();
        await this.saveTorrentsDb();
      } else {
        throw error;
      }
    }
  }

  private async saveTorrentsDb(): Promise<void> {
    const filePath = path.join(this.dbPath, 'torrents_reputation.json');
    this.torrentsDb.last_updated = new Date().toISOString();
    await fs.writeFile(filePath, JSON.stringify(this.torrentsDb, null, 2), 'utf-8');
  }

  private createEmptyTorrentsDb(): TorrentsReputationDatabase {
    return {
      version: DB_VERSION,
      last_updated: new Date().toISOString(),
      torrents: {},
    };
  }

  private async migrateTorrentsDb(old: TorrentsReputationDatabase): Promise<TorrentsReputationDatabase> {
    return {
      ...old,
      version: DB_VERSION,
      last_updated: new Date().toISOString(),
    };
  }

  // ============================================================================
  // Release Groups Database
  // ============================================================================

  private async loadReleaseGroupsDb(): Promise<void> {
    const filePath = path.join(this.dbPath, 'known_release_groups.json');
    
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(data) as ReleaseGroupsDatabase;

      if (parsed.version !== DB_VERSION) {
        console.warn(`[ReputationDB] Release groups DB version mismatch: ${parsed.version} -> ${DB_VERSION}`);
        this.releaseGroupsDb = await this.migrateReleaseGroupsDb(parsed);
      } else {
        this.releaseGroupsDb = parsed;
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.log('[ReputationDB] Creating new known_release_groups.json');
        this.releaseGroupsDb = this.createEmptyReleaseGroupsDb();
        await this.saveReleaseGroupsDb();
      } else {
        throw error;
      }
    }
  }

  private async saveReleaseGroupsDb(): Promise<void> {
    const filePath = path.join(this.dbPath, 'known_release_groups.json');
    this.releaseGroupsDb.last_updated = new Date().toISOString();
    await fs.writeFile(filePath, JSON.stringify(this.releaseGroupsDb, null, 2), 'utf-8');
  }

  private createEmptyReleaseGroupsDb(): ReleaseGroupsDatabase {
    return {
      version: DB_VERSION,
      last_updated: new Date().toISOString(),
      groups: this.getDefaultReleaseGroups(),
    };
  }

  private async migrateReleaseGroupsDb(old: ReleaseGroupsDatabase): Promise<ReleaseGroupsDatabase> {
    return {
      ...old,
      version: DB_VERSION,
      last_updated: new Date().toISOString(),
    };
  }

  private getDefaultReleaseGroups(): ReleaseGroup[] {
    return [
      {
        name: 'CODEX',
        trust_level: 'trusted',
        patterns: ['\\bCODEX\\b', '-CODEX', '\\[CODEX\\]'],
        verified: true,
        clean_releases: 0,
        malicious_releases: 0,
        added_at: new Date().toISOString(),
        last_seen: new Date().toISOString(),
        notes: 'Well-known game release group',
      },
      {
        name: 'SKIDROW',
        trust_level: 'verified',
        patterns: ['\\bSKIDROW\\b', '-SKIDROW', '\\[SKIDROW\\]'],
        verified: true,
        clean_releases: 0,
        malicious_releases: 0,
        added_at: new Date().toISOString(),
        last_seen: new Date().toISOString(),
        notes: 'Long-standing game cracking group',
      },
      {
        name: 'FitGirl',
        trust_level: 'trusted',
        patterns: ['\\bFitGirl\\b', 'FitGirl Repack', '\\[FitGirl\\]'],
        verified: true,
        clean_releases: 0,
        malicious_releases: 0,
        added_at: new Date().toISOString(),
        last_seen: new Date().toISOString(),
        notes: 'Popular game repack group',
      },
    ];
  }

  // ============================================================================
  // Malicious Patterns Database
  // ============================================================================

  private async loadPatternsDb(): Promise<void> {
    const filePath = path.join(this.dbPath, 'malicious_patterns.json');
    
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(data) as MaliciousPatternsDatabase;

      if (parsed.version !== DB_VERSION) {
        console.warn(`[ReputationDB] Patterns DB version mismatch: ${parsed.version} -> ${DB_VERSION}`);
        this.patternsDb = await this.migratePatternsDb(parsed);
      } else {
        this.patternsDb = parsed;
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.log('[ReputationDB] Creating new malicious_patterns.json');
        this.patternsDb = this.createEmptyPatternsDb();
        await this.savePatternsDb();
      } else {
        throw error;
      }
    }
  }

  private async savePatternsDb(): Promise<void> {
    const filePath = path.join(this.dbPath, 'malicious_patterns.json');
    this.patternsDb.last_updated = new Date().toISOString();
    await fs.writeFile(filePath, JSON.stringify(this.patternsDb, null, 2), 'utf-8');
  }

  private createEmptyPatternsDb(): MaliciousPatternsDatabase {
    return {
      version: DB_VERSION,
      last_updated: new Date().toISOString(),
      mining_pools: this.getDefaultMiningPatterns(),
      c2_domains: this.getDefaultC2Patterns(),
      suspicious_apis: this.getDefaultApiPatterns(),
      malware_strings: this.getDefaultStringPatterns(),
      registry_keys: this.getDefaultRegistryPatterns(),
    };
  }

  private async migratePatternsDb(old: MaliciousPatternsDatabase): Promise<MaliciousPatternsDatabase> {
    return {
      ...old,
      version: DB_VERSION,
      last_updated: new Date().toISOString(),
    };
  }

  private getDefaultMiningPatterns(): MaliciousPattern[] {
    return [
      {
        type: 'url',
        pattern: '(pool\\.)?[\\w-]+\\.moneroocean\\.stream',
        category: 'mining',
        severity: 'high',
        description: 'MoneroOcean mining pool connection',
        is_regex: true,
      },
      {
        type: 'url',
        pattern: '[\\w-]+\\.nanopool\\.org',
        category: 'mining',
        severity: 'high',
        description: 'Nanopool mining pool connection',
        is_regex: true,
      },
      {
        type: 'url',
        pattern: 'xmr.*\\.minergate\\.com',
        category: 'mining',
        severity: 'high',
        description: 'MinerGate XMR pool',
        is_regex: true,
      },
    ];
  }

  private getDefaultC2Patterns(): MaliciousPattern[] {
    return [
      {
        type: 'domain',
        pattern: '\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}:[0-9]{4,5}',
        category: 'c2',
        severity: 'critical',
        description: 'Direct IP:Port connection (C2 indicator)',
        is_regex: true,
      },
      {
        type: 'domain',
        pattern: '[a-z0-9]{32,}\\.onion',
        category: 'c2',
        severity: 'medium',
        description: 'Tor hidden service connection',
        is_regex: true,
      },
    ];
  }

  private getDefaultApiPatterns(): MaliciousPattern[] {
    return [
      {
        type: 'api',
        pattern: 'CreateRemoteThread',
        category: 'backdoor',
        severity: 'high',
        description: 'Process injection API (code injection)',
        is_regex: false,
      },
      {
        type: 'api',
        pattern: 'WriteProcessMemory',
        category: 'backdoor',
        severity: 'high',
        description: 'Memory writing API (code injection)',
        is_regex: false,
      },
      {
        type: 'api',
        pattern: 'SetWindowsHookEx',
        category: 'keylogger',
        severity: 'high',
        description: 'Keyboard hook API (keylogger)',
        is_regex: false,
      },
    ];
  }

  private getDefaultStringPatterns(): MaliciousPattern[] {
    return [
      {
        type: 'string',
        pattern: 'xmrig',
        category: 'mining',
        severity: 'critical',
        description: 'XMRig cryptocurrency miner',
        is_regex: false,
      },
      {
        type: 'string',
        pattern: 'stratum\\+tcp://',
        category: 'mining',
        severity: 'high',
        description: 'Mining pool connection string',
        is_regex: false,
      },
    ];
  }

  private getDefaultRegistryPatterns(): MaliciousPattern[] {
    return [
      {
        type: 'registry',
        pattern: 'HKEY_CURRENT_USER\\\\Software\\\\Microsoft\\\\Windows\\\\CurrentVersion\\\\Run',
        category: 'backdoor',
        severity: 'medium',
        description: 'Startup persistence registry key',
        is_regex: false,
      },
    ];
  }

  // ============================================================================
  // Hash Reputation Methods
  // ============================================================================

  checkFileHash(hash: string): ReputationResult {
    // Check whitelist first
    if (this.hashesDb.whitelist[hash]) {
      return {
        status: 'whitelisted',
        entry: this.hashesDb.whitelist[hash],
        confidence: 95,
        source: 'local',
      };
    }

    // Check blacklist
    if (this.hashesDb.blacklist[hash]) {
      return {
        status: 'blacklisted',
        entry: this.hashesDb.blacklist[hash],
        confidence: 90,
        source: 'local',
      };
    }

    return {
      status: 'unknown',
      confidence: 0,
      source: 'local',
    };
  }

  async addToWhitelist(entry: Omit<WhitelistEntry, 'added_at' | 'last_check'>): Promise<void> {
    const fullEntry: WhitelistEntry = {
      ...entry,
      added_at: new Date().toISOString(),
      last_check: new Date().toISOString(),
    };

    // Remove from blacklist if present
    delete this.hashesDb.blacklist[entry.hash];

    this.hashesDb.whitelist[entry.hash] = fullEntry;
    await this.saveHashesDb();

    console.log(`[ReputationDB] Added to whitelist: ${entry.hash}`);
  }

  async addToBlacklist(entry: Omit<BlacklistEntry, 'added_at' | 'last_check'>): Promise<void> {
    const fullEntry: BlacklistEntry = {
      ...entry,
      added_at: new Date().toISOString(),
      last_check: new Date().toISOString(),
    };

    // Remove from whitelist if present
    delete this.hashesDb.whitelist[entry.hash];

    this.hashesDb.blacklist[entry.hash] = fullEntry;
    await this.saveHashesDb();

    console.log(`[ReputationDB] Added to blacklist: ${entry.hash}`);
  }

  async removeHash(hash: string): Promise<boolean> {
    const removedFromWhitelist = delete this.hashesDb.whitelist[hash];
    const removedFromBlacklist = delete this.hashesDb.blacklist[hash];

    if (removedFromWhitelist || removedFromBlacklist) {
      await this.saveHashesDb();
      console.log(`[ReputationDB] Removed hash: ${hash}`);
      return true;
    }

    return false;
  }

  getWhitelistCount(): number {
    return Object.keys(this.hashesDb.whitelist).length;
  }

  getBlacklistCount(): number {
    return Object.keys(this.hashesDb.blacklist).length;
  }

  // ============================================================================
  // Torrent Reputation Methods
  // ============================================================================

  checkTorrentReputation(infohash: string): TorrentReputationResult {
    const reputation = this.torrentsDb.torrents[infohash];

    if (!reputation) {
      return {
        status: 'unknown',
        trust_score: 50,
        details: 'No reputation data available',
      };
    }

    // Calculate status based on reports
    const totalReports = reputation.clean_reports + reputation.malware_reports + reputation.suspicious_reports;
    
    if (totalReports === 0) {
      return {
        status: 'unknown',
        reputation,
        trust_score: reputation.trust_score,
        details: 'No community reports',
      };
    }

    const malwareRatio = reputation.malware_reports / totalReports;
    const suspiciousRatio = reputation.suspicious_reports / totalReports;

    if (malwareRatio > 0.3) {
      return {
        status: 'dangerous',
        reputation,
        trust_score: reputation.trust_score,
        details: `${reputation.malware_reports} malware reports out of ${totalReports}`,
      };
    }

    if (suspiciousRatio > 0.4 || malwareRatio > 0.1) {
      return {
        status: 'suspicious',
        reputation,
        trust_score: reputation.trust_score,
        details: `${reputation.suspicious_reports} suspicious reports, ${reputation.malware_reports} malware reports`,
      };
    }

    return {
      status: 'trusted',
      reputation,
      trust_score: reputation.trust_score,
      details: `${reputation.clean_reports} clean reports out of ${totalReports}`,
    };
  }

  async updateTorrentReputation(infohash: string, data: Partial<TorrentReputation>): Promise<void> {
    const existing = this.torrentsDb.torrents[infohash];

    if (existing) {
      this.torrentsDb.torrents[infohash] = {
        ...existing,
        ...data,
        last_updated: new Date().toISOString(),
      };
    } else {
      this.torrentsDb.torrents[infohash] = {
        infohash,
        clean_reports: 0,
        malware_reports: 0,
        suspicious_reports: 0,
        files_checked: 0,
        total_files: 0,
        trust_score: 50,
        verified: false,
        last_updated: new Date().toISOString(),
        ...data,
      };
    }

    await this.saveTorrentsDb();
    console.log(`[ReputationDB] Updated torrent reputation: ${infohash}`);
  }

  async removeTorrentReputation(infohash: string): Promise<boolean> {
    if (this.torrentsDb.torrents[infohash]) {
      delete this.torrentsDb.torrents[infohash];
      await this.saveTorrentsDb();
      console.log(`[ReputationDB] Removed torrent reputation: ${infohash}`);
      return true;
    }
    return false;
  }

  getTorrentCount(): number {
    return Object.keys(this.torrentsDb.torrents).length;
  }

  // ============================================================================
  // Release Group Methods
  // ============================================================================

  checkReleaseGroup(text: string): ReleaseGroup | null {
    for (const group of this.releaseGroupsDb.groups) {
      for (const pattern of group.patterns) {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(text)) {
          return group;
        }
      }
    }
    return null;
  }

  async addReleaseGroup(group: Omit<ReleaseGroup, 'added_at' | 'last_seen'>): Promise<void> {
    const fullGroup: ReleaseGroup = {
      ...group,
      added_at: new Date().toISOString(),
      last_seen: new Date().toISOString(),
    };

    this.releaseGroupsDb.groups.push(fullGroup);
    await this.saveReleaseGroupsDb();

    console.log(`[ReputationDB] Added release group: ${group.name}`);
  }

  async updateReleaseGroup(name: string, updates: Partial<ReleaseGroup>): Promise<boolean> {
    const index = this.releaseGroupsDb.groups.findIndex(g => g.name === name);
    
    if (index !== -1) {
      this.releaseGroupsDb.groups[index] = {
        ...this.releaseGroupsDb.groups[index],
        ...updates,
        last_seen: new Date().toISOString(),
      };
      
      await this.saveReleaseGroupsDb();
      console.log(`[ReputationDB] Updated release group: ${name}`);
      return true;
    }

    return false;
  }

  async removeReleaseGroup(name: string): Promise<boolean> {
    const index = this.releaseGroupsDb.groups.findIndex(g => g.name === name);
    
    if (index !== -1) {
      this.releaseGroupsDb.groups.splice(index, 1);
      await this.saveReleaseGroupsDb();
      console.log(`[ReputationDB] Removed release group: ${name}`);
      return true;
    }

    return false;
  }

  getReleaseGroups(): ReleaseGroup[] {
    return [...this.releaseGroupsDb.groups];
  }

  // ============================================================================
  // Pattern Matching Methods
  // ============================================================================

  checkPatterns(data: { urls?: string[]; apis?: string[]; strings?: string[]; registryKeys?: string[] }): PatternMatchResult {
    const matchedPatterns: MaliciousPattern[] = [];
    const details: string[] = [];

    // Check mining pools
    if (data.urls) {
      for (const url of data.urls) {
        for (const pattern of this.patternsDb.mining_pools) {
          if (this.matchPattern(url, pattern)) {
            matchedPatterns.push(pattern);
            details.push(`Mining pool detected: ${url} matches ${pattern.description}`);
          }
        }
      }
    }

    // Check C2 domains
    if (data.urls) {
      for (const url of data.urls) {
        for (const pattern of this.patternsDb.c2_domains) {
          if (this.matchPattern(url, pattern)) {
            matchedPatterns.push(pattern);
            details.push(`C2 domain detected: ${url} matches ${pattern.description}`);
          }
        }
      }
    }

    // Check suspicious APIs
    if (data.apis) {
      for (const api of data.apis) {
        for (const pattern of this.patternsDb.suspicious_apis) {
          if (this.matchPattern(api, pattern)) {
            matchedPatterns.push(pattern);
            details.push(`Suspicious API: ${api} - ${pattern.description}`);
          }
        }
      }
    }

    // Check malware strings
    if (data.strings) {
      for (const str of data.strings) {
        for (const pattern of this.patternsDb.malware_strings) {
          if (this.matchPattern(str, pattern)) {
            matchedPatterns.push(pattern);
            details.push(`Malware string detected: ${str} matches ${pattern.description}`);
          }
        }
      }
    }

    // Determine overall severity
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (matchedPatterns.some(p => p.severity === 'critical')) {
      severity = 'critical';
    } else if (matchedPatterns.some(p => p.severity === 'high')) {
      severity = 'high';
    } else if (matchedPatterns.some(p => p.severity === 'medium')) {
      severity = 'medium';
    }

    return {
      matched: matchedPatterns.length > 0,
      patterns: matchedPatterns,
      category: matchedPatterns[0]?.category || 'unknown',
      severity,
      details,
    };
  }

  private matchPattern(text: string, pattern: MaliciousPattern): boolean {
    if (pattern.is_regex) {
      const regex = new RegExp(pattern.pattern, 'i');
      return regex.test(text);
    } else {
      return text.toLowerCase().includes(pattern.pattern.toLowerCase());
    }
  }

  // ============================================================================
  // Statistics
  // ============================================================================

  getStats(): DatabaseStats {
    const torrents = Object.values(this.torrentsDb.torrents);
    const trustedTorrents = torrents.filter(t => t.trust_score >= 70).length;
    const suspiciousTorrents = torrents.filter(t => t.trust_score < 70 && t.trust_score >= 40).length;
    const dangerousTorrents = torrents.filter(t => t.trust_score < 40).length;

    const groups = this.releaseGroupsDb.groups;
    const trustedGroups = groups.filter(g => g.trust_level === 'trusted').length;
    const verifiedGroups = groups.filter(g => g.verified).length;
    const blacklistedGroups = groups.filter(g => g.trust_level === 'blacklisted').length;

    return {
      hashes: {
        whitelist_count: this.getWhitelistCount(),
        blacklist_count: this.getBlacklistCount(),
        version: this.hashesDb.version,
        last_updated: this.hashesDb.last_updated,
      },
      torrents: {
        total_count: this.getTorrentCount(),
        trusted_count: trustedTorrents,
        suspicious_count: suspiciousTorrents,
        dangerous_count: dangerousTorrents,
        version: this.torrentsDb.version,
        last_updated: this.torrentsDb.last_updated,
      },
      release_groups: {
        total_count: groups.length,
        trusted_count: trustedGroups,
        verified_count: verifiedGroups,
        blacklisted_count: blacklistedGroups,
        version: this.releaseGroupsDb.version,
        last_updated: this.releaseGroupsDb.last_updated,
      },
      patterns: {
        total_count: 
          this.patternsDb.mining_pools.length +
          this.patternsDb.c2_domains.length +
          this.patternsDb.suspicious_apis.length +
          this.patternsDb.malware_strings.length +
          this.patternsDb.registry_keys.length,
        mining_count: this.patternsDb.mining_pools.length,
        c2_count: this.patternsDb.c2_domains.length,
        api_count: this.patternsDb.suspicious_apis.length,
        version: this.patternsDb.version,
        last_updated: this.patternsDb.last_updated,
      },
    };
  }

  // ============================================================================
  // Import/Export
  // ============================================================================

  getDatabaseVersions() {
    return {
      hashes: this.hashesDb.version,
      torrents: this.torrentsDb.version,
      releaseGroups: this.releaseGroupsDb.version,
      patterns: this.patternsDb.version,
    };
  }

  async exportDatabase(type: 'hashes' | 'torrents' | 'release-groups' | 'patterns', outputPath: string): Promise<void> {
    let data: any;

    switch (type) {
      case 'hashes':
        data = this.hashesDb;
        break;
      case 'torrents':
        data = this.torrentsDb;
        break;
      case 'release-groups':
        data = this.releaseGroupsDb;
        break;
      case 'patterns':
        data = this.patternsDb;
        break;
    }

    await fs.writeFile(outputPath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`[ReputationDB] Exported ${type} to ${outputPath}`);
  }

  async importDatabase(type: 'hashes' | 'torrents' | 'release-groups' | 'patterns', inputPath: string): Promise<DatabaseImportResult> {
    try {
      const data = await fs.readFile(inputPath, 'utf-8');
      const parsed = JSON.parse(data);

      let imported = 0;
      let skipped = 0;
      const errors: string[] = [];

      switch (type) {
        case 'hashes':
          if (parsed.whitelist) {
            for (const [hash, entry] of Object.entries(parsed.whitelist)) {
              this.hashesDb.whitelist[hash] = entry as WhitelistEntry;
              imported++;
            }
          }
          if (parsed.blacklist) {
            for (const [hash, entry] of Object.entries(parsed.blacklist)) {
              this.hashesDb.blacklist[hash] = entry as BlacklistEntry;
              imported++;
            }
          }
          await this.saveHashesDb();
          break;

        case 'torrents':
          if (parsed.torrents) {
            for (const [infohash, reputation] of Object.entries(parsed.torrents)) {
              this.torrentsDb.torrents[infohash] = reputation as TorrentReputation;
              imported++;
            }
          }
          await this.saveTorrentsDb();
          break;

        case 'release-groups':
          if (parsed.groups && Array.isArray(parsed.groups)) {
            for (const group of parsed.groups) {
              // Check if already exists
              const exists = this.releaseGroupsDb.groups.some(g => g.name === group.name);
              if (!exists) {
                this.releaseGroupsDb.groups.push(group as ReleaseGroup);
                imported++;
              } else {
                skipped++;
              }
            }
          }
          await this.saveReleaseGroupsDb();
          break;

        case 'patterns':
          // Merge patterns
          if (parsed.mining_pools) {
            this.patternsDb.mining_pools.push(...parsed.mining_pools);
            imported += parsed.mining_pools.length;
          }
          if (parsed.c2_domains) {
            this.patternsDb.c2_domains.push(...parsed.c2_domains);
            imported += parsed.c2_domains.length;
          }
          if (parsed.suspicious_apis) {
            this.patternsDb.suspicious_apis.push(...parsed.suspicious_apis);
            imported += parsed.suspicious_apis.length;
          }
          await this.savePatternsDb();
          break;
      }

      console.log(`[ReputationDB] Imported ${imported} entries from ${inputPath}`);

      return {
        success: true,
        imported_count: imported,
        skipped_count: skipped,
        errors,
        warnings: [],
      };
    } catch (error: any) {
      console.error(`[ReputationDB] Import failed:`, error);
      return {
        success: false,
        imported_count: 0,
        skipped_count: 0,
        errors: [error.message],
        warnings: [],
      };
    }
  }
}

// Singleton instance
let reputationDbInstance: ReputationDatabase | null = null;

export function getReputationDatabase(): ReputationDatabase {
  if (!reputationDbInstance) {
    reputationDbInstance = new ReputationDatabase();
  }
  return reputationDbInstance;
}
