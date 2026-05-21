const { app, BrowserWindow, globalShortcut, ipcMain, screen, Tray, Menu, nativeImage, nativeTheme, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const koffi = require('koffi');

// --- Win32 API via koffi (sin PowerShell, sin execSync) ---
const user32 = koffi.load('user32.dll');
const kernel32 = koffi.load('kernel32.dll');
const psapi = koffi.load('psapi.dll');

// Tipos
const HWND = koffi.pointer('HWND', koffi.opaque());
const HANDLE = koffi.pointer('HANDLE', koffi.opaque());
const DWORD = koffi.alias('DWORD', 'uint32');

// Constantes para SendInput
const INPUT_KEYBOARD = 1;
const KEYEVENTF_KEYUP = 0x0002;
const KEYEVENTF_EXTENDEDKEY = 0x0001;

// Funciones Win32
const GetForegroundWindow = user32.func('GetForegroundWindow', HWND, []);
const GetWindowThreadProcessId = user32.func('GetWindowThreadProcessId', DWORD, [HWND, koffi.out(koffi.pointer('uint32'))]);
const SetForegroundWindow = user32.func('SetForegroundWindow', 'bool', [HWND]);
const OpenProcess = kernel32.func('OpenProcess', HANDLE, [DWORD, 'bool', DWORD]);
const CloseHandle = kernel32.func('CloseHandle', 'bool', [HANDLE]);
const GetModuleBaseNameW = psapi.func('GetModuleBaseNameW', DWORD, [HANDLE, 'void *', 'uint16 *', DWORD]);
const SendInput = user32.func('SendInput', 'uint32', ['uint32', 'void *', 'int32']);
const EnumWindows = user32.func('EnumWindows', 'bool', [koffi.pointer('void'), 'intptr']);
const IsWindowVisible = user32.func('IsWindowVisible', 'bool', [HWND]);
const GetWindowTextW = user32.func('GetWindowTextW', 'int32', [HWND, 'uint16 *', 'int32']);
const GetWindowTextLengthW = user32.func('GetWindowTextLengthW', 'int32', [HWND]);
const GetCurrentThreadId = kernel32.func('GetCurrentThreadId', DWORD, []);
const AttachThreadInput = user32.func('AttachThreadInput', 'bool', [DWORD, DWORD, 'bool']);
const SetFocus = user32.func('SetFocus', HWND, [HWND]);

const PROCESS_QUERY_INFORMATION = 0x0400;
const PROCESS_VM_READ = 0x0010;

// --- Estado global ---
let overlay = null;

// --- Restaurar foco a la ventana anterior con AttachThreadInput ---
function restoreFocus() {
  if (!lastActiveHwnd) return;
  try {
    const pidBuf = [0];
    GetWindowThreadProcessId(lastActiveHwnd, pidBuf);
    const targetThread = pidBuf[0];
    const ourThread = GetCurrentThreadId();
    if (targetThread && targetThread !== ourThread) {
      AttachThreadInput(ourThread, targetThread, true);
      SetForegroundWindow(lastActiveHwnd);
      SetFocus(lastActiveHwnd);
      AttachThreadInput(ourThread, targetThread, false);
    } else {
      SetForegroundWindow(lastActiveHwnd);
    }
  } catch {
    try { SetForegroundWindow(lastActiveHwnd); } catch {}
  }
}
let settingsWin = null;
let tray = null;
let config = null;
let lastActiveApp = null;
let lastActiveHwnd = null;
let clipboardHistory = [];

const configPath = app.isPackaged
  ? path.join(process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(process.execPath), 'config', 'default.json')
  : path.join(__dirname, '../../config/default.json');

function loadConfig() {
  // In portable mode, copy default config next to .exe if not present
  if (app.isPackaged && !fs.existsSync(configPath)) {
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const bundledConfig = path.join(process.resourcesPath, 'config', 'default.json');
    if (fs.existsSync(bundledConfig)) fs.copyFileSync(bundledConfig, configPath);
  }
  config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  return config;
}

function saveConfig(newConfig) {
  config = newConfig;
  fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));
}

// --- Obtener app activa via Win32 (instantáneo, ~0ms) ---
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

    const nameBuf = Buffer.alloc(520); // 260 * 2 bytes (UTF-16)
    const len = GetModuleBaseNameW(hProcess, null, nameBuf, 260);
    CloseHandle(hProcess);

    if (len === 0) return '_default';
    const name = nameBuf.toString('utf16le', 0, len * 2);
    return name.replace(/\.exe$/i, '');
  } catch {
    return '_default';
  }
}

// --- Obtener lista de apps con ventana visible ---
function getRunningApps() {
  const apps = new Set();
  const cb = koffi.register((hwnd, _lParam) => {
    if (!IsWindowVisible(hwnd)) return 1;
    const textLen = GetWindowTextLengthW(hwnd);
    if (textLen === 0) return 1;

    const pidBuf = [0];
    GetWindowThreadProcessId(hwnd, pidBuf);
    const pid = pidBuf[0];
    if (!pid) return 1;

    const hProcess = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, false, pid);
    if (!hProcess) return 1;

    const nameBuf = Buffer.alloc(520);
    const len = GetModuleBaseNameW(hProcess, null, nameBuf, 260);
    CloseHandle(hProcess);

    if (len > 0) {
      const name = nameBuf.toString('utf16le', 0, len * 2).replace(/\.exe$/i, '');
      apps.add(name);
    }
    return 1;
  }, koffi.pointer('void'));

  try { EnumWindows(cb, 0); } catch {}
  koffi.unregister(cb);
  return [...apps].sort();
}

// --- Enviar teclas via SendInput (Win32 nativo, instantáneo) ---
const VK_MAP = {
  'a': 0x41, 'b': 0x42, 'c': 0x43, 'd': 0x44, 'e': 0x45, 'f': 0x46, 'g': 0x47,
  'h': 0x48, 'i': 0x49, 'j': 0x4A, 'k': 0x4B, 'l': 0x4C, 'm': 0x4D, 'n': 0x4E,
  'o': 0x4F, 'p': 0x50, 'q': 0x51, 'r': 0x52, 's': 0x53, 't': 0x54, 'u': 0x55,
  'v': 0x56, 'w': 0x57, 'x': 0x58, 'y': 0x59, 'z': 0x5A,
  '0': 0x30, '1': 0x31, '2': 0x32, '3': 0x33, '4': 0x34,
  '5': 0x35, '6': 0x36, '7': 0x37, '8': 0x38, '9': 0x39,
  'f1': 0x70, 'f2': 0x71, 'f3': 0x72, 'f4': 0x73, 'f5': 0x74, 'f6': 0x75,
  'f7': 0x76, 'f8': 0x77, 'f9': 0x78, 'f10': 0x79, 'f11': 0x7A, 'f12': 0x7B,
  'enter': 0x0D, 'return': 0x0D, 'tab': 0x09, 'escape': 0x1B, 'esc': 0x1B,
  'space': 0x20, 'backspace': 0x08, 'delete': 0x2E,
  'arrowup': 0x26, 'arrowdown': 0x28, 'arrowleft': 0x25, 'arrowright': 0x27,
  'up': 0x26, 'down': 0x28, 'left': 0x25, 'right': 0x27,
  'home': 0x24, 'end': 0x23, 'pageup': 0x21, 'pagedown': 0x22,
  'insert': 0x2D, 'printscreen': 0x2C,
  '`': 0xC0, '-': 0xBD, '=': 0xBB, '[': 0xDB, ']': 0xDD, '\\': 0xDC,
  ';': 0xBA, "'": 0xDE, ',': 0xBC, '.': 0xBE, '/': 0xBF,
  'control': 0xA2, 'ctrl': 0xA2, 'shift': 0xA0, 'alt': 0xA4, 'win': 0x5B,
};

// Teclas extendidas que requieren flag KEYEVENTF_EXTENDEDKEY
const EXTENDED_KEYS = new Set([0x25, 0x26, 0x27, 0x28, 0x24, 0x23, 0x21, 0x22, 0x2D, 0x2E, 0x5B]);

function sendKeys(keys) {
  const parts = keys.split('+').map(k => k.trim().toLowerCase());
  const mainKey = parts.pop();
  const modifiers = parts;

  const keyEvents = [];

  // Presionar modificadores
  for (const mod of modifiers) {
    const vk = VK_MAP[mod] || 0;
    if (vk) keyEvents.push({ vk, flags: 0 });
  }

  // Presionar tecla principal
  const mainVk = VK_MAP[mainKey] || 0;
  if (mainVk) keyEvents.push({ vk: mainVk, flags: 0 });

  // Soltar tecla principal
  if (mainVk) keyEvents.push({ vk: mainVk, flags: KEYEVENTF_KEYUP });

  // Soltar modificadores (orden inverso)
  for (const mod of [...modifiers].reverse()) {
    const vk = VK_MAP[mod] || 0;
    if (vk) keyEvents.push({ vk, flags: KEYEVENTF_KEYUP });
  }

  if (keyEvents.length === 0) return;

  // Cada INPUT struct: 4 (type) + 2 (wVk) + 2 (wScan) + 4 (dwFlags) + 4 (time) + 8 (dwExtraInfo) + padding = 40 bytes en x64
  const INPUT_SIZE = 40;
  const count = keyEvents.length;
  const buf = Buffer.alloc(INPUT_SIZE * count);

  for (let i = 0; i < count; i++) {
    const offset = i * INPUT_SIZE;
    let flags = keyEvents[i].flags;
    if (EXTENDED_KEYS.has(keyEvents[i].vk)) flags |= KEYEVENTF_EXTENDEDKEY;

    buf.writeUInt32LE(INPUT_KEYBOARD, offset);       // type
    buf.writeUInt16LE(keyEvents[i].vk, offset + 8);  // wVk (offset 8 en x64 por alignment)
    buf.writeUInt16LE(0, offset + 10);               // wScan
    buf.writeUInt32LE(flags, offset + 12);           // dwFlags
    buf.writeUInt32LE(0, offset + 16);               // time
    buf.writeBigUInt64LE(0n, offset + 20);           // dwExtraInfo (uintptr = 8 bytes en x64)
  }

  try {
    SendInput(count, buf, INPUT_SIZE);
  } catch (e) {
    console.error('SendInput error:', e.message);
  }
}

function makeKeyInput() {} // no longer needed

// --- Type text character by character via SendInput ---
function typeText(text) {
  const INPUT_SIZE = 40;
  const KEYEVENTF_UNICODE = 0x0004;
  const events = [];
  for (const char of text) {
    const code = char.charCodeAt(0);
    events.push({ scan: code, flags: KEYEVENTF_UNICODE });
    events.push({ scan: code, flags: KEYEVENTF_UNICODE | KEYEVENTF_KEYUP });
  }
  const buf = Buffer.alloc(INPUT_SIZE * events.length);
  for (let i = 0; i < events.length; i++) {
    const offset = i * INPUT_SIZE;
    buf.writeUInt32LE(INPUT_KEYBOARD, offset);
    buf.writeUInt16LE(0, offset + 8);                    // wVk = 0 for unicode
    buf.writeUInt16LE(events[i].scan, offset + 10);      // wScan = unicode char
    buf.writeUInt32LE(events[i].flags, offset + 12);     // dwFlags
    buf.writeUInt32LE(0, offset + 16);
    buf.writeBigUInt64LE(0n, offset + 20);
  }
  try { SendInput(events.length, buf, INPUT_SIZE); } catch (e) { console.error('typeText error:', e.message); }
}

// --- Execute macro steps sequentially with delays ---
function executeMacro(steps) {
  let delay = 0;
  for (const step of steps) {
    const d = step.delay || 50;
    setTimeout(() => {
      const keys = step.keys || '';
      if (keys.startsWith('type:')) {
        typeText(expandVariables(keys.slice(5)));
      } else {
        sendKeys(keys);
      }
    }, delay);
    delay += d;
  }
}

// --- Variable expansion ---
function expandVariables(value) {
  const now = new Date();
  return value
    .replace(/\{clipboard\}/g, clipboard.readText())
    .replace(/\{date\}/g, now.toLocaleDateString())
    .replace(/\{time\}/g, now.toLocaleTimeString())
    .replace(/\{datetime\}/g, now.toISOString())
    .replace(/\{app\}/g, lastActiveApp || '');
}

// --- Clipboard history ---
let lastClipText = '';
function watchClipboard() {
  setInterval(() => {
    const text = clipboard.readText();
    if (text && text !== lastClipText) {
      lastClipText = text;
      clipboardHistory.unshift(text);
      if (clipboardHistory.length > 20) clipboardHistory.pop();
    }
  }, 1000);
}

// --- Overlay ---
function createOverlay() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  overlay = new BrowserWindow({
    width: 700, height: 700,
    x: Math.round((width - 700) / 2), y: Math.round((height - 700) / 2),
    frame: false, alwaysOnTop: true,
    skipTaskbar: true, resizable: false,
    backgroundColor: '#00000000', transparent: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true },
  });
  overlay.setVisibleOnAllWorkspaces(true);
  overlay.loadFile(path.join(__dirname, '../renderer/index.html'));
  overlay.hide();
}

function openSettings() {
  if (settingsWin) { settingsWin.focus(); return; }
  settingsWin = new BrowserWindow({
    width: 760, height: 560,
    title: 'Actions Ring 4All',
    icon: path.join(__dirname, '../../icon.png'),
    backgroundColor: '#0f1923',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true },
  });
  settingsWin.loadFile(path.join(__dirname, '../settings/index.html'));
  settingsWin.on('closed', () => { settingsWin = null; });
}

const profileIcons = { 'Spotify': 'Music', 'chrome': 'Globe', 'ChatGPT': 'Sparkles', 'msedge': 'Globe', 'OUTLOOK': 'Mail', 'notepad': 'StickyNote', 'WhatsApp': 'MessageCircle', 'Telegram': 'Send', 'explorer': 'Folder', 'Code': 'Code' };

function toggleOverlay() {
  console.log('[toggleOverlay] called, overlay exists:', !!overlay);
  if (!overlay) return;
  if (overlay.isVisible()) { overlay.hide(); return; }
  const activeApp = getActiveApp();
  lastActiveApp = activeApp;
  console.log('[toggleOverlay] activeApp:', activeApp);
  const profileActions = config.actions[activeApp] || config.actions._default;
  const pinnedActions = (config.pinnedActions || []).map(a => ({ ...a, _pinned: true }));
  // Merge: pinned first, then profile actions (avoid duplicates by label)
  const pinnedLabels = new Set(pinnedActions.map(a => a.label));
  const actions = [...pinnedActions, ...profileActions.filter(a => !pinnedLabels.has(a.label))];
  console.log('[toggleOverlay] actions count:', actions.length, '(pinned:', pinnedActions.length, ')');
  const rolProfiles = (config.rolProfiles || []).map(name => ({
    name, icon: profileIcons[name] || 'AppWindow',
    actions: (config.actions[name] || []).slice(0, 6),
  }));
  overlay.webContents.send('show-ring', { actions, activeApp, rolProfiles, animation: config.animation || {}, macros: config.macros || [] });
  const cursor = screen.getCursorScreenPoint();
  console.log('[toggleOverlay] cursor:', cursor.x, cursor.y);
  overlay.setPosition(cursor.x - 350, cursor.y - 350);
  overlay.show();
  overlay.focus();
  console.log('[toggleOverlay] overlay shown');
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, '../../icon.png')).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip(`Actions Ring 4All (${config.hotkey})`);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Settings', click: openSettings },
    { label: 'Auto-start', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin, click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }) },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]));
}

// --- App ready ---
app.whenReady().then(() => {
  loadConfig();
  createOverlay();
  createTray();
  watchClipboard();

  const registered = globalShortcut.register(config.hotkey, toggleOverlay);
  if (!registered) console.error(`ERROR: No se pudo registrar hotkey: ${config.hotkey}`);
  else console.log(`Hotkey registrado: ${config.hotkey}`);

  globalShortcut.register('Escape', () => { if (overlay && overlay.isVisible()) overlay.hide(); });
});

// --- IPC ---
ipcMain.on('execute-action', (_, action) => {
  if (action.type === 'profile') {
    const actions = config.actions[action.value] || config.actions._default;
    overlay.webContents.send('show-ring', { actions, activeApp: action.value, isSubring: true });
    return;
  }
  overlay.hide();

  // Restaurar foco a la ventana anterior
  restoreFocus();

  if (action.type === 'shortcut') {
    setTimeout(() => sendKeys(action.value), 200);
  } else {
    setTimeout(() => executeAction(action), 200);
  }
});

ipcMain.on('close-ring', () => overlay.hide());
ipcMain.on('renderer-log', (_, msg) => console.log('[renderer]', msg));

// --- Macro execution from ring ---
ipcMain.on('execute-macro', (_, macro) => {
  overlay.hide();
  restoreFocus();
  setTimeout(() => executeMacro(macro.steps), 200);
});

// --- Macro recording ---
let recording = false;
let recordBuffer = [];
let recordLastTime = 0;

ipcMain.handle('start-recording', () => {
  recording = true;
  recordBuffer = [];
  recordLastTime = Date.now();
  // Desregistrar hotkey para que no intercepte teclas durante grabación
  globalShortcut.unregisterAll();
  console.log('[macro] Recording started, hotkeys unregistered');
  return true;
});

ipcMain.handle('stop-recording', () => {
  recording = false;
  console.log('[macro] Recording stopped, steps:', recordBuffer.length);
  const result = [...recordBuffer];
  recordBuffer = [];
  // Re-registrar hotkeys
  globalShortcut.register(config.hotkey, toggleOverlay);
  globalShortcut.register('Escape', () => { if (overlay && overlay.isVisible()) overlay.hide(); });
  console.log('[macro] Hotkeys re-registered');
  return result;
});

ipcMain.handle('save-macro', (_, macro) => {
  if (!config.macros) config.macros = [];
  config.macros.push(macro);
  saveConfig(config);
  return config.macros;
});

ipcMain.handle('delete-macro', (_, index) => {
  if (config.macros) config.macros.splice(index, 1);
  saveConfig(config);
  return config.macros;
});

ipcMain.handle('get-macros', () => config.macros || []);

ipcMain.handle('get-config', () => config);
ipcMain.handle('save-config', (_, newConfig) => {
  globalShortcut.unregisterAll();
  saveConfig(newConfig);
  globalShortcut.register(config.hotkey, toggleOverlay);
  globalShortcut.register('Escape', () => { if (overlay && overlay.isVisible()) overlay.hide(); });
});
ipcMain.handle('get-running-apps', () => getRunningApps());
ipcMain.handle('get-clipboard-history', () => clipboardHistory);
ipcMain.handle('get-theme', () => nativeTheme.shouldUseDarkColors ? 'dark' : 'light');

// --- Execute action ---
function executeAction(action) {
  const { exec } = require('child_process');
  switch (action.type) {
    case 'shortcut': sendKeys(action.value); break;
    case 'open': {
      exec(`start "" "${action.value}"`, { shell: 'cmd.exe' });
      break;
    }
    case 'command': {
      const cmd = expandVariables(action.value);
      if (cmd.startsWith('window:')) {
        const pos = cmd.split(':')[1];
        const winKeys = { 'left': 'Win+ArrowLeft', 'right': 'Win+ArrowRight', 'maximize': 'Win+ArrowUp' };
        if (winKeys[pos]) sendKeys(winKeys[pos]);
      } else {
        exec(cmd, { shell: 'cmd.exe' });
      }
      break;
    }
    case 'snippet': {
      const text = expandVariables(action.value);
      clipboard.writeText(text);
      setTimeout(() => sendKeys('Control+V'), 100);
      break;
    }
    case 'workflow': {
      try {
        const steps = JSON.parse(action.value);
        let delay = 0;
        steps.forEach(step => { setTimeout(() => executeAction(step), delay); delay += 300; });
      } catch {}
      break;
    }
    case 'macro': {
      try {
        const steps = typeof action.value === 'string' ? JSON.parse(action.value) : action.value;
        executeMacro(steps);
      } catch (e) { console.error('macro error:', e.message); }
      break;
    }
  }
}

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('activate', () => openSettings());
