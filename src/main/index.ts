import { join, resolve as resolvePath } from 'node:path';
import { app, BrowserWindow, ipcMain, shell } from 'electron';

const PROTOCOL = 'b-chess';
let mainWindow: BrowserWindow | null = null;

function handleProtocolUrl(url: string): void {
  mainWindow?.webContents.send('auth-callback', url);
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 900,
    minHeight: 680,
    backgroundColor: '#1b1a17',
    title: 'B-Chess',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
    },
  });

  if (process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

if (!app.requestSingleInstanceLock()) {
  // Another instance is already running — Windows/Linux hand us the b-chess:// URL as an argv, and
  // the *other* (already-running) instance receives 'second-instance' below; this one just exits.
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const url = argv.find((arg) => arg.startsWith(`${PROTOCOL}://`));
    if (url) handleProtocolUrl(url);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.on('open-url', (event, url) => {
    // macOS delivers the protocol URL this way instead of via argv.
    event.preventDefault();
    handleProtocolUrl(url);
  });

  ipcMain.handle('open-external', (_event, url: string) => {
    void shell.openExternal(url);
  });

  app.whenReady().then(() => {
    // Unpacked/dev runs (`electron-vite dev`/`preview`) launch via the generic electron.exe binary, so
    // the OS must be told to re-invoke it with this app's own script path — otherwise Windows hands the
    // protocol URL to electron.exe as if it *were* the app path to load, and it errors out immediately.
    // Packaged builds don't need this: the installed executable *is* the app, argv passes straight
    // through, and electron-builder's own `protocols:` config (electron-builder.yml) registers it.
    if (process.defaultApp && process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [resolvePath(process.argv[1])]);
    } else {
      app.setAsDefaultProtocolClient(PROTOCOL);
    }
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });

    // Cold start: the OS launched this process *carrying* the protocol URL (Windows/Linux hand it via
    // argv, not via 'second-instance' — that event only fires for a *second* launch attempt while one
    // is already running). Deliver it once the renderer has actually loaded and is listening, or the
    // IPC send above would fire into a page that hasn't registered its onAuthCallback listener yet.
    const initialUrl = process.argv.find((arg) => arg.startsWith(`${PROTOCOL}://`));
    if (initialUrl) {
      mainWindow?.webContents.once('did-finish-load', () => handleProtocolUrl(initialUrl));
    }
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
