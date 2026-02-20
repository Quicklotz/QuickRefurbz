import { app, BrowserWindow, shell, ipcMain, globalShortcut } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as path from 'path';
import * as fs from 'fs';
import * as net from 'net';
import { execFile } from 'child_process';
import * as os from 'os';

interface StationConfig {
  stationId: string;
  email: string;
  password: string;
  kioskMode: boolean;
  apiBase?: string;
  adminPin?: string;
  githubToken?: string;
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

  // Auto-updater for private GitHub releases — token from env or station config
  const ghToken = stationConfig?.apiBase
    ? undefined  // skip updates when using custom API base
    : process.env.GH_TOKEN || process.env.GITHUB_TOKEN || stationConfig?.githubToken;
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
  const { password, adminPin, githubToken, ...safeConfig } = stationConfig;
  return safeConfig;
});

ipcMain.handle('get-station-credentials', () => {
  if (!stationConfig) return null;
  if (!stationConfig.email || !stationConfig.password) return null;
  return { email: stationConfig.email, password: stationConfig.password };
});

ipcMain.handle('save-credentials', (_event, email: string, password: string) => {
  const configDir = path.join(app.getPath('appData'), 'QuickRefurbz');
  const configPath = path.join(configDir, 'station-config.json');
  try {
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    // Merge with existing config or create new
    const existing = stationConfig || {} as StationConfig;
    const updated = { ...existing, email, password };
    fs.writeFileSync(configPath, JSON.stringify(updated, null, 2), 'utf-8');
    stationConfig = updated;
    return true;
  } catch (err) {
    console.error('Failed to save credentials:', err);
    return false;
  }
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

// List available printers on this machine
ipcMain.handle('get-printers', async () => {
  if (!mainWindow) return [];
  const printers = mainWindow.webContents.getPrintersAsync
    ? await mainWindow.webContents.getPrintersAsync()
    : (mainWindow.webContents as any).getPrinters?.() || [];
  return printers.map((p: any) => ({
    name: p.name,
    isDefault: p.isDefault,
    status: p.status,
  }));
});

// Send ZPL to a printer — auto-detects TCP (IP address) vs USB (printer name)
ipcMain.handle('send-zpl', async (_event, printerTarget: string, zpl: string) => {
  // If it looks like an IP address, use raw TCP on port 9100
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(printerTarget)) {
    return new Promise<boolean>((resolve, reject) => {
      let settled = false;
      const done = (ok: boolean, err?: string) => {
        if (settled) return;
        settled = true;
        ok ? resolve(true) : reject(new Error(err || 'Print failed'));
      };

      const socket = new net.Socket();
      socket.connect(9100, printerTarget, () => {
        socket.write(zpl, () => { socket.end(); });
      });
      socket.on('close', () => done(true));
      socket.on('error', (err) => {
        socket.destroy();
        done(false, `Cannot reach printer at ${printerTarget}:9100 — ${err.message}`);
      });
      socket.setTimeout(10000, () => {
        socket.destroy();
        done(false, `Printer at ${printerTarget} did not respond (timeout)`);
      });
    });
  }

  // Otherwise it's a printer name — use Windows raw print via PowerShell
  if (process.platform !== 'win32') {
    throw new Error('USB raw printing is only supported on Windows. Use the browser print dialog on Mac.');
  }

  return new Promise<boolean>((resolve, reject) => {
    // Write ZPL to temp file
    const tmpFile = path.join(os.tmpdir(), `qr-label-${Date.now()}.zpl`);
    fs.writeFileSync(tmpFile, zpl, 'utf-8');

    const psScript = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class RawPrint {
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
    public struct DOCINFO {
        [MarshalAs(UnmanagedType.LPWStr)] public string name;
        [MarshalAs(UnmanagedType.LPWStr)] public string output;
        [MarshalAs(UnmanagedType.LPWStr)] public string type;
    }
    [DllImport("winspool.drv", CharSet=CharSet.Unicode, SetLastError=true)]
    public static extern bool OpenPrinter(string p, out IntPtr h, IntPtr d);
    [DllImport("winspool.drv", SetLastError=true)]
    public static extern bool ClosePrinter(IntPtr h);
    [DllImport("winspool.drv", CharSet=CharSet.Unicode, SetLastError=true)]
    public static extern bool StartDocPrinter(IntPtr h, int l, ref DOCINFO di);
    [DllImport("winspool.drv", SetLastError=true)]
    public static extern bool EndDocPrinter(IntPtr h);
    [DllImport("winspool.drv", SetLastError=true)]
    public static extern bool StartPagePrinter(IntPtr h);
    [DllImport("winspool.drv", SetLastError=true)]
    public static extern bool EndPagePrinter(IntPtr h);
    [DllImport("winspool.drv", SetLastError=true)]
    public static extern bool WritePrinter(IntPtr h, IntPtr b, int c, out int w);
    public static bool Send(string printer, string data) {
        IntPtr h;
        if (!OpenPrinter(printer, out h, IntPtr.Zero)) return false;
        var di = new DOCINFO { name="QuickRefurbz Label", type="RAW" };
        if (!StartDocPrinter(h, 1, ref di)) { ClosePrinter(h); return false; }
        StartPagePrinter(h);
        var bytes = System.Text.Encoding.UTF8.GetBytes(data);
        var ptr = Marshal.AllocCoTaskMem(bytes.Length);
        Marshal.Copy(bytes, 0, ptr, bytes.Length);
        int w; WritePrinter(h, ptr, bytes.Length, out w);
        Marshal.FreeCoTaskMem(ptr);
        EndPagePrinter(h); EndDocPrinter(h); ClosePrinter(h);
        return w == bytes.Length;
    }
}
"@
\\$zpl = Get-Content -Raw '${tmpFile.replace(/\\/g, '\\\\')}'
\\$result = [RawPrint]::Send('${printerTarget.replace(/'/g, "''")}', \\$zpl)
Remove-Item '${tmpFile.replace(/\\/g, '\\\\')}' -ErrorAction SilentlyContinue
if (\\$result) { Write-Output 'OK' } else { Write-Error 'Failed to send to printer'; exit 1 }
`;

    execFile('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psScript], { timeout: 15000 }, (err, stdout, stderr) => {
      // Clean up temp file just in case
      try { fs.unlinkSync(tmpFile); } catch {}

      if (err) {
        reject(new Error(`Print failed: ${stderr || err.message}`));
      } else if (stdout.trim().includes('OK')) {
        resolve(true);
      } else {
        reject(new Error(`Print failed: ${stderr || 'Unknown error'}`));
      }
    });
  });
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
