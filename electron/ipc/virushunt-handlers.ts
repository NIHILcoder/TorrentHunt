import { ipcMain, IpcMainInvokeEvent } from 'electron';
import {
  virusHuntService,
  virusHuntSettings,
  reputationDatabase,
  ScanOptions,
  ScanResult,
  FileReputation,
  VirusHuntConfig,
  DatabaseUpdateResult,
  TorrentReputation,
  ReleaseGroup
} from '../services/security';

/**
 * Register all VirusHunt IPC handlers
 */
export function registerVirusHuntHandlers(): void {
  // Initialize VirusHunt service
  ipcMain.handle('virushunt:initialize', async (): Promise<void> => {
    await virusHuntService.initialize();
  });

  // Start a new scan
  ipcMain.handle(
    'virushunt:start-scan',
    async (_event: IpcMainInvokeEvent, options: ScanOptions): Promise<{ scanId: string }> => {
      return await virusHuntService.startScan(options);
    }
  );

  // Cancel an active scan
  ipcMain.handle(
    'virushunt:cancel-scan',
    async (_event: IpcMainInvokeEvent, scanId: string): Promise<boolean> => {
      return await virusHuntService.cancelScan(scanId);
    }
  );

  // Get file reputation by hash
  ipcMain.handle(
    'virushunt:get-file-reputation',
    async (_event: IpcMainInvokeEvent, hash: string): Promise<FileReputation> => {
      return await virusHuntService.getFileReputation(hash);
    }
  );

  // Add file to whitelist
  ipcMain.handle(
    'virushunt:add-to-whitelist',
    async (
      _event: IpcMainInvokeEvent,
      hash: string,
      fileName?: string,
      size?: number
    ): Promise<void> => {
      await virusHuntService.addToWhitelist(hash, fileName, size);
    }
  );

  // Add file to blacklist
  ipcMain.handle(
    'virushunt:add-to-blacklist',
    async (
      _event: IpcMainInvokeEvent,
      hash: string,
      threatType: string,
      fileName?: string,
      description?: string
    ): Promise<void> => {
      await virusHuntService.addToBlacklist(hash, threatType, fileName, description);
    }
  );

  // Remove hash from databases
  ipcMain.handle(
    'virushunt:remove-hash',
    async (_event: IpcMainInvokeEvent, hash: string): Promise<void> => {
      await reputationDatabase.removeHash(hash);
    }
  );

  // Get torrent reputation
  ipcMain.handle(
    'virushunt:get-torrent-reputation',
    async (_event: IpcMainInvokeEvent, infoHash: string): Promise<TorrentReputation | null> => {
      return await reputationDatabase.getTorrentReputation(infoHash);
    }
  );

  // Update torrent reputation
  ipcMain.handle(
    'virushunt:update-torrent-reputation',
    async (
      _event: IpcMainInvokeEvent,
      infoHash: string,
      reputation: Partial<TorrentReputation>
    ): Promise<void> => {
      await reputationDatabase.updateTorrentReputation(infoHash, reputation);
    }
  );

  // Get release group information
  ipcMain.handle(
    'virushunt:get-release-group',
    async (_event: IpcMainInvokeEvent, groupName: string): Promise<ReleaseGroup | null> => {
      return await reputationDatabase.getReleaseGroup(groupName);
    }
  );

  // Update release group
  ipcMain.handle(
    'virushunt:update-release-group',
    async (
      _event: IpcMainInvokeEvent,
      groupName: string,
      groupData: Partial<ReleaseGroup>
    ): Promise<void> => {
      await reputationDatabase.updateReleaseGroup(groupName, groupData);
    }
  );

  // Get database versions
  ipcMain.handle('virushunt:get-database-versions', async () => {
    return await reputationDatabase.getDatabaseVersions();
  });

  // Export database
  ipcMain.handle(
    'virushunt:export-database',
    async (
      _event: IpcMainInvokeEvent,
      type: 'hashes' | 'torrents' | 'releaseGroups',
      outputPath: string
    ): Promise<void> => {
      await reputationDatabase.exportDatabase(type, outputPath);
    }
  );

  // Import database
  ipcMain.handle(
    'virushunt:import-database',
    async (
      _event: IpcMainInvokeEvent,
      type: 'hashes' | 'torrents' | 'releaseGroups',
      inputPath: string
    ): Promise<void> => {
      await reputationDatabase.importDatabase(type, inputPath);
    }
  );

  // Get configuration
  ipcMain.handle('virushunt:get-config', async (): Promise<VirusHuntConfig> => {
    return virusHuntSettings.getConfig();
  });

  // Update configuration
  ipcMain.handle(
    'virushunt:update-config',
    async (_event: IpcMainInvokeEvent, updates: Partial<VirusHuntConfig>): Promise<void> => {
      await virusHuntSettings.updateConfig(updates);
    }
  );

  // Reset configuration to defaults
  ipcMain.handle('virushunt:reset-config', async (): Promise<void> => {
    await virusHuntSettings.resetToDefaults();
  });

  // Enable/disable VirusHunt
  ipcMain.handle(
    'virushunt:set-enabled',
    async (_event: IpcMainInvokeEvent, enabled: boolean): Promise<void> => {
      await virusHuntSettings.setEnabled(enabled);
    }
  );

  // Check if VirusHunt is enabled
  ipcMain.handle('virushunt:is-enabled', async (): Promise<boolean> => {
    return virusHuntSettings.isEnabled();
  });

  // Get active scans
  ipcMain.handle('virushunt:get-active-scans', async (): Promise<string[]> => {
    return virusHuntService.getActiveScans();
  });

  // Check if scan is active
  ipcMain.handle(
    'virushunt:is-scan-active',
    async (_event: IpcMainInvokeEvent, scanId: string): Promise<boolean> => {
      return virusHuntService.isScanActive(scanId);
    }
  );

  // Export configuration
  ipcMain.handle(
    'virushunt:export-config',
    async (_event: IpcMainInvokeEvent, outputPath: string): Promise<void> => {
      await virusHuntSettings.exportConfig(outputPath);
    }
  );

  // Import configuration
  ipcMain.handle(
    'virushunt:import-config',
    async (_event: IpcMainInvokeEvent, inputPath: string): Promise<void> => {
      await virusHuntSettings.importConfig(inputPath);
    }
  );

  // Get quarantine path
  ipcMain.handle('virushunt:get-quarantine-path', async (): Promise<string> => {
    return virusHuntSettings.getQuarantinePath();
  });

  // Set quarantine path
  ipcMain.handle(
    'virushunt:set-quarantine-path',
    async (_event: IpcMainInvokeEvent, path: string): Promise<void> => {
      await virusHuntSettings.setQuarantinePath(path);
    }
  );

  // Deep scan a single file (YARA, Import Analysis, Packer Detection, String Signatures)
  ipcMain.handle(
    'virushunt:deep-scan-file',
    async (event: IpcMainInvokeEvent, filePath: string): Promise<{
      success: boolean;
      result?: any;
      error?: string;
    }> => {
      // Progress callback to send updates to renderer
      const onProgress = (progress: number, message: string) => {
        event.sender.send('virushunt:deep-scan-progress', { progress, message });
      };
      
      return await virusHuntService.deepScanFile(filePath, undefined, onProgress);
    }
  );

  console.log('VirusHunt IPC handlers registered');
}

/**
 * Unregister all VirusHunt IPC handlers
 */
export function unregisterVirusHuntHandlers(): void {
  const handlers = [
    'virushunt:initialize',
    'virushunt:start-scan',
    'virushunt:cancel-scan',
    'virushunt:get-file-reputation',
    'virushunt:add-to-whitelist',
    'virushunt:add-to-blacklist',
    'virushunt:remove-hash',
    'virushunt:get-torrent-reputation',
    'virushunt:update-torrent-reputation',
    'virushunt:get-release-group',
    'virushunt:update-release-group',
    'virushunt:get-database-versions',
    'virushunt:export-database',
    'virushunt:import-database',
    'virushunt:get-config',
    'virushunt:update-config',
    'virushunt:reset-config',
    'virushunt:set-enabled',
    'virushunt:is-enabled',
    'virushunt:get-active-scans',
    'virushunt:is-scan-active',
    'virushunt:export-config',
    'virushunt:import-config',
    'virushunt:get-quarantine-path',
    'virushunt:set-quarantine-path',
    'virushunt:deep-scan-file'
  ];

  for (const handler of handlers) {
    ipcMain.removeHandler(handler);
  }

  console.log('VirusHunt IPC handlers unregistered');
}
