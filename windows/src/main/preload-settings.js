const { contextBridge, ipcRenderer } = require('electron');

// Preload exclusivo de la ventana de Settings.
contextBridge.exposeInMainWorld('settings', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  getRunningApps: () => ipcRenderer.invoke('get-running-apps'),
  getClipboardHistory: () => ipcRenderer.invoke('get-clipboard-history'),
  clearClipboardHistory: () => ipcRenderer.invoke('clear-clipboard-history'),
  getConfigPath: () => ipcRenderer.invoke('get-config-path'),
  openConfigFolder: () => ipcRenderer.invoke('open-config-folder'),
  // Devuelve las teclas de un combo que el motor de SendInput no sabe
  // reproducir, para avisar antes de guardar una macro con pasos muertos.
  validateKeys: (combo) => ipcRenderer.invoke('validate-keys', combo),
  startRecording: () => ipcRenderer.invoke('start-recording'),
  stopRecording: () => ipcRenderer.invoke('stop-recording'),
});
