import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getVersion: () => ipcRenderer.invoke('get-version'),
  getStationConfig: () => ipcRenderer.invoke('get-station-config'),
  unlockKiosk: (pin: string) => ipcRenderer.invoke('unlock-kiosk', pin),
  onUpdateAvailable: (callback: () => void) =>
    ipcRenderer.on('update-available', callback),
  onUpdateDownloaded: (callback: () => void) =>
    ipcRenderer.on('update-downloaded', callback),
  installUpdate: () => ipcRenderer.send('install-update'),
  isElectron: true,
});
