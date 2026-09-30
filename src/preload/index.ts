import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAuth', {
  openExternalSignIn: (url: string) => ipcRenderer.invoke('open-external', url),
  onAuthCallback: (callback: (url: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, url: string) => callback(url);
    ipcRenderer.on('auth-callback', handler);
    return () => ipcRenderer.off('auth-callback', handler);
  },
});
