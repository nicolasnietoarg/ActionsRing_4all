const { contextBridge, ipcRenderer } = require('electron');

// Preload exclusivo de la ventana del anillo. No expone la API de
// configuración: antes el overlay podía llamar saveConfig y leer el
// historial del portapapeles sin necesitarlo.
let showRingHandler = null;

contextBridge.exposeInMainWorld('ring', {
  // Un solo listener por ventana: si el componente se vuelve a montar, el
  // anterior se descarta en lugar de acumularse.
  onShowRing: (cb) => {
    if (showRingHandler) ipcRenderer.removeListener('show-ring', showRingHandler);
    showRingHandler = (_event, data) => cb(data);
    ipcRenderer.on('show-ring', showRingHandler);
  },
  executeAction: (action) => ipcRenderer.send('execute-action', action),
  executeMacro: (macro) => ipcRenderer.send('execute-macro', macro),
  close: () => ipcRenderer.send('close-ring'),
  log: (msg) => ipcRenderer.send('renderer-log', msg),
  // Le avisa al main que el anillo ya puede recibir mensajes.
  ready: () => ipcRenderer.send('ring-ready'),
});
