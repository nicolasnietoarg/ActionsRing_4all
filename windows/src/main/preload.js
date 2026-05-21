const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ring', {
  onShowRing: (cb) => ipcRenderer.on('show-ring', (_, data) => cb(data)),
  executeAction: (action) => ipcRenderer.send('execute-action', action),
  executeMacro: (macro) => ipcRenderer.send('execute-macro', macro),
  close: () => ipcRenderer.send('close-ring'),
  log: (msg) => ipcRenderer.send('renderer-log', msg),
});

contextBridge.exposeInMainWorld('settings', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  getRunningApps: () => ipcRenderer.invoke('get-running-apps'),
  getClipboardHistory: () => ipcRenderer.invoke('get-clipboard-history'),
  getTheme: () => ipcRenderer.invoke('get-theme'),
  startRecording: () => ipcRenderer.invoke('start-recording'),
  stopRecording: () => ipcRenderer.invoke('stop-recording'),
  saveMacro: (macro) => ipcRenderer.invoke('save-macro', macro),
  deleteMacro: (index) => ipcRenderer.invoke('delete-macro', index),
  getMacros: () => ipcRenderer.invoke('get-macros'),
});
