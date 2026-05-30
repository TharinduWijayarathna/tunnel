const { app, BrowserWindow, shell, nativeImage, Tray, Menu } = require('electron');
const path = require('path');

const DASHBOARD_PORT = 4040;
let mainWindow = null;
let tray = null;
let serverInstance = null;
let tunnelManagerInstance = null;

function getIconPath() {
  // Use build/icon.png for all platforms
  const iconPath = path.join(__dirname, '..', 'build', 'icon.png');
  return iconPath;
}

function createWindow() {
  const isMac = process.platform === 'darwin';
  const isWin = process.platform === 'win32';

  const windowOptions = {
    width: 1100,
    height: 750,
    minWidth: 800,
    minHeight: 500,
    title: 'Tunnel',
    backgroundColor: '#f7f7f6',
    icon: getIconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
  };

  // macOS-specific: hidden title bar with inset traffic lights
  if (isMac) {
    windowOptions.titleBarStyle = 'hiddenInset';
    windowOptions.trafficLightPosition = { x: 16, y: 16 };
  }

  // Windows/Linux: use default frame
  // (standard title bar with native window controls)

  mainWindow = new BrowserWindow(windowOptions);

  // Load the dashboard once the server is ready
  mainWindow.loadURL(`http://localhost:${DASHBOARD_PORT}`);

  // Show window when ready to avoid white flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
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

function createTray() {
  const icon = nativeImage.createFromPath(getIconPath()).resize({ width: 18, height: 18 });
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Tunnel',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit Tunnel',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setToolTip('Tunnel — Local Network Exposure');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    } else {
      createWindow();
    }
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
    createTray();
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
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async (e) => {
  e.preventDefault();
  await shutdown();
  app.exit(0);
});
