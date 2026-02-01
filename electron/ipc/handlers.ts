import { ipcMain, dialog, BrowserWindow, shell, app } from 'electron';
import { getTorrentManager, TorrentError, createTorrentFile, getDefaultTrackers } from '../torrent';
import { getCollaborativeSeedingManager } from '../seeding';
import { getVirusHunt } from '../virusHunt';
import { getReportGenerator } from '../reports/generator';
import { getHistoryManager } from '../reports/history';
import { registerVirusHuntHandlers } from './virushunt-handlers';
import * as db from '../db/store';
import { AddDownloadRequest, DownloadStats, CreateTorrentRequest } from '../../shared/types';
import { InvalidStateTransitionError } from '../../shared/state-machine';
import { DEFAULT_VIRUSHUNT_SETTINGS, VirusHuntSettings } from '../../shared/virushunt-settings-types';
import { validateVirusHuntSettings, validateVirusHuntSettingsUpdate } from '../../shared/virushunt-settings-schema';
import catalog from '../data/catalog.json';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { logger, detectVPN, showVPNWarning } from '../utils';

const log = logger.child('IPC');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type IpcHandler = (event: Electron.IpcMainInvokeEvent, ...args: any[]) => Promise<any>;

/**
 * Wraps an IPC handler with error handling and logging
 */
function wrapHandler(name: string, handler: IpcHandler): IpcHandler {
  return async (event, ...args) => {
    log.debug(`IPC call: ${name}`, { args });
    try {
      const result = await handler(event, ...args);
      return result;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorCode = error instanceof TorrentError ? error.code : undefined;

      log.error(`IPC error: ${name}`, {
        error: errorMessage,
        code: errorCode,
      });

      // Re-throw with a clean message for the renderer
      if (error instanceof TorrentError) {
        throw new Error(`${error.message} (${error.code})`);
      }
      if (error instanceof InvalidStateTransitionError) {
        throw new Error(error.message);
      }
      throw error;
    }
  };
}

export function setupIpcHandlers(mainWindow: BrowserWindow): void {
  const torrentManager = getTorrentManager();

  log.info('Setting up IPC handlers');

  // Register VirusHunt handlers
  registerVirusHuntHandlers();

  // Downloads
  ipcMain.handle('downloads:add', wrapHandler('downloads:add',
    async (_event, request: AddDownloadRequest) => {
      return torrentManager.addDownload(request);
    }
  ));

  ipcMain.handle('downloads:pause', wrapHandler('downloads:pause',
    async (_event, id: string) => {
      return await torrentManager.pauseDownload(id);
    }
  ));

  ipcMain.handle('downloads:resume', wrapHandler('downloads:resume',
    async (_event, id: string) => {
      return await torrentManager.resumeDownload(id);
    }
  ));

  ipcMain.handle('downloads:remove', wrapHandler('downloads:remove',
    async (_event, id: string, deleteFiles: boolean) => {
      // Validate arguments
      if (typeof id !== 'string') {
        throw new Error(`Invalid id parameter: expected string, got ${typeof id}`);
      }
      if (typeof deleteFiles !== 'boolean') {
        throw new Error(`Invalid deleteFiles parameter: expected boolean, got ${typeof deleteFiles}`);
      }
      return await torrentManager.removeDownload(id, deleteFiles);
    }
  ));

  ipcMain.handle('downloads:stopSeeding', wrapHandler('downloads:stopSeeding',
    async (_event, id: string) => {
      return await torrentManager.stopSeeding(id);
    }
  ));

  ipcMain.handle('downloads:retry', wrapHandler('downloads:retry',
    async (_event, id: string) => {
      return await torrentManager.retryDownload(id);
    }
  ));

  ipcMain.handle('downloads:getAll', wrapHandler('downloads:getAll',
    async () => {
      return torrentManager.getDownloads();
    }
  ));

  ipcMain.handle('downloads:getFiles', wrapHandler('downloads:getFiles',
    async (_event, id: string) => {
      return torrentManager.getFiles(id);
    }
  ));

  ipcMain.handle('downloads:getTorrentInfo', wrapHandler('downloads:getTorrentInfo',
    async (_event, params: { torrentPath?: string; magnetUri?: string }) => {
      return torrentManager.getTorrentInfo(params);
    }
  ));

  // Settings
  ipcMain.handle('settings:get', wrapHandler('settings:get',
    async () => {
      return db.getSettings();
    }
  ));

  ipcMain.handle('settings:update', wrapHandler('settings:update',
    async (_event, settings) => {
      const updated = await db.updateSettings(settings);

      // Update torrent manager with new settings
      await torrentManager.updateSettings({
        maxActiveDownloads: updated.maxActiveDownloads,
        maxDownKbps: updated.maxDownKbps,
        maxUpKbps: updated.maxUpKbps,
      });

      return updated;
    }
  ));

  // Categories
  ipcMain.handle('categories:get', wrapHandler('categories:get',
    async () => {
      return db.getCategories();
    }
  ));

  ipcMain.handle('categories:add', wrapHandler('categories:add',
    async (_event, category: Omit<import('../../shared/types').Category, 'id'>) => {
      return db.addCategory(category);
    }
  ));

  ipcMain.handle('categories:update', wrapHandler('categories:update',
    async (_event, id: string, updates: Partial<import('../../shared/types').Category>) => {
      return db.updateCategory(id, updates);
    }
  ));

  ipcMain.handle('categories:delete', wrapHandler('categories:delete',
    async (_event, id: string) => {
      return db.deleteCategory(id);
    }
  ));

  ipcMain.handle('downloads:setCategory', wrapHandler('downloads:setCategory',
    async (_event, id: string, category: string | null) => {
      return db.setDownloadCategory(id, category);
    }
  ));

  // Scheduler
  ipcMain.handle('scheduler:get', wrapHandler('scheduler:get',
    async () => {
      return db.getScheduler();
    }
  ));

  ipcMain.handle('scheduler:update', wrapHandler('scheduler:update',
    async (_event, config: Partial<import('../../shared/types').SchedulerConfig>) => {
      return db.updateScheduler(config);
    }
  ));

  // Catalog
  ipcMain.handle('catalog:get', wrapHandler('catalog:get',
    async () => {
      return catalog;
    }
  ));

  // File dialogs
  ipcMain.handle('dialog:selectDirectory', wrapHandler('dialog:selectDirectory',
    async () => {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory', 'createDirectory'],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }

      return result.filePaths[0];
    }
  ));

  ipcMain.handle('dialog:selectTorrentFile', wrapHandler('dialog:selectTorrentFile',
    async () => {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [{ name: 'Torrent Files', extensions: ['torrent'] }],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }

      const filePath = result.filePaths[0];
      const content = fsSync.readFileSync(filePath).toString('base64');

      return { path: filePath, content };
    }
  ));

  // Generic showOpenDialog
  ipcMain.handle('dialog:showOpenDialog', wrapHandler('dialog:showOpenDialog',
    async (_event, options: { properties?: string[]; title?: string; defaultPath?: string; filters?: any[] }) => {
      const result = await dialog.showOpenDialog(mainWindow, options as any);
      return result;
    }
  ));

  // Generic showSaveDialog
  ipcMain.handle('dialog:showSaveDialog', wrapHandler('dialog:showSaveDialog',
    async (_event, options: { title?: string; defaultPath?: string; filters?: any[] }) => {
      const result = await dialog.showSaveDialog(mainWindow, options);
      return result;
    }
  ));

  // Shell operations
  ipcMain.handle('shell:openPath', wrapHandler('shell:openPath',
    async (_event, path: string) => {
      return await shell.openPath(path);
    }
  ));

  ipcMain.handle('shell:showItemInFolder', wrapHandler('shell:showItemInFolder',
    async (_event, path: string) => {
      shell.showItemInFolder(path);
    }
  ));

  // Cache management
  ipcMain.handle('cache:clear', wrapHandler('cache:clear',
    async () => {
      try {
        const session = mainWindow.webContents.session;
        await session.clearCache();
        await session.clearStorageData({
          storages: ['cachestorage', 'serviceworkers', 'websql', 'indexdb'],
        });
        log.info('Cache cleared successfully');
        return { success: true };
      } catch (error) {
        log.error('Failed to clear cache', { error });
        throw new Error('Failed to clear cache');
      }
    }
  ));

  // Stats subscription - send via main window
  torrentManager.onStats((stats: DownloadStats[]) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('downloads:stats', stats);
    }
  });

  // ===== Create Torrent =====
  
  // Get file/folder info (size, file count)
  ipcMain.handle('fs:getPathInfo', wrapHandler('fs:getPathInfo',
    async (_event, filePath: string) => {
      const stats = await fs.stat(filePath);
      
      if (stats.isDirectory()) {
        // Recursively get folder size and file count
        let totalSize = 0;
        let fileCount = 0;
        
        const walkDir = async (dir: string) => {
          const entries = await fs.readdir(dir, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              await walkDir(fullPath);
            } else if (entry.isFile()) {
              const fileStats = await fs.stat(fullPath);
              totalSize += fileStats.size;
              fileCount++;
            }
          }
        };
        
        await walkDir(filePath);
        
        return {
          isDirectory: true,
          size: totalSize,
          fileCount,
          name: path.basename(filePath)
        };
      } else {
        return {
          isDirectory: false,
          size: stats.size,
          fileCount: 1,
          name: path.basename(filePath)
        };
      }
    }
  ));
  
  // Select files for torrent creation
  ipcMain.handle('dialog:selectFilesForTorrent', wrapHandler('dialog:selectFilesForTorrent',
    async () => {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile', 'multiSelections'],
        title: 'Select Files for Torrent',
      });

      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }

      return result.filePaths;
    }
  ));

  // Select folder for torrent creation
  ipcMain.handle('dialog:selectFolderForTorrent', wrapHandler('dialog:selectFolderForTorrent',
    async () => {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        title: 'Select Folder for Torrent',
      });

      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }

      return result.filePaths[0];
    }
  ));

  // Select save path for torrent file
  ipcMain.handle('dialog:selectSaveTorrentPath', wrapHandler('dialog:selectSaveTorrentPath',
    async (_event, defaultName: string) => {
      const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Save Torrent File',
        defaultPath: defaultName.endsWith('.torrent') ? defaultName : `${defaultName}.torrent`,
        filters: [{ name: 'Torrent Files', extensions: ['torrent'] }],
      });

      if (result.canceled || !result.filePath) {
        return null;
      }

      return result.filePath;
    }
  ));

  // Create torrent file
  ipcMain.handle('torrent:create', wrapHandler('torrent:create',
    async (_event, request: CreateTorrentRequest) => {
      log.info('Creating torrent', { sourcePaths: request.sourcePaths });
      
      const result = await createTorrentFile(request, mainWindow);
      
      // If startSeeding is true, add the created torrent for seeding
      if (request.startSeeding && result.torrentFilePath) {
        log.info('Auto-starting seeding for created torrent', { infoHash: result.infoHash });
        
        // Determine source folder (parent of the first source path)
        const sourceFolder = path.dirname(request.sourcePaths[0]);
        
        await torrentManager.addDownload({
          sourceType: 'torrent_file',
          sourceUri: result.torrentFilePath,
          savePath: sourceFolder,
          name: request.options.name,
        });
      }
      
      return result;
    }
  ));

  // Get default trackers
  ipcMain.handle('torrent:getDefaultTrackers', wrapHandler('torrent:getDefaultTrackers',
    async () => {
      return getDefaultTrackers();
    }
  ));

  // === Collaborative Seeding Network ===
  const seedingManager = getCollaborativeSeedingManager();

  ipcMain.handle('seeding:getReputation', wrapHandler('seeding:getReputation',
    async () => {
      return seedingManager.getReputation();
    }
  ));

  ipcMain.handle('seeding:getSeedingPriorities', wrapHandler('seeding:getSeedingPriorities',
    async () => {
      const priorities = seedingManager.getSeedingPriorities();
      // Convert Map to object for IPC transfer
      return Object.fromEntries(priorities);
    }
  ));

  ipcMain.handle('seeding:getSeedingRecommendations', wrapHandler('seeding:getSeedingRecommendations',
    async (_event, maxSlots: number = 5) => {
      return seedingManager.getSeedingRecommendations(maxSlots);
    }
  ));

  ipcMain.handle('seeding:getRecentTransactions', wrapHandler('seeding:getRecentTransactions',
    async (_event, limit: number = 20) => {
      return seedingManager.getRecentTransactions(limit);
    }
  ));

  ipcMain.handle('seeding:getBadges', wrapHandler('seeding:getBadges',
    async () => {
      return seedingManager.getBadges();
    }
  ));

  ipcMain.handle('seeding:enable', wrapHandler('seeding:enable',
    async (_event, enabled: boolean) => {
      return seedingManager.setEnabled(enabled);
    }
  ));

  // Privacy & Security handlers
  ipcMain.handle('privacy:checkVPN', wrapHandler('privacy:checkVPN',
    async () => {
      return await detectVPN();
    }
  ));

  ipcMain.handle('privacy:showVPNWarning', wrapHandler('privacy:showVPNWarning',
    async () => {
      const result = await detectVPN();
      if (!result.isVPNActive) {
        showVPNWarning(result);
      }
      return result;
    }
  ));

  ipcMain.handle('privacy:getConfig', wrapHandler('privacy:getConfig',
    async () => {
      return await db.getPrivacyConfig();
    }
  ));

  ipcMain.handle('privacy:updateConfig', wrapHandler('privacy:updateConfig',
    async (_event, updates: Partial<any>) => {
      return await db.updatePrivacyConfig(updates);
    }
  ));

  ipcMain.handle('privacy:clearAllData', wrapHandler('privacy:clearAllData',
    async () => {
      await db.clearAllData();
      return { success: true };
    }
  ));

  // === Report Generation & Export ===
  const reportGenerator = getReportGenerator();
  const historyManager = getHistoryManager();

  // Initialize history manager
  ipcMain.handle('reports:initialize', wrapHandler('reports:initialize',
    async () => {
      await historyManager.initialize();
    }
  ));

  // Export report
  ipcMain.handle('reports:export', wrapHandler('reports:export',
    async (_event, results: any[], summary: any, options: any) => {
      return reportGenerator.generateReport(results, summary, options);
    }
  ));

  // Get scan history
  ipcMain.handle('reports:get-history', wrapHandler('reports:get-history',
    async (_event, filter?: any) => {
      return historyManager.getHistory(filter);
    }
  ));

  // Get single scan
  ipcMain.handle('reports:get-scan', wrapHandler('reports:get-scan',
    async (_event, id: string) => {
      return historyManager.getScan(id);
    }
  ));

  // Get full scan report
  ipcMain.handle('reports:get-scan-report', wrapHandler('reports:get-scan-report',
    async (_event, id: string) => {
      return historyManager.getScanReport(id);
    }
  ));

  // Add scan to history
  ipcMain.handle('reports:add-scan', wrapHandler('reports:add-scan',
    async (_event, report: any) => {
      return historyManager.addScan(report);
    }
  ));

  // Delete scan
  ipcMain.handle('reports:delete-scan', wrapHandler('reports:delete-scan',
    async (_event, id: string) => {
      return historyManager.deleteScan(id);
    }
  ));

  // Delete multiple scans
  ipcMain.handle('reports:delete-scans', wrapHandler('reports:delete-scans',
    async (_event, ids: string[]) => {
      return historyManager.deleteScans(ids);
    }
  ));

  // Clear all history
  ipcMain.handle('reports:clear-history', wrapHandler('reports:clear-history',
    async () => {
      return historyManager.clearHistory();
    }
  ));

  // Update scan
  ipcMain.handle('reports:update-scan', wrapHandler('reports:update-scan',
    async (_event, id: string, updates: any) => {
      return historyManager.updateScan(id, updates);
    }
  ));

  // Compare scans
  ipcMain.handle('reports:compare-scans', wrapHandler('reports:compare-scans',
    async (_event, id1: string, id2: string) => {
      return historyManager.compareScans(id1, id2);
    }
  ));

  // Get history statistics
  ipcMain.handle('reports:get-statistics', wrapHandler('reports:get-statistics',
    async () => {
      return historyManager.getStatistics();
    }
  ));

  // Show save dialog for export
  ipcMain.handle('reports:show-save-dialog', wrapHandler('reports:show-save-dialog',
    async (_event, options: { defaultPath?: string; filters?: any[] }) => {
      const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Export Scan Report',
        defaultPath: options.defaultPath,
        filters: options.filters || [
          { name: 'HTML Files', extensions: ['html'] },
          { name: 'PDF Files', extensions: ['pdf'] },
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'Text Files', extensions: ['txt'] },
        ],
      });
      return result.filePath;
    }
  ));

  // Open report file
  ipcMain.handle('reports:open-file', wrapHandler('reports:open-file',
    async (_event, filePath: string) => {
      await shell.openPath(filePath);
    }
  ));

  // ====================================================================
  // VirusHunt Settings Handlers
  // ====================================================================

  // Get settings file path
  const getSettingsPath = () => {
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'virusHunt', 'settings.json');
  };

  // Initialize settings directory
  const initializeSettingsDir = async () => {
    const settingsPath = getSettingsPath();
    const dir = path.dirname(settingsPath);
    
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      log.error('Failed to create settings directory', { error });
      throw error;
    }
  };

  // Load settings from file
  const loadSettings = async (): Promise<VirusHuntSettings> => {
    await initializeSettingsDir();
    const settingsPath = getSettingsPath();

    try {
      if (fsSync.existsSync(settingsPath)) {
        const data = await fs.readFile(settingsPath, 'utf-8');
        const settings = JSON.parse(data);
        
        // Validate loaded settings
        const validation = validateVirusHuntSettings(settings);
        if (validation.success) {
          return validation.data;
        } else {
          log.warn('Invalid settings file, using defaults', { errors: validation.error.errors });
          return { ...DEFAULT_VIRUSHUNT_SETTINGS };
        }
      }
    } catch (error) {
      log.error('Failed to load settings', { error });
    }

    return { ...DEFAULT_VIRUSHUNT_SETTINGS };
  };

  // Save settings to file
  const saveSettings = async (settings: VirusHuntSettings): Promise<void> => {
    await initializeSettingsDir();
    const settingsPath = getSettingsPath();

    try {
      await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
      log.info('Settings saved successfully');
    } catch (error) {
      log.error('Failed to save settings', { error });
      throw new Error('Failed to save settings');
    }
  };

  // Get VirusHunt settings
  ipcMain.handle('virushunt:get-settings', wrapHandler('virushunt:get-settings',
    async () => {
      return await loadSettings();
    }
  ));

  // Update VirusHunt settings (partial update)
  ipcMain.handle('virushunt:update-settings', wrapHandler('virushunt:update-settings',
    async (_event, updates: Partial<VirusHuntSettings>) => {
      // Validate updates
      const validation = validateVirusHuntSettingsUpdate(updates);
      if (!validation.success) {
        const errors = validation.error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        
        return {
          success: false,
          message: 'Validation failed',
          errors,
        };
      }

      // Load current settings
      const currentSettings = await loadSettings();

      // Deep merge updates with current settings
      const updatedSettings: VirusHuntSettings = {
        ...currentSettings,
        ...updates,
        fileTypes: { ...currentSettings.fileTypes, ...updates.fileTypes },
        heuristics: { ...currentSettings.heuristics, ...updates.heuristics },
        databases: { 
          ...currentSettings.databases, 
          ...updates.databases,
          statistics: { ...currentSettings.databases.statistics, ...updates.databases?.statistics },
        },
        crowdsourcing: { 
          ...currentSettings.crowdsourcing, 
          ...updates.crowdsourcing,
          contributionStats: { ...currentSettings.crowdsourcing.contributionStats, ...updates.crowdsourcing?.contributionStats },
        },
        notifications: { ...currentSettings.notifications, ...updates.notifications },
        performance: { ...currentSettings.performance, ...updates.performance },
        exclusions: { ...currentSettings.exclusions, ...updates.exclusions },
        advanced: { ...currentSettings.advanced, ...updates.advanced },
      };

      // Validate complete settings
      const finalValidation = validateVirusHuntSettings(updatedSettings);
      if (!finalValidation.success) {
        const errors = finalValidation.error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        
        return {
          success: false,
          message: 'Final validation failed',
          errors,
        };
      }

      // Save settings
      await saveSettings(finalValidation.data);

      return {
        success: true,
        message: 'Settings updated successfully',
        updatedSettings: finalValidation.data,
      };
    }
  ));

  // Reset VirusHunt settings to defaults
  ipcMain.handle('virushunt:reset-settings', wrapHandler('virushunt:reset-settings',
    async () => {
      const defaultSettings = { ...DEFAULT_VIRUSHUNT_SETTINGS };
      await saveSettings(defaultSettings);
      
      return {
        success: true,
        message: 'Settings reset to defaults',
        updatedSettings: defaultSettings,
      };
    }
  ));

  // Validate settings without saving
  ipcMain.handle('virushunt:validate-settings', wrapHandler('virushunt:validate-settings',
    async (_event, settings: unknown) => {
      const validation = validateVirusHuntSettings(settings);
      
      if (validation.success) {
        return {
          valid: true,
          errors: [],
        };
      }

      const errors = validation.error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));

      return {
        valid: false,
        errors,
      };
    }
  ));

  // Export settings to file
  ipcMain.handle('virushunt:export-settings', wrapHandler('virushunt:export-settings',
    async () => {
      const settings = await loadSettings();
      
      const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Export VirusHunt Settings',
        defaultPath: 'virushunt-settings.json',
        filters: [
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (result.canceled || !result.filePath) {
        return { success: false, message: 'Export canceled' };
      }

      try {
        await fs.writeFile(result.filePath, JSON.stringify(settings, null, 2), 'utf-8');
        return { success: true, message: 'Settings exported successfully', path: result.filePath };
      } catch (error) {
        log.error('Failed to export settings', { error });
        return { success: false, message: 'Failed to export settings' };
      }
    }
  ));

  // Import settings from file
  ipcMain.handle('virushunt:import-settings', wrapHandler('virushunt:import-settings',
    async () => {
      const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Import VirusHunt Settings',
        filters: [
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] },
        ],
        properties: ['openFile'],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, message: 'Import canceled' };
      }

      try {
        const data = await fs.readFile(result.filePaths[0], 'utf-8');
        const settings = JSON.parse(data);
        
        // Validate imported settings
        const validation = validateVirusHuntSettings(settings);
        if (!validation.success) {
          const errors = validation.error.errors.map((err) => ({
            field: err.path.join('.'),
            message: err.message,
          }));
          return { success: false, message: 'Invalid settings file', errors };
        }

        // Save validated settings
        await saveSettings(validation.data);
        
        return { 
          success: true, 
          message: 'Settings imported successfully', 
          updatedSettings: validation.data,
        };
      } catch (error) {
        log.error('Failed to import settings', { error });
        return { success: false, message: 'Failed to import settings' };
      }
    }
  ));

  log.info('IPC handlers setup complete');
}
