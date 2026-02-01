import { promises as fs } from 'fs';
import { join } from 'path';
import { app } from 'electron';
import {
  HashDatabase,
  TorrentsReputationDatabase,
  ReleaseGroupsDatabase,
  FileReputation,
  TorrentReputation,
  ReleaseGroup,
  ReputationStatus,
  ThreatLevel,
  DatabaseVersion
} from '../../../shared/virushunt-types';

/**
 * Service for managing reputation databases
 */
export class ReputationDatabase {
  private hashesDb: HashDatabase | null = null;
  private torrentsDb: TorrentsReputationDatabase | null = null;
  private releaseGroupsDb: ReleaseGroupsDatabase | null = null;
  private dbPath: string;
  private initialized = false;

  constructor() {
    // Store databases in userData directory
    this.dbPath = join(app.getPath('userData'), 'virushunt');
  }

  /**
   * Initialize the database service
   * Creates database directory and loads databases
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Ensure database directory exists
    await fs.mkdir(this.dbPath, { recursive: true });

    // Load all databases
    await Promise.all([
      this.loadHashesDatabase(),
      this.loadTorrentsDatabase(),
      this.loadReleaseGroupsDatabase()
    ]);

    this.initialized = true;
  }

  /**
   * Load hashes database from disk
   */
  private async loadHashesDatabase(): Promise<void> {
    const dbFile = join(this.dbPath, 'hashes.json');

    try {
      const data = await fs.readFile(dbFile, 'utf-8');
      this.hashesDb = JSON.parse(data);
    } catch (error) {
      // If database doesn't exist or is corrupted, create default
      console.warn('Hashes database not found or corrupted, creating default');
      this.hashesDb = this.createDefaultHashesDatabase();
      await this.saveHashesDatabase();
    }
  }

  /**
   * Load torrents reputation database from disk
   */
  private async loadTorrentsDatabase(): Promise<void> {
    const dbFile = join(this.dbPath, 'torrents_reputation.json');

    try {
      const data = await fs.readFile(dbFile, 'utf-8');
      this.torrentsDb = JSON.parse(data);
    } catch (error) {
      console.warn('Torrents database not found or corrupted, creating default');
      this.torrentsDb = this.createDefaultTorrentsDatabase();
      await this.saveTorrentsDatabase();
    }
  }

  /**
   * Load release groups database from disk
   */
  private async loadReleaseGroupsDatabase(): Promise<void> {
    const dbFile = join(this.dbPath, 'known_release_groups.json');

    try {
      const data = await fs.readFile(dbFile, 'utf-8');
      this.releaseGroupsDb = JSON.parse(data);
    } catch (error) {
      console.warn('Release groups database not found or corrupted, creating default');
      this.releaseGroupsDb = this.createDefaultReleaseGroupsDatabase();
      await this.saveReleaseGroupsDatabase();
    }
  }

  /**
   * Save hashes database to disk
   */
  private async saveHashesDatabase(): Promise<void> {
    if (!this.hashesDb) return;

    const dbFile = join(this.dbPath, 'hashes.json');
    const data = JSON.stringify(this.hashesDb, null, 2);
    await fs.writeFile(dbFile, data, 'utf-8');
  }

  /**
   * Save torrents database to disk
   */
  private async saveTorrentsDatabase(): Promise<void> {
    if (!this.torrentsDb) return;

    const dbFile = join(this.dbPath, 'torrents_reputation.json');
    const data = JSON.stringify(this.torrentsDb, null, 2);
    await fs.writeFile(dbFile, data, 'utf-8');
  }

  /**
   * Save release groups database to disk
   */
  private async saveReleaseGroupsDatabase(): Promise<void> {
    if (!this.releaseGroupsDb) return;

    const dbFile = join(this.dbPath, 'known_release_groups.json');
    const data = JSON.stringify(this.releaseGroupsDb, null, 2);
    await fs.writeFile(dbFile, data, 'utf-8');
  }

  /**
   * Check file hash against database
   * @param hash SHA256 hash to check
   * @returns File reputation information
   */
  async checkFileHash(hash: string): Promise<FileReputation> {
    await this.ensureInitialized();

    const normalizedHash = hash.toLowerCase();
    const now = Date.now();

    // Check whitelist first
    if (this.hashesDb!.whitelist[normalizedHash]) {
      const entry = this.hashesDb!.whitelist[normalizedHash];
      return {
        hash: normalizedHash,
        status: ReputationStatus.WHITELISTED,
        size: entry.size || 0,
        fileName: entry.fileName,
        lastUpdated: entry.addedAt,
        source: 'database',
        metadata: {
          verified: true
        }
      };
    }

    // Check blacklist
    if (this.hashesDb!.blacklist[normalizedHash]) {
      const entry = this.hashesDb!.blacklist[normalizedHash];
      return {
        hash: normalizedHash,
        status: ReputationStatus.BLACKLISTED,
        size: 0,
        fileName: entry.fileName,
        lastUpdated: entry.addedAt,
        source: 'database',
        metadata: {}
      };
    }

    // Unknown hash
    return {
      hash: normalizedHash,
      status: ReputationStatus.UNKNOWN,
      size: 0,
      lastUpdated: now,
      source: 'database'
    };
  }

  /**
   * Add hash to whitelist
   * @param hash SHA256 hash
   * @param fileName Optional file name
   * @param size Optional file size
   * @param source Optional source identifier
   */
  async addToWhitelist(
    hash: string,
    fileName?: string,
    size?: number,
    source?: string
  ): Promise<void> {
    await this.ensureInitialized();

    const normalizedHash = hash.toLowerCase();
    
    // Remove from blacklist if present
    delete this.hashesDb!.blacklist[normalizedHash];

    // Add to whitelist
    this.hashesDb!.whitelist[normalizedHash] = {
      fileName,
      size,
      addedAt: Date.now(),
      source
    };

    // Update metadata
    this.hashesDb!.metadata.lastUpdated = Date.now();

    await this.saveHashesDatabase();
  }

  /**
   * Add hash to blacklist
   * @param hash SHA256 hash
   * @param threatType Type of threat
   * @param severity Threat severity
   * @param fileName Optional file name
   * @param description Optional description
   * @param source Optional source identifier
   */
  async addToBlacklist(
    hash: string,
    threatType: string,
    severity: ThreatLevel,
    fileName?: string,
    description?: string,
    source?: string
  ): Promise<void> {
    await this.ensureInitialized();

    const normalizedHash = hash.toLowerCase();
    
    // Remove from whitelist if present
    delete this.hashesDb!.whitelist[normalizedHash];

    // Add to blacklist
    this.hashesDb!.blacklist[normalizedHash] = {
      fileName,
      threatType,
      severity,
      addedAt: Date.now(),
      source,
      description
    };

    // Update metadata
    this.hashesDb!.metadata.lastUpdated = Date.now();

    await this.saveHashesDatabase();
  }

  /**
   * Remove hash from databases
   * @param hash SHA256 hash to remove
   */
  async removeHash(hash: string): Promise<void> {
    await this.ensureInitialized();

    const normalizedHash = hash.toLowerCase();
    
    delete this.hashesDb!.whitelist[normalizedHash];
    delete this.hashesDb!.blacklist[normalizedHash];

    this.hashesDb!.metadata.lastUpdated = Date.now();

    await this.saveHashesDatabase();
  }

  /**
   * Get torrent reputation
   * @param infoHash Torrent info hash
   * @returns Torrent reputation or null if not found
   */
  async getTorrentReputation(infoHash: string): Promise<TorrentReputation | null> {
    await this.ensureInitialized();

    const normalized = infoHash.toLowerCase();
    return this.torrentsDb!.torrents[normalized] || null;
  }

  /**
   * Update torrent reputation
   * @param infoHash Torrent info hash
   * @param reputation Reputation data
   */
  async updateTorrentReputation(
    infoHash: string,
    reputation: Partial<TorrentReputation>
  ): Promise<void> {
    await this.ensureInitialized();

    const normalized = infoHash.toLowerCase();
    const existing = this.torrentsDb!.torrents[normalized];

    this.torrentsDb!.torrents[normalized] = {
      infoHash: normalized,
      score: reputation.score ?? existing?.score ?? 50,
      status: reputation.status ?? existing?.status ?? ReputationStatus.UNKNOWN,
      releaseGroup: reputation.releaseGroup ?? existing?.releaseGroup,
      seeders: reputation.seeders ?? existing?.seeders,
      leechers: reputation.leechers ?? existing?.leechers,
      reports: reputation.reports ?? existing?.reports ?? { safe: 0, suspicious: 0, dangerous: 0 },
      lastVerified: Date.now(),
      notes: reputation.notes ?? existing?.notes
    };

    this.torrentsDb!.metadata.lastUpdated = Date.now();

    await this.saveTorrentsDatabase();
  }

  /**
   * Get release group information
   * @param groupName Release group name
   * @returns Release group info or null if not found
   */
  async getReleaseGroup(groupName: string): Promise<ReleaseGroup | null> {
    await this.ensureInitialized();

    const normalized = groupName.toLowerCase();
    
    // Check exact match
    if (this.releaseGroupsDb!.groups[normalized]) {
      return this.releaseGroupsDb!.groups[normalized];
    }

    // Check aliases
    for (const group of Object.values(this.releaseGroupsDb!.groups)) {
      if (group.aliases.some(alias => alias.toLowerCase() === normalized)) {
        return group;
      }
    }

    return null;
  }

  /**
   * Add or update release group
   * @param groupName Group name
   * @param groupData Group data
   */
  async updateReleaseGroup(
    groupName: string,
    groupData: Partial<ReleaseGroup>
  ): Promise<void> {
    await this.ensureInitialized();

    const normalized = groupName.toLowerCase();
    const existing = this.releaseGroupsDb!.groups[normalized];

    this.releaseGroupsDb!.groups[normalized] = {
      name: groupName,
      aliases: groupData.aliases ?? existing?.aliases ?? [],
      trustLevel: groupData.trustLevel ?? existing?.trustLevel ?? 50,
      verified: groupData.verified ?? existing?.verified ?? false,
      specialization: groupData.specialization ?? existing?.specialization,
      lastActive: groupData.lastActive ?? existing?.lastActive,
      notes: groupData.notes ?? existing?.notes
    };

    this.releaseGroupsDb!.metadata.lastUpdated = Date.now();

    await this.saveReleaseGroupsDatabase();
  }

  /**
   * Get database versions
   * @returns Version information for all databases
   */
  async getDatabaseVersions(): Promise<{
    hashes: DatabaseVersion;
    torrents: DatabaseVersion;
    releaseGroups: DatabaseVersion;
  }> {
    await this.ensureInitialized();

    return {
      hashes: {
        version: this.hashesDb!.metadata.version,
        lastUpdated: this.hashesDb!.metadata.lastUpdated,
        entryCount: Object.keys(this.hashesDb!.whitelist).length + 
                    Object.keys(this.hashesDb!.blacklist).length
      },
      torrents: {
        version: this.torrentsDb!.metadata.version,
        lastUpdated: this.torrentsDb!.metadata.lastUpdated,
        entryCount: Object.keys(this.torrentsDb!.torrents).length
      },
      releaseGroups: {
        version: this.releaseGroupsDb!.metadata.version,
        lastUpdated: this.releaseGroupsDb!.metadata.lastUpdated,
        entryCount: Object.keys(this.releaseGroupsDb!.groups).length
      }
    };
  }

  /**
   * Create default hashes database
   */
  private createDefaultHashesDatabase(): HashDatabase {
    return {
      metadata: {
        version: '1.0.0',
        lastUpdated: Date.now(),
        description: 'VirusHunt file hashes database'
      },
      whitelist: {},
      blacklist: {}
    };
  }

  /**
   * Create default torrents database
   */
  private createDefaultTorrentsDatabase(): TorrentsReputationDatabase {
    return {
      metadata: {
        version: '1.0.0',
        lastUpdated: Date.now(),
        description: 'VirusHunt torrents reputation database'
      },
      torrents: {}
    };
  }

  /**
   * Create default release groups database
   */
  private createDefaultReleaseGroupsDatabase(): ReleaseGroupsDatabase {
    return {
      metadata: {
        version: '1.0.0',
        lastUpdated: Date.now(),
        description: 'VirusHunt known release groups database'
      },
      groups: {
        // Add some well-known trusted groups
        'yts': {
          name: 'YTS',
          aliases: ['YIFY', 'YTS.MX', 'YTS.LT'],
          trustLevel: 90,
          verified: true,
          specialization: ['movies'],
          notes: 'Well-known movie release group'
        },
        'rarbg': {
          name: 'RARBG',
          aliases: ['RARBG'],
          trustLevel: 85,
          verified: true,
          specialization: ['movies', 'tv', 'games'],
          notes: 'Popular multi-category release group'
        },
        'fitgirl': {
          name: 'FitGirl',
          aliases: ['FitGirl Repacks'],
          trustLevel: 95,
          verified: true,
          specialization: ['games'],
          notes: 'Trusted game repack group'
        }
      }
    };
  }

  /**
   * Ensure database is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Export database to JSON file
   * @param type Database type to export
   * @param outputPath Output file path
   */
  async exportDatabase(
    type: 'hashes' | 'torrents' | 'releaseGroups',
    outputPath: string
  ): Promise<void> {
    await this.ensureInitialized();

    let data: any;
    switch (type) {
      case 'hashes':
        data = this.hashesDb;
        break;
      case 'torrents':
        data = this.torrentsDb;
        break;
      case 'releaseGroups':
        data = this.releaseGroupsDb;
        break;
    }

    await fs.writeFile(outputPath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * Import database from JSON file
   * @param type Database type to import
   * @param inputPath Input file path
   */
  async importDatabase(
    type: 'hashes' | 'torrents' | 'releaseGroups',
    inputPath: string
  ): Promise<void> {
    const data = await fs.readFile(inputPath, 'utf-8');
    const parsed = JSON.parse(data);

    switch (type) {
      case 'hashes':
        this.hashesDb = parsed;
        await this.saveHashesDatabase();
        break;
      case 'torrents':
        this.torrentsDb = parsed;
        await this.saveTorrentsDatabase();
        break;
      case 'releaseGroups':
        this.releaseGroupsDb = parsed;
        await this.saveReleaseGroupsDatabase();
        break;
    }
  }
}

// Export singleton instance
export const reputationDatabase = new ReputationDatabase();
