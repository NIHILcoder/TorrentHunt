/**
 * Watch Folder Service
 * Monitors a directory for new .torrent files and auto-adds them to downloads.
 */

import fs from 'fs';
import path from 'path';
import { logger } from '../utils';
import { getTorrentManager } from './manager';

const log = logger.child('WatchFolder');

export class WatchFolderService {
  private watcher: fs.FSWatcher | null = null;
  private watchPath: string = '';
  private deleteAfterAdd: boolean = false;
  private processing: Set<string> = new Set();

  get isActive(): boolean {
    return this.watcher !== null;
  }

  get currentPath(): string {
    return this.watchPath;
  }

  start(folderPath: string, deleteAfterAdd: boolean): void {
    this.stop();

    if (!folderPath || folderPath.trim() === '') {
      log.warn('Watch folder path is empty, not starting');
      return;
    }

    // Ensure directory exists
    try {
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
        log.info('Created watch folder', { path: folderPath });
      }
    } catch (err) {
      log.error('Failed to create watch folder', { path: folderPath, error: err });
      return;
    }

    this.watchPath = folderPath;
    this.deleteAfterAdd = deleteAfterAdd;

    log.info('Starting watch folder service', { path: folderPath, deleteAfterAdd });

    // Process any existing .torrent files first
    this.scanExisting().catch(err => {
      log.error('Error scanning existing files', { error: err });
    });

    // Watch for new files
    try {
      this.watcher = fs.watch(folderPath, { persistent: false }, (eventType, filename) => {
        if (!filename) return;
        if (!filename.endsWith('.torrent')) return;
        if (eventType !== 'rename' && eventType !== 'change') return;

        const filePath = path.join(folderPath, filename);

        // Small delay to ensure file is fully written
        setTimeout(() => {
          this.handleNewTorrent(filePath).catch(err => {
            log.error('Error handling new torrent in watch folder', { filePath, error: err });
          });
        }, 500);
      });

      this.watcher.on('error', (err) => {
        log.error('Watch folder watcher error', { error: err });
        this.stop();
      });

      log.info('Watch folder service started', { path: folderPath });
    } catch (err) {
      log.error('Failed to start watching folder', { path: folderPath, error: err });
    }
  }

  stop(): void {
    if (this.watcher) {
      try {
        this.watcher.close();
      } catch (_) { /* ignore */ }
      this.watcher = null;
      log.info('Watch folder service stopped');
    }
    this.watchPath = '';
    this.processing.clear();
  }

  private async scanExisting(): Promise<void> {
    try {
      const files = fs.readdirSync(this.watchPath);
      const torrentFiles = files.filter(f => f.endsWith('.torrent'));

      log.info(`Found ${torrentFiles.length} existing .torrent files in watch folder`);

      for (const filename of torrentFiles) {
        const filePath = path.join(this.watchPath, filename);
        await this.handleNewTorrent(filePath);
      }
    } catch (err) {
      log.error('Error scanning watch folder', { error: err });
    }
  }

  private async handleNewTorrent(filePath: string): Promise<void> {
    // Avoid processing the same file twice (fs.watch can fire multiple times)
    if (this.processing.has(filePath)) return;
    if (!fs.existsSync(filePath)) return;

    this.processing.add(filePath);

    try {
      log.info('Watch folder: found new torrent', { filePath });

      const manager = getTorrentManager();
      await manager.addDownload({
        sourceType: 'torrent_file',
        sourceUri: filePath,
      });

      log.info('Watch folder: added torrent successfully', { filePath });

      if (this.deleteAfterAdd) {
        try {
          fs.unlinkSync(filePath);
          log.debug('Watch folder: deleted .torrent after adding', { filePath });
        } catch (err) {
          log.warn('Watch folder: failed to delete .torrent after adding', { filePath, error: err });
        }
      }
    } catch (err: any) {
      // Duplicate errors are expected and non-fatal
      if (err?.code === 'DUPLICATE') {
        log.debug('Watch folder: torrent already in downloads (skipping)', { filePath });
      } else {
        log.error('Watch folder: failed to add torrent', { filePath, error: err });
      }
    } finally {
      // Remove from processing set after a delay to handle rapid duplicate events
      setTimeout(() => {
        this.processing.delete(filePath);
      }, 5000);
    }
  }
}

// Singleton
let watchFolderService: WatchFolderService | null = null;

export function getWatchFolderService(): WatchFolderService {
  if (!watchFolderService) {
    watchFolderService = new WatchFolderService();
  }
  return watchFolderService;
}
