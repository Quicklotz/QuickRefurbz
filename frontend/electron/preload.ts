import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getVersion: () => ipcRenderer.invoke('get-version'),
  getStationConfig: () => ipcRenderer.invoke('get-station-config'),
  unlockKiosk: (pin: string) => ipcRenderer.invoke('unlock-kiosk', pin),
  onUpdateAvailable: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('update-available', listener);
    return () => { ipcRenderer.removeListener('update-available', listener); };
  },
  onUpdateDownloaded: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('update-downloaded', listener);
    return () => { ipcRenderer.removeListener('update-downloaded', listener); };
  },
  installUpdate: () => ipcRenderer.send('install-update'),
  isElectron: true,
});
