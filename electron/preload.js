const { contextBridge } = require('electron');

// Expose minimal API to renderer if needed in the future
contextBridge.exposeInMainWorld('tunnelApp', {
  platform: process.platform,
  isElectron: true,
});
