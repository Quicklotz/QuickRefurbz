import { app, BrowserWindow, shell, ipcMain, globalShortcut } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as path from 'path';
import * as fs from 'fs';

interface StationConfig {
  stationId: string;
  email: string;
  password: string;
  kioskMode: boolean;
  apiBase?: string;
  adminPin?: string;
}

let mainWindow: BrowserWindow | null = null;
let stationConfig: StationConfig | null = null;
let kioskActive = false;

function loadStationConfig(): StationConfig | null {
  const configDir = path.join(app.getPath('appData'), 'QuickRefurbz');
  const configPath = path.join(configDir, 'station-config.json');
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
  } catch (err) {
    console.error('Failed to load station config:', err);
  }
  return null;
}

function createWindow() {
  stationConfig = loadStationConfig();
  kioskActive = stationConfig?.kioskMode === true;

  const windowOptions: Electron.BrowserWindowConstructorOptions = {
    width: 1280,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'QuickRefurbz',
    icon: app.isPackaged
      ? path.join(process.resourcesPath, 'icon.ico')
      : path.join(__dirname, '../../assets/icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    autoHideMenuBar: true,
  };

  if (kioskActive) {
    windowOptions.kiosk = true;
    windowOptions.fullscreen = true;
    windowOptions.closable = false;
    windowOptions.minimizable = false;
  }

  mainWindow = new BrowserWindow(windowOptions);

  // Load the built frontend from dist/
  mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));

  // Disable DevTools shortcuts in production
  if (app.isPackaged) {
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'F12' ||
          (input.control && input.shift && (input.key === 'I' || input.key === 'J')) ||
          (input.control && input.shift && input.key === 'C')) {
        event.preventDefault();
      }
    });
  }

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Prevent navigation to external URLs
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // Prevent closing in kiosk mode (catches Alt+F4 at the window level)
  mainWindow.on('close', (e) => {
    if (kioskActive) {
      e.preventDefault();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Block close shortcuts in kiosk mode
  if (kioskActive) {
    globalShortcut.register('Alt+F4', () => {});
    globalShortcut.register('CommandOrControl+W', () => {});
    globalShortcut.register('CommandOrControl+Q', () => {});
    globalShortcut.register('F12', () => {});
    globalShortcut.register('CommandOrControl+Shift+I', () => {});
    globalShortcut.register('CommandOrControl+Shift+J', () => {});
    globalShortcut.register('CommandOrControl+R', () => {});
    globalShortcut.register('F5', () => {});
  }
}

app.whenReady().then(() => {
  createWindow();

  // Auto-updater for private GitHub releases — token from station config or env
  const ghToken = stationConfig?.apiBase
    ? undefined  // skip updates when using custom API base
    : process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (ghToken) {
    autoUpdater.requestHeaders = { Authorization: `token ${ghToken}` };
  }
  autoUpdater.autoDownload = false;
  autoUpdater.checkForUpdatesAndNotify().catch(() => {});
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// IPC handlers
ipcMain.handle('get-version', () => app.getVersion());

ipcMain.handle('get-station-config', () => {
  if (!stationConfig) return null;
  const { password, adminPin, ...safeConfig } = stationConfig;
  return safeConfig;
});

ipcMain.handle('unlock-kiosk', (_event, pin: string) => {
  if (!stationConfig?.adminPin) return false;
  if (pin === stationConfig.adminPin) {
    kioskActive = false;
    globalShortcut.unregisterAll();
    if (mainWindow) {
      mainWindow.setKiosk(false);
      mainWindow.setFullScreen(false);
      mainWindow.setClosable(true);
      mainWindow.setMinimizable(true);
    }
    return true;
  }
  return false;
});

ipcMain.on('install-update', () => {
  autoUpdater.quitAndInstall();
});

// Auto-updater events
autoUpdater.on('update-available', () => {
  mainWindow?.webContents.send('update-available');
});

autoUpdater.on('update-downloaded', () => {
  mainWindow?.webContents.send('update-downloaded');
});

autoUpdater.on('error', (err) => {
  console.error('Auto-updater error:', err.message);
});
