const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ring', {
  onShowRing: (cb) => ipcRenderer.on('show-ring', (_, data) => cb(data)),
  executeAction: (action) => ipcRenderer.send('execute-action', action),
  close: () => ipcRenderer.send('close-ring'),
  log: (msg) => ipcRenderer.send('renderer-log', msg),
  windowManage: (pos) => ipcRenderer.send('window-manage', pos),
});

contextBridge.exposeInMainWorld('settings', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  getRunningApps: () => ipcRenderer.invoke('get-running-apps'),
  getClipboardHistory: () => ipcRenderer.invoke('get-clipboard-history'),
  getTheme: () => ipcRenderer.invoke('get-theme'),
});
