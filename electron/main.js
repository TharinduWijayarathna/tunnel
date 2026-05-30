const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

const DASHBOARD_PORT = 4040;
let mainWindow = null;
let serverInstance = null;
let tunnelManagerInstance = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 800,
    minHeight: 500,
    title: 'Tunnel',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#f7f7f6',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
  });

  // Load the dashboard once the server is ready
  mainWindow.loadURL(`http://localhost:${DASHBOARD_PORT}`);

  // Show window when ready to avoid white flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function startServer() {
  return new Promise((resolve, reject) => {
    try {
      const createApp = require('../src/server');
      const { app: expressApp, tunnelManager } = createApp();

      tunnelManagerInstance = tunnelManager;

      serverInstance = expressApp.listen(DASHBOARD_PORT, '0.0.0.0', () => {
        console.log(`[Tunnel] Server running on port ${DASHBOARD_PORT}`);
        resolve();
      });

      serverInstance.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          // Port already in use — likely the CLI version is running, just load it
          console.log(`[Tunnel] Port ${DASHBOARD_PORT} already in use, connecting to existing server`);
          resolve();
        } else {
          reject(err);
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}

async function shutdown() {
  console.log('[Tunnel] Shutting down...');
  if (tunnelManagerInstance) {
    try {
      await tunnelManagerInstance.destroyAll();
    } catch (e) {
      console.error('[Tunnel] Error destroying tunnels:', e);
    }
  }
  if (serverInstance) {
    serverInstance.close();
  }
}

// ─── App Lifecycle ───────────────────────────────────────────────────

app.whenReady().then(async () => {
  try {
    await startServer();
    createWindow();
  } catch (err) {
    console.error('[Tunnel] Failed to start:', err);
    app.quit();
  }

  app.on('activate', () => {
    // macOS: re-create window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // On macOS, keep app in dock unless explicitly quit
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async (e) => {
  e.preventDefault();
  await shutdown();
  app.exit(0);
});
