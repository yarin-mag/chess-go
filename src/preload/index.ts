import { contextBridge, ipcRenderer } from 'electron';
import { AuthCallbackRelay } from './authCallbackRelay';

// Registered once, at preload load time — guaranteed to exist before the renderer's own script runs,
// so a cold-start URL delivered before AuthGateScreen mounts and subscribes is buffered, not dropped.
const relay = new AuthCallbackRelay();
ipcRenderer.on('auth-callback', (_event, url: string) => relay.deliver(url));

contextBridge.exposeInMainWorld('electronAuth', {
  openExternalSignIn: (url: string) => ipcRenderer.invoke('open-external', url),
  onAuthCallback: (callback: (url: string) => void) => relay.subscribe(callback),
});
