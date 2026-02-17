import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getVersion: () => ipcRenderer.invoke('get-version'),
  onUpdateAvailable: (callback: () => void) =>
    ipcRenderer.on('update-available', callback),
  onUpdateDownloaded: (callback: () => void) =>
    ipcRenderer.on('update-downloaded', callback),
  installUpdate: () => ipcRenderer.send('install-update'),
  isElectron: true,
});
