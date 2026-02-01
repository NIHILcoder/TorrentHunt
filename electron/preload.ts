import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import {
  AddDownloadRequest,
  Download,
  DownloadStats,
  AppSettings,
  CatalogEntry,
  Category,
  SchedulerConfig,
  IpcApi,
  CreateTorrentRequest,
  CreateTorrentResult,
  CreateTorrentProgress,
  PrivacyConfig,
} from '../shared/types';
import {
  ScanOptions,
  ScanResult,
  FileReputation,
  VirusHuntConfig,
  TorrentReputation,
  ReleaseGroup,
  ScanProgress,
  DatabaseVersion
} from '../shared/virushunt-types';
import { 
  VirusHuntSettings, 
  SettingsValidationResult,
  SettingsUpdateResult
} from '../shared/virushunt-settings-types';

const api: IpcApi = {
  // Downloads
  addDownload: (request: AddDownloadRequest): Promise<Download> => {
    return ipcRenderer.invoke('downloads:add', request);
  },

  pauseDownload: (id: string): Promise<void> => {
    return ipcRenderer.invoke('downloads:pause', id);
  },

  resumeDownload: (id: string): Promise<void> => {
    return ipcRenderer.invoke('downloads:resume', id);
  },

  removeDownload: (id: string, deleteFiles: boolean): Promise<void> => {
    return ipcRenderer.invoke('downloads:remove', id, deleteFiles);
  },

  stopSeeding: (id: string): Promise<void> => {
    return ipcRenderer.invoke('downloads:stopSeeding', id);
  },

  retryDownload: (id: string): Promise<void> => {
    return ipcRenderer.invoke('downloads:retry', id);
  },

  getDownloads: (): Promise<Download[]> => {
    return ipcRenderer.invoke('downloads:getAll');
  },

  getTorrentFiles: (id: string): Promise<any[]> => {
    return ipcRenderer.invoke('downloads:getFiles', id);
  },

  getTorrentInfo: (params: { torrentPath?: string; magnetUri?: string }): Promise<any> => {
    return ipcRenderer.invoke('downloads:getTorrentInfo', params);
  },

  setDownloadCategory: (id: string, category: string | null): Promise<void> => {
    return ipcRenderer.invoke('downloads:setCategory', id, category);
  },

  // Settings
  getSettings: (): Promise<AppSettings> => {
    return ipcRenderer.invoke('settings:get');
  },

  updateSettings: (settings: Partial<AppSettings>): Promise<AppSettings> => {
    return ipcRenderer.invoke('settings:update', settings);
  },

  // Categories
  getCategories: (): Promise<Category[]> => {
    return ipcRenderer.invoke('categories:get');
  },

  addCategory: (category: Omit<Category, 'id'>): Promise<Category> => {
    return ipcRenderer.invoke('categories:add', category);
  },

  updateCategory: (id: string, updates: Partial<Category>): Promise<Category> => {
    return ipcRenderer.invoke('categories:update', id, updates);
  },

  deleteCategory: (id: string): Promise<void> => {
    return ipcRenderer.invoke('categories:delete', id);
  },

  // Scheduler
  getScheduler: (): Promise<SchedulerConfig> => {
    return ipcRenderer.invoke('scheduler:get');
  },

  updateScheduler: (config: Partial<SchedulerConfig>): Promise<SchedulerConfig> => {
    return ipcRenderer.invoke('scheduler:update', config);
  },

  // Catalog
  getCatalog: (): Promise<CatalogEntry[]> => {
    return ipcRenderer.invoke('catalog:get');
  },

  // File dialogs
  selectDirectory: (): Promise<string | null> => {
    return ipcRenderer.invoke('dialog:selectDirectory');
  },

  selectTorrentFile: (): Promise<{ path: string; content: string } | null> => {
    return ipcRenderer.invoke('dialog:selectTorrentFile');
  },

  selectFilesForTorrent: (): Promise<string[] | null> => {
    return ipcRenderer.invoke('dialog:selectFilesForTorrent');
  },

  selectFolderForTorrent: (): Promise<string | null> => {
    return ipcRenderer.invoke('dialog:selectFolderForTorrent');
  },

  selectSaveTorrentPath: (defaultName: string): Promise<string | null> => {
    return ipcRenderer.invoke('dialog:selectSaveTorrentPath', defaultName);
  },

  // File system operations
  getPathInfo: (path: string): Promise<{
    isDirectory: boolean;
    size: number;
    fileCount: number;
    name: string;
  }> => {
    return ipcRenderer.invoke('fs:getPathInfo', path);
  },

  // Shell operations
  openPath: (path: string): Promise<void> => {
    return ipcRenderer.invoke('shell:openPath', path);
  },

  showItemInFolder: (path: string): Promise<void> => {
    return ipcRenderer.invoke('shell:showItemInFolder', path);
  },

  // Cache management
  clearCache: (): Promise<{ success: boolean }> => {
    return ipcRenderer.invoke('cache:clear');
  },

  // Create torrent
  createTorrent: (request: CreateTorrentRequest): Promise<CreateTorrentResult> => {
    return ipcRenderer.invoke('torrent:create', request);
  },

  getDefaultTrackers: (): Promise<string[][]> => {
    return ipcRenderer.invoke('torrent:getDefaultTrackers');
  },

  // Stats subscription
  onDownloadStats: (callback: (stats: DownloadStats[]) => void): (() => void) => {
    const handler = (_event: IpcRendererEvent, stats: DownloadStats[]) => {
      callback(stats);
    };

    ipcRenderer.on('downloads:stats', handler);

    return () => {
      ipcRenderer.removeListener('downloads:stats', handler);
    };
  },

  onCreateTorrentProgress: (callback: (progress: CreateTorrentProgress) => void): (() => void) => {
    const handler = (_event: IpcRendererEvent, progress: CreateTorrentProgress) => {
      callback(progress);
    };

    ipcRenderer.on('torrent:createProgress', handler);

    return () => {
      ipcRenderer.removeListener('torrent:createProgress', handler);
    };
  },

  // Collaborative Seeding Network
  getReputation: () => {
    return ipcRenderer.invoke('seeding:getReputation');
  },

  getSeedingPriorities: () => {
    return ipcRenderer.invoke('seeding:getSeedingPriorities');
  },

  getSeedingRecommendations: (maxSlots: number) => {
    return ipcRenderer.invoke('seeding:getSeedingRecommendations', maxSlots);
  },

  getRecentTransactions: (limit?: number) => {
    return ipcRenderer.invoke('seeding:getRecentTransactions', limit);
  },

  getBadges: () => {
    return ipcRenderer.invoke('seeding:getBadges');
  },

  enableCollaborativeSeeding: (enabled: boolean) => {
    return ipcRenderer.invoke('seeding:enable', enabled);
  },

  // Privacy & Security
  getPrivacyConfig: () => {
    return ipcRenderer.invoke('privacy:getConfig');
  },

  updatePrivacyConfig: (updates: Partial<PrivacyConfig>) => {
    return ipcRenderer.invoke('privacy:updateConfig', updates);
  },

  clearAllData: () => {
    return ipcRenderer.invoke('privacy:clearAllData');
  },

  // VirusHunt Security
  virusHunt: {
    initialize: (): Promise<void> => {
      return ipcRenderer.invoke('virushunt:initialize');
    },

    startScan: (options: any): Promise<{ scanId: string }> => {
      return ipcRenderer.invoke('virushunt:start-scan', options);
    },

    cancelScan: (scanId: string): Promise<boolean> => {
      return ipcRenderer.invoke('virushunt:cancel-scan', scanId);
    },

    // Hash Reputation
    getFileReputation: (hash: string): Promise<any> => {
      return ipcRenderer.invoke('virushunt:get-file-reputation', hash);
    },

    addToWhitelist: (hash: string, fileName?: string, size?: number): Promise<void> => {
      return ipcRenderer.invoke('virushunt:add-to-whitelist', hash, fileName, size);
    },

    addToBlacklist: (hash: string, threatType: string, fileName?: string, description?: string): Promise<void> => {
      return ipcRenderer.invoke('virushunt:add-to-blacklist', hash, threatType, fileName, description);
    },

    removeHash: (hash: string): Promise<void> => {
      return ipcRenderer.invoke('virushunt:remove-hash', hash);
    },

    // Torrent Reputation
    getTorrentReputation: (infoHash: string): Promise<any> => {
      return ipcRenderer.invoke('virushunt:get-torrent-reputation', infoHash);
    },

    updateTorrentReputation: (infoHash: string, data: any): Promise<void> => {
      return ipcRenderer.invoke('virushunt:update-torrent-reputation', infoHash, data);
    },

    // Release Groups
    getReleaseGroup: (groupName: string): Promise<any> => {
      return ipcRenderer.invoke('virushunt:get-release-group', groupName);
    },

    updateReleaseGroup: (name: string, updates: any): Promise<void> => {
      return ipcRenderer.invoke('virushunt:update-release-group', name, updates);
    },

    // Database versions
    getDatabaseVersions: (): Promise<any> => {
      return ipcRenderer.invoke('virushunt:get-database-versions');
    },

    // Import/Export
    exportDatabase: (type: 'hashes' | 'torrents' | 'releaseGroups', outputPath: string): Promise<void> => {
      return ipcRenderer.invoke('virushunt:export-database', type, outputPath);
    },

    importDatabase: (type: 'hashes' | 'torrents' | 'releaseGroups', inputPath: string): Promise<void> => {
      return ipcRenderer.invoke('virushunt:import-database', type, inputPath);
    },

    getConfig: (): Promise<VirusHuntConfig> => {
      return ipcRenderer.invoke('virushunt:get-config');
    },

    updateConfig: (updates: Partial<VirusHuntConfig>): Promise<void> => {
      return ipcRenderer.invoke('virushunt:update-config', updates);
    },

    resetConfig: (): Promise<void> => {
      return ipcRenderer.invoke('virushunt:reset-config');
    },

    setEnabled: (enabled: boolean): Promise<void> => {
      return ipcRenderer.invoke('virushunt:set-enabled', enabled);
    },

    isEnabled: (): Promise<boolean> => {
      return ipcRenderer.invoke('virushunt:is-enabled');
    },

    getActiveScans: (): Promise<string[]> => {
      return ipcRenderer.invoke('virushunt:get-active-scans');
    },

    isScanActive: (scanId: string): Promise<boolean> => {
      return ipcRenderer.invoke('virushunt:is-scan-active', scanId);
    },

    exportConfig: (outputPath: string): Promise<void> => {
      return ipcRenderer.invoke('virushunt:export-config', outputPath);
    },

    importConfig: (inputPath: string): Promise<void> => {
      return ipcRenderer.invoke('virushunt:import-config', inputPath);
    },

    getQuarantinePath: (): Promise<string> => {
      return ipcRenderer.invoke('virushunt:get-quarantine-path');
    },

    setQuarantinePath: (path: string): Promise<void> => {
      return ipcRenderer.invoke('virushunt:set-quarantine-path', path);
    },

    deepScanFile: (filePath: string): Promise<{ success: boolean; result?: any; error?: string }> => {
      return ipcRenderer.invoke('virushunt:deep-scan-file', filePath);
    },

    onScanProgress: (callback: (progress: ScanProgress) => void): (() => void) => {
      const listener = (_event: IpcRendererEvent, progress: ScanProgress) => callback(progress);
      ipcRenderer.on('virushunt:scan-progress', listener);
      return () => ipcRenderer.removeListener('virushunt:scan-progress', listener);
    },

    onScanComplete: (callback: (data: { scanId: string; result: ScanResult }) => void): (() => void) => {
      const listener = (_event: IpcRendererEvent, data: { scanId: string; result: ScanResult }) => callback(data);
      ipcRenderer.on('virushunt:scan-complete', listener);
      return () => ipcRenderer.removeListener('virushunt:scan-complete', listener);
    },

    onScanError: (callback: (data: { scanId: string; error: string }) => void): (() => void) => {
      const listener = (_event: IpcRendererEvent, data: { scanId: string; error: string }) => callback(data);
      ipcRenderer.on('virushunt:scan-error', listener);
      return () => ipcRenderer.removeListener('virushunt:scan-error', listener);
    },
  },

  // === Reports & History ===
  reports: {
    initialize: (): Promise<void> => {
      return ipcRenderer.invoke('reports:initialize');
    },

    exportReport: (results: any[], summary: any, options: any): Promise<any> => {
      return ipcRenderer.invoke('reports:export', results, summary, options);
    },

    getHistory: (filter?: any): Promise<any[]> => {
      return ipcRenderer.invoke('reports:get-history', filter);
    },

    getScan: (id: string): Promise<any> => {
      return ipcRenderer.invoke('reports:get-scan', id);
    },

    getScanReport: (id: string): Promise<any> => {
      return ipcRenderer.invoke('reports:get-scan-report', id);
    },

    addScan: (report: any): Promise<any> => {
      return ipcRenderer.invoke('reports:add-scan', report);
    },

    deleteScan: (id: string): Promise<boolean> => {
      return ipcRenderer.invoke('reports:delete-scan', id);
    },

    deleteScans: (ids: string[]): Promise<{ deleted: number; failed: number }> => {
      return ipcRenderer.invoke('reports:delete-scans', ids);
    },

    clearHistory: (): Promise<void> => {
      return ipcRenderer.invoke('reports:clear-history');
    },

    updateScan: (id: string, updates: any): Promise<boolean> => {
      return ipcRenderer.invoke('reports:update-scan', id, updates);
    },

    compareScans: (id1: string, id2: string): Promise<any> => {
      return ipcRenderer.invoke('reports:compare-scans', id1, id2);
    },

    getStatistics: (): Promise<any> => {
      return ipcRenderer.invoke('reports:get-statistics');
    },

    showSaveDialog: (options: { defaultPath?: string; filters?: any[] }): Promise<string | undefined> => {
      return ipcRenderer.invoke('reports:show-save-dialog', options);
    },

    openFile: (filePath: string): Promise<void> => {
      return ipcRenderer.invoke('reports:open-file', filePath);
    },
  },

  // VirusHunt Settings API
  virusHuntSettings: {
    getSettings: (): Promise<VirusHuntSettings> => {
      return ipcRenderer.invoke('virushunt:get-settings');
    },

    updateSettings: (updates: Partial<VirusHuntSettings>): Promise<SettingsUpdateResult> => {
      return ipcRenderer.invoke('virushunt:update-settings', updates);
    },

    resetSettings: (): Promise<SettingsUpdateResult> => {
      return ipcRenderer.invoke('virushunt:reset-settings');
    },

    validateSettings: (settings: unknown): Promise<SettingsValidationResult> => {
      return ipcRenderer.invoke('virushunt:validate-settings', settings);
    },

    exportSettings: (): Promise<{ success: boolean; message: string; path?: string }> => {
      return ipcRenderer.invoke('virushunt:export-settings');
    },

    importSettings: (): Promise<{ success: boolean; message: string; updatedSettings?: VirusHuntSettings }> => {
      return ipcRenderer.invoke('virushunt:import-settings');
    },
  },

  // Dialog API
  dialog: {
    showOpenDialog: (options: {
      properties?: Array<'openFile' | 'openDirectory' | 'multiSelections'>;
      title?: string;
      defaultPath?: string;
      filters?: Array<{ name: string; extensions: string[] }>;
    }): Promise<{ canceled: boolean; filePaths: string[] }> => {
      return ipcRenderer.invoke('dialog:showOpenDialog', options);
    },

    showSaveDialog: (options: {
      title?: string;
      defaultPath?: string;
      filters?: Array<{ name: string; extensions: string[] }>;
    }): Promise<{ canceled: boolean; filePath?: string }> => {
      return ipcRenderer.invoke('dialog:showSaveDialog', options);
    },
  },

  // Event system
  on: (channel: string, callback: (...args: any[]) => void): void => {
    ipcRenderer.on(channel, (_event, ...args) => callback(...args));
  },

  off: (channel: string, callback: (...args: any[]) => void): void => {
    ipcRenderer.removeListener(channel, callback);
  },

  // Generic invoke for custom IPC handlers
  invoke: <T = any>(channel: string, ...args: any[]): Promise<T> => {
    return ipcRenderer.invoke(channel, ...args);
  },
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('api', api);

