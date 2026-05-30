import { app, BrowserWindow, Tray, Menu, nativeImage } from 'electron';
import path from 'path';
import dotenv from 'dotenv';
import { getTorrentManager } from './torrent';
import { getCollaborativeSeedingManager } from './seeding';
import { getSchedulerEngine } from './scheduler/scheduler-engine';
import { setupIpcHandlers } from './ipc';
import { logger, detectVPN, showVPNWarning } from './utils';
import { store } from './db/store';
import { getRSSService } from './services/rss-service';
import { getIPBlocklistService } from './services/ip-blocklist';
import { getWatchFolderService } from './torrent/watch-folder';


// Load environment variables
dotenv.config();

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

// === Single Instance Lock ===
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, commandLine) => {
    // Someone tried to run a second instance — focus existing window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }

    // Handle protocol/file arguments from second instance
    const arg = commandLine.find(a => a.startsWith('magnet:') || a.endsWith('.torrent'));
    if (arg && mainWindow) {
      mainWindow.webContents.send('app:openTorrent', arg);
    }
  });
}

// === Register magnet: protocol handler ===
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('magnet', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('magnet');
}

// === Tray Icon ===
function createTray(): void {
  // Create a simple 16x16 tray icon programmatically
  const iconSize = 16;
  
  // Use a simple colored square as tray icon — or load from file if available
  const iconPath = path.join(__dirname, '../../assets/tray-icon.png');
  let trayIcon: Electron.NativeImage;
  
  try {
    const fs = require('fs');
    if (fs.existsSync(iconPath)) {
      trayIcon = nativeImage.createFromPath(iconPath);
    } else {
      // Fallback: create a small colored icon programmatically
      trayIcon = nativeImage.createFromBuffer(
        Buffer.from(createTrayIconPNG()),
        { width: iconSize, height: iconSize }
      );
    }
  } catch {
    // Final fallback
    trayIcon = nativeImage.createFromBuffer(
      Buffer.from(createTrayIconPNG()),
      { width: iconSize, height: iconSize }
    );
  }

  tray = new Tray(trayIcon.resize({ width: 16, height: 16 }));
  tray.setToolTip('TorrentHunt — Running in background');

  const buildContextMenu = () => Menu.buildFromTemplate([
    {
      label: 'Open TorrentHunt',
      type: 'normal',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
          if (mainWindow.isMinimized()) mainWindow.restore();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Pause All Downloads',
      type: 'normal',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('app:pauseAll');
        }
      },
    },
    {
      label: 'Resume All Downloads',
      type: 'normal',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('app:resumeAll');
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit TorrentHunt',
      type: 'normal',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(buildContextMenu());

  // Rebuild menu when needed (e.g., after settings change)
  tray.on('right-click', () => {
    tray?.setContextMenu(buildContextMenu());
  });

  tray.on('double-click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

/**
 * Create a simple 16x16 tray icon as raw RGBA PNG data
 * This creates a simple blue circle icon
 */
function createTrayIconPNG(): number[] {
  // Simple 16x16 RGBA buffer (blue circle)
  const size = 16;
  const data: number[] = [];
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 1;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist <= r) {
        // Blue color (#3b82f6)
        data.push(59, 130, 246, 255);
      } else {
        // Transparent
        data.push(0, 0, 0, 0);
      }
    }
  }
  return data;
}

async function createWindow(): Promise<void> {
  // Check if we should start hidden (launched at login with openAsHidden)
  const loginSettings = app.getLoginItemSettings();
  const startHidden = loginSettings.wasOpenedAsHidden === true;

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: !startHidden, // Don't show window if launched hidden at startup
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    title: 'TorrentHunt',
    backgroundColor: '#0B0E17',
  });

  // Setup IPC handlers
  setupIpcHandlers(mainWindow);

  // In development, load from webpack dev server
  const isDev = process.env.NODE_ENV === 'development';
  
  if (isDev) {
    await mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    // __dirname is dist/electron/electron/ due to tsconfig rootDir
    await mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'));
    // No DevTools in production
  }

  // Show window once ready (after content loaded) if not starting hidden
  if (!startHidden) {
    mainWindow.once('ready-to-show', () => {
      mainWindow?.show();
    });
  }

  // === Tray behavior: Minimize to Tray ===
  mainWindow.on('minimize', (event: Electron.Event) => {
    const settings = store.get('settings') as any;
    if (settings?.minimizeToTray) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  // === Tray behavior: Close to Tray ===
  mainWindow.on('close', (event: Electron.Event) => {
    if (!isQuitting) {
      const settings = store.get('settings') as any;
      if (settings?.closeToTray) {
        event.preventDefault();
        mainWindow?.hide();
        // Update tray tooltip to indicate background mode
        tray?.setToolTip('TorrentHunt — Running in background');
      }
    }
  });

  mainWindow.on('show', () => {
    tray?.setToolTip('TorrentHunt');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle startup arguments (magnet links, .torrent files)
  const startupArg = process.argv.find(a => a.startsWith('magnet:') || a.endsWith('.torrent'));
  if (startupArg) {
    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow?.webContents.send('app:openTorrent', startupArg);
    });
  }
}

async function initializeApp(): Promise<void> {
  // Disable GPU shader disk cache to prevent cache access errors
  app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
  
  // Initialize logger first
  logger.initialize({
    minLevel: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  });
  
  logger.info('App', 'TorrentHunt starting...');

  // Initialize torrent manager (which will use electron-store)
  const torrentManager = getTorrentManager();
  await torrentManager.initialize();
  logger.info('App', 'Torrent manager initialized with electron-store.');

  // Initialize collaborative seeding manager
  const seedingManager = getCollaborativeSeedingManager();
  await seedingManager.initialize();
  logger.info('App', 'Collaborative Seeding Manager initialized.');

  // Start scheduler engine
  const scheduler = getSchedulerEngine();
  scheduler.start();
  logger.info('App', 'Scheduler engine started.');

  // Create system tray
  createTray();
  logger.info('App', 'System tray created.');

  // Create main window
  await createWindow();
  logger.info('App', 'Main window created.');

  // Apply auto-launch setting
  const settings = store.get('settings') as any;
  if (settings?.autoLaunch !== undefined) {
    app.setLoginItemSettings({ openAtLogin: settings.autoLaunch });
  }

  // Initialize IP blocklist (load from store, apply to client)
  try {
    const torrentManager = getTorrentManager();
    const blocklistService = getIPBlocklistService();
    await blocklistService.loadAll();
    blocklistService.applyToClient((torrentManager as any).client);
    logger.info('App', 'IP blocklist service initialized.');
  } catch (e) {
    logger.error('App', 'Failed to initialize IP blocklist', { error: e });
  }

  // Initialize RSS service
  try {
    const rssService = getRSSService();
    await rssService.initialize();
    logger.info('App', 'RSS service initialized.');
  } catch (e) {
    logger.error('App', 'Failed to initialize RSS service', { error: e });
  }

  // Initialize watch folder
  try {
    if (settings?.watchFolderEnabled && settings?.watchFolderPath) {
      const watchFolder = getWatchFolderService();
      watchFolder.start(settings.watchFolderPath, settings.watchFolderDeleteAfterAdd ?? false);
      logger.info('App', 'Watch folder service started.', { path: settings.watchFolderPath });
    }
  } catch (e) {
    logger.error('App', 'Failed to initialize watch folder', { error: e });
  }

  // Check VPN status on startup
  setTimeout(async () => {
    try {
      logger.info('App', 'Checking VPN status...');
      const vpnResult = await detectVPN();

      if (!vpnResult.isVPNActive) {
        logger.warn('App', 'VPN not detected!', {
          confidence: vpnResult.confidence,
        });
        // Show warning dialog
        showVPNWarning(vpnResult);
      } else {
        logger.info('App', 'VPN detected', {
          provider: vpnResult.details.vpnProvider,
          confidence: vpnResult.confidence,
          interfaces: vpnResult.details.detectedInterfaces,
        });
      }
    } catch (error) {
      logger.error('App', 'Failed to check VPN status', { error });
    }
  }, 2000); // Delay to let UI load first
}

app.whenReady().then(initializeApp);

app.on('window-all-closed', async () => {
  // On macOS, keep app running until explicitly quit
  if (process.platform !== 'darwin') {
    // Don't quit if close-to-tray is enabled — app keeps running in tray
    const settings = store.get('settings') as any;
    if (settings?.closeToTray && !isQuitting) {
      // App continues running in the system tray
      logger.info('App', 'Window closed — continuing in system tray');
      return;
    }
    await cleanup();
    app.quit();
  }
});

app.on('activate', async () => {
  // On macOS, recreate window when dock icon is clicked
  if (mainWindow === null) {
    await createWindow();
  }
});

app.on('before-quit', async (event) => {
  isQuitting = true;
  event.preventDefault();
  await cleanup();
  app.exit(0);
});

async function cleanup(): Promise<void> {
  logger.info('App', 'Cleaning up...');

  // Check if clearDataOnExit is enabled
  try {
    const privacyConfig = (store.get('privacyConfig') as any) || {};
    if (privacyConfig.clearDataOnExit) {
      logger.info('App', 'clearDataOnExit enabled — removing logs and temp files');
      const fs = require('fs');
      const pathMod = require('path');

      // Remove copied .torrent files
      const torrentsDir = pathMod.join(app.getPath('userData'), 'torrents');
      if (fs.existsSync(torrentsDir)) {
        fs.rmSync(torrentsDir, { recursive: true, force: true });
        logger.info('App', 'Deleted temp torrent files');
      }

      // Remove log files
      const logsDir = pathMod.join(app.getPath('userData'), 'logs');
      if (fs.existsSync(logsDir)) {
        fs.rmSync(logsDir, { recursive: true, force: true });
        logger.info('App', 'Deleted log files');
      }
    }
  } catch (e) {
    logger.error('App', 'Error during clearDataOnExit', { error: e });
  }

  try {
    const torrentManager = getTorrentManager();
    await torrentManager.destroy();
    logger.info('App', 'Torrent manager destroyed.');
  } catch (e) {
    logger.error('App', 'Error destroying torrent manager', { error: e });
  }

  try {
    const seedingManager = getCollaborativeSeedingManager();
    seedingManager.destroy();
    logger.info('App', 'Collaborative Seeding Manager destroyed.');
  } catch (e) {
    logger.error('App', 'Error destroying seeding manager', { error: e });
  }

  // Stop scheduler
  try {
    const scheduler = getSchedulerEngine();
    scheduler.destroy();
    logger.info('App', 'Scheduler engine destroyed.');
  } catch (e) {
    logger.error('App', 'Error destroying scheduler', { error: e });
  }

  // Stop RSS service
  try {
    const rssService = getRSSService();
    rssService.destroy();
    logger.info('App', 'RSS service destroyed.');
  } catch (e) {
    logger.error('App', 'Error destroying RSS service', { error: e });
  }

  // Stop watch folder
  try {
    const watchFolder = getWatchFolderService();
    watchFolder.stop();
    logger.info('App', 'Watch folder service stopped.');
  } catch (e) {
    logger.error('App', 'Error stopping watch folder', { error: e });
  }

  // Destroy tray
  if (tray) {
    tray.destroy();
    tray = null;
  }

  // electron-store doesn't need cleanup like database pool
  logger.info('App', 'electron-store will auto-save on exit.');

  logger.close();
}
