const { app, BrowserWindow, globalShortcut, ipcMain, screen, Tray, Menu, nativeImage, clipboard, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const koffi = require('koffi');

const keys = require('./keys');
const schema = require('./config-schema');
const vars = require('./variables');

// El nombre debe fijarse ANTES de resolver app.getPath('userData'),
// para que dev y empaquetado compartan la misma carpeta de configuración.
app.setName('Actions Ring');

// --- Win32 API via koffi (sin PowerShell, sin execSync) ---
const user32 = koffi.load('user32.dll');
const kernel32 = koffi.load('kernel32.dll');
const psapi = koffi.load('psapi.dll');

const HWND = koffi.pointer('HWND', koffi.opaque());
const HANDLE = koffi.pointer('HANDLE', koffi.opaque());
const DWORD = koffi.alias('DWORD', 'uint32');
const WNDENUMPROC = koffi.proto('WNDENUMPROC', 'bool', [HWND, 'intptr']);

const GetForegroundWindow = user32.func('GetForegroundWindow', HWND, []);
const GetWindowThreadProcessId = user32.func('GetWindowThreadProcessId', DWORD, [HWND, koffi.out(koffi.pointer('uint32'))]);
const SetForegroundWindow = user32.func('SetForegroundWindow', 'bool', [HWND]);
const OpenProcess = kernel32.func('OpenProcess', HANDLE, [DWORD, 'bool', DWORD]);
const CloseHandle = kernel32.func('CloseHandle', 'bool', [HANDLE]);
const GetModuleBaseNameW = psapi.func('GetModuleBaseNameW', DWORD, [HANDLE, 'void *', 'uint16 *', DWORD]);
const SendInput = user32.func('SendInput', 'uint32', ['uint32', 'void *', 'int32']);
const EnumWindows = user32.func('EnumWindows', 'bool', [koffi.pointer(WNDENUMPROC), 'intptr']);
const IsWindowVisible = user32.func('IsWindowVisible', 'bool', [HWND]);
const GetWindowTextLengthW = user32.func('GetWindowTextLengthW', 'int32', [HWND]);
const GetCurrentThreadId = kernel32.func('GetCurrentThreadId', DWORD, []);
const AttachThreadInput = user32.func('AttachThreadInput', 'bool', [DWORD, DWORD, 'bool']);
const SetFocus = user32.func('SetFocus', HWND, [HWND]);

const PROCESS_QUERY_INFORMATION = 0x0400;
const PROCESS_VM_READ = 0x0010;

// --- Estado global ---
let overlay = null;
let settingsWin = null;
let tray = null;
let config = null;
let lastActiveApp = null;
let lastActiveHwnd = null;
let clipboardHistory = [];
let clipboardTimer = null;
let activeHotkey = null;
let recordingActive = false;
let overlayShownAt = 0;
let overlayReady = false;
let pendingShow = false;

const MAX_CLIPBOARD_HISTORY = 20;

const DEFAULT_PROFILE_ICONS = {
  Spotify: 'Music', chrome: 'Globe', ChatGPT: 'Sparkles', msedge: 'Globe', OUTLOOK: 'Mail',
  notepad: 'StickyNote', WhatsApp: 'MessageCircle', Telegram: 'Send', explorer: 'Folder', Code: 'Code',
};

// ---------------------------------------------------------------------------
// Configuración: vive en %APPDATA%\Actions Ring\config.json
// Antes se escribía junto al .exe, lo que hacía crashear la app si se
// ejecutaba desde un USB protegido o desde Program Files.
// ---------------------------------------------------------------------------
const CONFIG_DIR = app.getPath('userData');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

function bundledConfigPath() {
  const candidates = [
    process.resourcesPath ? path.join(process.resourcesPath, 'config', 'default.json') : null,
    path.join(__dirname, '../../config/default.json'),
  ];
  return candidates.find((p) => p && fs.existsSync(p)) || null;
}

// Ubicaciones de versiones anteriores, para migrar la config del usuario.
function legacyConfigPaths() {
  const list = [];
  if (process.env.PORTABLE_EXECUTABLE_DIR) {
    list.push(path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'config', 'default.json'));
  }
  list.push(path.join(path.dirname(process.execPath), 'config', 'default.json'));
  list.push(path.join(__dirname, '../../config/default.json'));
  return list;
}

function loadConfig() {
  try { fs.mkdirSync(CONFIG_DIR, { recursive: true }); } catch { /* ignorado */ }

  if (!fs.existsSync(CONFIG_FILE)) {
    const legacy = legacyConfigPaths().find((p) => { try { return fs.existsSync(p); } catch { return false; } });
    if (legacy) {
      try { fs.copyFileSync(legacy, CONFIG_FILE); console.log(`[config] migrado desde ${legacy}`); }
      catch (e) { console.error('[config] no se pudo migrar:', e.message); }
    }
  }

  const sources = [CONFIG_FILE, bundledConfigPath()].filter(Boolean);
  for (const src of sources) {
    let raw;
    try { raw = fs.readFileSync(src, 'utf-8'); } catch { continue; }
    try {
      const { config: parsed, changed } = schema.normalizeConfig(JSON.parse(raw));
      config = parsed;
      if (changed || src !== CONFIG_FILE) saveConfig(config);
      return config;
    } catch (e) {
      // Un JSON corrupto dejaba la app sin arrancar y sin forma de recuperarse.
      console.error(`[config] JSON inválido en ${src}: ${e.message}`);
      if (src === CONFIG_FILE) {
        const backup = `${CONFIG_FILE}.bad-${Date.now()}`;
        try { fs.renameSync(CONFIG_FILE, backup); console.error(`[config] respaldado como ${backup}`); } catch { /* ignorado */ }
      }
    }
  }

  console.error('[config] usando defaults embebidos');
  config = schema.normalizeConfig(JSON.parse(JSON.stringify(schema.DEFAULT_CONFIG))).config;
  saveConfig(config);
  return config;
}

// Escritura atómica: se escribe un .tmp y se renombra, así un corte a mitad
// de camino no deja el archivo corrupto.
function saveConfig(newConfig) {
  const { config: normalized } = schema.normalizeConfig(newConfig);
  config = normalized;
  const tmp = `${CONFIG_FILE}.tmp`;
  try {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    fs.writeFileSync(tmp, JSON.stringify(config, null, 2), 'utf-8');
    fs.renameSync(tmp, CONFIG_FILE);
  } catch (e) {
    console.error('[config] error al guardar:', e.message);
    try { fs.unlinkSync(tmp); } catch { /* ignorado */ }
  }
  return config;
}

// ---------------------------------------------------------------------------
// Foco de ventanas
// ---------------------------------------------------------------------------
function focusHwnd(hwnd) {
  if (!hwnd) return false;
  try {
    const pidBuf = [0];
    GetWindowThreadProcessId(hwnd, pidBuf);
    const targetThread = pidBuf[0];
    const ourThread = GetCurrentThreadId();
    if (targetThread && targetThread !== ourThread) {
      AttachThreadInput(ourThread, targetThread, true);
      SetForegroundWindow(hwnd);
      SetFocus(hwnd);
      AttachThreadInput(ourThread, targetThread, false);
    } else {
      SetForegroundWindow(hwnd);
    }
    return true;
  } catch {
    try { SetForegroundWindow(hwnd); return true; } catch { return false; }
  }
}

function restoreFocus() {
  if (lastActiveHwnd) focusHwnd(lastActiveHwnd);
}

// Recorre las ventanas visibles con título y llama a fn(hwnd, processName).
// Devolver true desde fn corta la enumeración.
function forEachWindow(fn) {
  let stop = false;
  const cb = koffi.register((hwnd) => {
    if (stop) return 0; // devolver false corta la enumeración
    try {
      if (!IsWindowVisible(hwnd)) return 1;
      if (GetWindowTextLengthW(hwnd) === 0) return 1;
      const pidBuf = [0];
      GetWindowThreadProcessId(hwnd, pidBuf);
      const pid = pidBuf[0];
      if (!pid) return 1;
      const hProcess = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, false, pid);
      if (!hProcess) return 1;
      const nameBuf = Buffer.alloc(520); // 260 chars * 2 bytes (UTF-16)
      const len = GetModuleBaseNameW(hProcess, null, nameBuf, 260);
      CloseHandle(hProcess);
      if (len > 0) {
        const name = nameBuf.toString('utf16le', 0, len * 2).replace(/\.exe$/i, '');
        if (fn(hwnd, name) === true) { stop = true; return 0; }
      }
    } catch { /* ventana inaccesible, seguir */ }
    return 1;
  }, koffi.pointer(WNDENUMPROC));
  try { EnumWindows(cb, 0); } finally { koffi.unregister(cb); }
}

function focusAppWindow(appName) {
  let target = null;
  const wanted = String(appName || '').toLowerCase();
  forEachWindow((hwnd, name) => {
    if (name.toLowerCase() === wanted) { target = hwnd; return true; }
    return false;
  });
  if (!target) return false;
  return focusHwnd(target);
}

function getActiveApp() {
  try {
    const hwnd = GetForegroundWindow();
    if (!hwnd) return '_default';
    lastActiveHwnd = hwnd;

    const pidBuf = [0];
    GetWindowThreadProcessId(hwnd, pidBuf);
    const pid = pidBuf[0];
    if (!pid) return '_default';

    const hProcess = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, false, pid);
    if (!hProcess) return '_default';

    const nameBuf = Buffer.alloc(520);
    const len = GetModuleBaseNameW(hProcess, null, nameBuf, 260);
    CloseHandle(hProcess);

    if (len === 0) return '_default';
    return nameBuf.toString('utf16le', 0, len * 2).replace(/\.exe$/i, '');
  } catch {
    return '_default';
  }
}

function getRunningApps() {
  const apps = new Set();
  forEachWindow((_hwnd, name) => { apps.add(name); return false; });
  return [...apps].sort((a, b) => a.localeCompare(b));
}

// ---------------------------------------------------------------------------
// Envío de teclas
// ---------------------------------------------------------------------------
function dispatchInputs(events) {
  if (!events.length) return;
  const buf = keys.encodeInputs(events);
  try {
    const sent = SendInput(events.length, buf, keys.INPUT_SIZE);
    if (sent !== events.length) console.error(`[sendKeys] SendInput envió ${sent}/${events.length} eventos`);
  } catch (e) {
    console.error('[sendKeys] SendInput error:', e.message);
  }
}

function sendKeys(combo) {
  const { events, missing } = keys.buildComboEvents(combo);
  if (missing.length) {
    console.error(`[sendKeys] tecla sin mapeo, paso ignorado: "${combo}" (${missing.join(', ')})`);
    return;
  }
  dispatchInputs(events);
}

function typeText(text) {
  dispatchInputs(keys.buildTextEvents(text));
}

function currentVars() {
  const now = new Date();
  let clip = '';
  try { clip = clipboard.readText(); } catch { /* ignorado */ }
  return {
    clipboard: clip,
    date: now.toLocaleDateString(),
    time: now.toLocaleTimeString(),
    datetime: now.toISOString(),
    app: lastActiveApp || '',
  };
}

function executeMacro(steps) {
  for (const step of vars.scheduleMacro(steps)) {
    setTimeout(() => {
      if (step.keys.startsWith('type:')) typeText(vars.expandVariables(step.keys.slice(5), currentVars(), 'raw'));
      else sendKeys(step.keys);
    }, step.at);
  }
}

// ---------------------------------------------------------------------------
// Historial de portapapeles
// ---------------------------------------------------------------------------
let lastClipText = '';

function watchClipboard() {
  if (clipboardTimer) clearInterval(clipboardTimer);
  clipboardTimer = setInterval(() => {
    let text = '';
    try { text = clipboard.readText(); } catch { return; }
    if (!text || text === lastClipText) return;
    lastClipText = text;
    clipboardHistory.unshift(text);
    if (clipboardHistory.length > MAX_CLIPBOARD_HISTORY) clipboardHistory.pop();
  }, 1000);
}

// ---------------------------------------------------------------------------
// Ventanas
// ---------------------------------------------------------------------------
function createOverlay() {
  overlay = new BrowserWindow({
    width: 700,
    height: 700,
    show: false,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    backgroundColor: '#00000000',
    transparent: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload-ring.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  overlay.setAlwaysOnTop(true, 'screen-saver');
  overlay.setVisibleOnAllWorkspaces(true);
  overlay.loadFile(path.join(__dirname, '../renderer/index.html'));

  // Red de seguridad por si el handler de React no corre.
  overlay.webContents.on('before-input-event', (_event, input) => {
    if (input.type === 'keyDown' && input.key === 'Escape') hideOverlay();
  });

  // Si el usuario pasa a otra ventana, el anillo no debe quedar colgado arriba.
  overlay.on('blur', () => {
    if (Date.now() - overlayShownAt < 400) return; // ignorar el blur de la propia apertura
    hideOverlay();
  });
}

function openSettings() {
  if (settingsWin && !settingsWin.isDestroyed()) { settingsWin.show(); settingsWin.focus(); return; }
  settingsWin = new BrowserWindow({
    width: 800,
    height: 620,
    minWidth: 640,
    minHeight: 480,
    title: 'Actions Ring',
    icon: path.join(__dirname, '../../icon.png'),
    backgroundColor: '#0f1923',
    webPreferences: {
      preload: path.join(__dirname, 'preload-settings.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  settingsWin.setMenuBarVisibility(false);
  settingsWin.loadFile(path.join(__dirname, '../settings/index.html'));
  settingsWin.on('closed', () => {
    settingsWin = null;
    // Si se cerró en medio de una grabación, el hotkey quedaba desregistrado.
    if (recordingActive) { recordingActive = false; registerHotkey(config.hotkey); updateTrayTooltip(); }
  });
}

function profileIconFor(name) {
  const custom = (config && config.profileIcons) || {};
  return custom[name] || DEFAULT_PROFILE_ICONS[name] || 'AppWindow';
}

function positionOverlayAtCursor() {
  const cursor = screen.getCursorScreenPoint();
  const area = screen.getDisplayNearestPoint(cursor).workArea;
  const [w, h] = overlay.getSize();
  // Antes se posicionaba sin acotar: en los bordes o en un monitor
  // secundario el anillo quedaba cortado fuera de la pantalla.
  const clamp = (pos, min, size, total) => (
    total < size
      ? Math.round(min + (total - size) / 2)
      : Math.round(Math.min(Math.max(pos, min), min + total - size))
  );
  overlay.setPosition(
    clamp(cursor.x - w / 2, area.x, w, area.width),
    clamp(cursor.y - h / 2, area.y, h, area.height),
  );
}

function hideOverlay() {
  if (!overlay || overlay.isDestroyed()) return;
  // Escape se registra solo mientras el anillo está abierto: registrarlo de
  // forma permanente lo secuestraba para todo el sistema operativo.
  try { globalShortcut.unregister('Escape'); } catch { /* ignorado */ }
  if (overlay.isVisible()) overlay.hide();
}

function showOverlay() {
  // Si el renderer todavía no cargó, el mensaje se perdería y quedaría una
  // ventana transparente en blanco. Se difiere hasta que avise que está listo.
  if (!overlayReady) { pendingShow = true; return; }

  const activeApp = getActiveApp();
  lastActiveApp = activeApp;

  const rolProfiles = (config.rolProfiles || []).map((name) => ({
    name,
    icon: profileIconFor(name),
    actions: schema.profileActionsFor(config, name).slice(0, 6),
  }));

  overlay.webContents.send('show-ring', {
    actions: schema.buildRingActions(config, activeApp),
    activeApp,
    rolProfiles,
    animation: config.animation || {},
    macros: config.macros || [],
  });

  positionOverlayAtCursor();
  overlayShownAt = Date.now();
  overlay.show();
  overlay.focus();
  try { globalShortcut.register('Escape', hideOverlay); } catch { /* ignorado */ }
}

function toggleOverlay() {
  if (!overlay || overlay.isDestroyed()) return;
  if (overlay.isVisible()) hideOverlay();
  else showOverlay();
}

// ---------------------------------------------------------------------------
// Hotkey
// ---------------------------------------------------------------------------
function unregisterHotkey() {
  if (!activeHotkey) return;
  try { globalShortcut.unregister(activeHotkey); } catch { /* ignorado */ }
  activeHotkey = null;
}

// Un accelerator inválido hacía explotar el handler de IPC y dejaba la app sin
// ningún hotkey hasta reiniciar. Ahora se captura y se cae al default.
function registerHotkey(accelerator) {
  unregisterHotkey();
  const attempt = (accel) => {
    if (typeof accel !== 'string' || !accel.trim()) return false;
    try {
      if (globalShortcut.register(accel, toggleOverlay)) { activeHotkey = accel; return true; }
      console.error(`[hotkey] "${accel}" rechazado (¿lo tiene tomado otra app?)`);
    } catch (e) {
      console.error(`[hotkey] "${accel}" inválido: ${e.message}`);
    }
    return false;
  };

  if (attempt(accelerator)) return activeHotkey;
  if (accelerator !== schema.DEFAULT_HOTKEY && attempt(schema.DEFAULT_HOTKEY)) {
    console.error(`[hotkey] usando el default ${schema.DEFAULT_HOTKEY}`);
    return activeHotkey;
  }
  console.error('[hotkey] no se pudo registrar ningún hotkey; usá el ícono del tray');
  return null;
}

function updateTrayTooltip() {
  if (tray && !tray.isDestroyed()) tray.setToolTip(`Actions Ring (${activeHotkey || 'sin hotkey'})`);
}

function createTray() {
  const icon = nativeImage
    .createFromPath(path.join(__dirname, '../../icon.png'))
    .resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Abrir anillo', click: toggleOverlay },
    { label: 'Settings', click: openSettings },
    { type: 'separator' },
    { label: 'Abrir carpeta de configuración', click: () => shell.openPath(CONFIG_DIR) },
    {
      label: 'Iniciar con Windows',
      type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }),
    },
    { type: 'separator' },
    { label: 'Salir', click: () => app.quit() },
  ]));
  tray.on('click', toggleOverlay);
  updateTrayTooltip();
}

// ---------------------------------------------------------------------------
// Ejecución de acciones
// ---------------------------------------------------------------------------
function spawnDetached(cmdline) {
  try {
    const child = spawn('cmd.exe', ['/c', cmdline], { detached: true, stdio: 'ignore', windowsHide: true });
    child.on('error', (e) => console.error('[exec] error:', e.message));
    child.unref();
  } catch (e) {
    console.error('[exec] no se pudo lanzar:', e.message);
  }
}

function openTarget(value) {
  const plan = vars.planOpen(value, (p) => { try { return fs.existsSync(p); } catch { return false; } });
  switch (plan.kind) {
    case 'url': shell.openExternal(plan.url); break;
    case 'path': shell.openPath(plan.path); break;
    // `start` resuelve nombres cortos vía App Paths del registro (notepad, chrome, ...)
    case 'start': spawnDetached(`start "" "${plan.target}"`); break;
    default: console.error(`[open] valor vacío o con caracteres no permitidos: ${plan.target}`);
  }
}

const WINDOW_SNAP_KEYS = { left: 'Win+ArrowLeft', right: 'Win+ArrowRight', maximize: 'Win+ArrowUp' };

function executeAction(action) {
  if (!action || typeof action !== 'object') return;
  switch (action.type) {
    case 'shortcut':
      sendKeys(action.value);
      break;

    case 'open':
      openTarget(action.value);
      break;

    case 'command': {
      const plan = vars.planCommand(action.value, currentVars());
      if (plan.kind === 'window') {
        if (WINDOW_SNAP_KEYS[plan.position]) sendKeys(WINDOW_SNAP_KEYS[plan.position]);
        else console.error(`[command] window:${plan.position} no reconocido`);
      } else if (plan.kind === 'url') {
        // Sin shell: así un portapapeles con `& comando` no puede inyectar nada,
        // y el contenido se codifica para que una query con espacios funcione.
        shell.openExternal(plan.url);
      } else {
        spawnDetached(plan.command);
      }
      break;
    }

    case 'snippet': {
      const text = vars.expandVariables(action.value, currentVars(), 'raw');
      const previous = clipboard.readText();
      clipboard.writeText(text);
      lastClipText = text; // no contaminar el historial con nuestra propia escritura
      setTimeout(() => {
        sendKeys('Control+V');
        // Devolver el portapapeles como estaba: antes el snippet lo pisaba para siempre.
        setTimeout(() => {
          try { clipboard.writeText(previous); lastClipText = previous; } catch { /* ignorado */ }
        }, 400);
      }, 120);
      break;
    }

    case 'workflow': {
      let steps;
      try {
        steps = typeof action.value === 'string' ? JSON.parse(action.value) : action.value;
      } catch (e) {
        console.error('[workflow] JSON inválido:', e.message);
        break;
      }
      if (!Array.isArray(steps)) { console.error('[workflow] se esperaba un array de acciones'); break; }
      steps.forEach((step, i) => setTimeout(() => executeAction(step), i * 300));
      break;
    }

    case 'macro': {
      let steps;
      try {
        steps = typeof action.value === 'string' ? JSON.parse(action.value) : action.value;
      } catch (e) {
        console.error('[macro] JSON inválido:', e.message);
        break;
      }
      executeMacro(steps);
      break;
    }

    default:
      console.error(`[action] tipo desconocido: ${action.type}`);
  }
}

// ---------------------------------------------------------------------------
// IPC
// ---------------------------------------------------------------------------
function registerIpc() {
  ipcMain.on('execute-action', (_event, action) => {
    if (!action || typeof action !== 'object') return;

    // Sub-anillo: navegar a otro perfil sin cerrar
    if (action.type === 'profile') {
      if (!overlay || overlay.isDestroyed()) return;
      overlay.webContents.send('show-ring', {
        actions: schema.profileActionsFor(config, action.value),
        activeApp: action.value,
        rolProfiles: [],
        animation: config.animation || {},
        macros: [],
        isSubring: true,
      });
      return;
    }

    hideOverlay();

    if (action._fromProfile) {
      // Acción de un perfil Rol: primero traer esa app al frente
      if (!focusAppWindow(action._fromProfile)) openTarget(action._fromProfile);
      setTimeout(() => executeAction(action), 400);
    } else {
      restoreFocus();
      setTimeout(() => executeAction(action), 200);
    }
  });

  ipcMain.on('execute-macro', (_event, macro) => {
    hideOverlay();
    restoreFocus();
    const steps = macro && Array.isArray(macro.steps) ? macro.steps : [];
    setTimeout(() => executeMacro(steps), 200);
  });

  ipcMain.on('close-ring', () => hideOverlay());
  ipcMain.on('renderer-log', (_event, msg) => console.log('[renderer]', msg));

  ipcMain.on('ring-ready', () => {
    overlayReady = true;
    if (pendingShow) { pendingShow = false; showOverlay(); }
  });

  ipcMain.handle('get-config', () => config);

  ipcMain.handle('save-config', (_event, newConfig) => {
    const previousHotkey = config && config.hotkey;
    saveConfig(newConfig);
    if (config.hotkey !== previousHotkey && !recordingActive) {
      registerHotkey(config.hotkey);
      updateTrayTooltip();
    }
    return { config, hotkey: activeHotkey };
  });

  ipcMain.handle('get-running-apps', () => getRunningApps());
  ipcMain.handle('get-clipboard-history', () => clipboardHistory);
  ipcMain.handle('clear-clipboard-history', () => { clipboardHistory = []; return clipboardHistory; });
  ipcMain.handle('get-config-path', () => CONFIG_FILE);
  ipcMain.handle('open-config-folder', () => shell.openPath(CONFIG_DIR));
  ipcMain.handle('validate-keys', (_event, combo) => keys.unmappedKeys(combo));

  // Durante la grabación hay que liberar el hotkey para no interceptar teclas.
  // La captura en sí ocurre en la ventana de Settings.
  ipcMain.handle('start-recording', () => {
    recordingActive = true;
    unregisterHotkey();
    updateTrayTooltip();
    return true;
  });

  ipcMain.handle('stop-recording', () => {
    recordingActive = false;
    registerHotkey(config.hotkey);
    updateTrayTooltip();
    return true;
  });
}

// ---------------------------------------------------------------------------
// Arranque
// ---------------------------------------------------------------------------
function main() {
  app.on('second-instance', () => openSettings());

  // Es una app de bandeja: cerrar Settings no debe terminar el proceso.
  app.on('window-all-closed', () => { /* se sale desde el menú del tray */ });

  app.whenReady().then(() => {
    loadConfig();
    createOverlay();
    createTray();
    registerIpc();
    watchClipboard();
    registerHotkey(config.hotkey);
    updateTrayTooltip();
    console.log(`[config] ${CONFIG_FILE}`);
    console.log(`[hotkey] ${activeHotkey || 'ninguno'}`);
  });

  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    if (clipboardTimer) clearInterval(clipboardTimer);
  });
}

// Una sola instancia: dos procesos competían por el hotkey y por el config.
if (!app.requestSingleInstanceLock()) app.quit();
else main();
