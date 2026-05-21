const { app, BrowserWindow, globalShortcut, ipcMain, screen, Tray, Menu, nativeImage, systemPreferences, dialog, nativeTheme, clipboard } = require('electron');
const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

let overlay = null;
let settingsWin = null;
let tray = null;
let config = null;
let lastActiveApp = null;
let clipboardHistory = [];

const configPath = path.join(__dirname, '../../config/default.json');

function loadConfig() {
  config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  return config;
}

function saveConfig(newConfig) {
  config = newConfig;
  fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));
}

function getActiveApp() {
  try {
    return execSync(`osascript -e 'tell application "System Events" to get name of first application process whose frontmost is true'`).toString().trim();
  } catch { return '_default'; }
}

// --- Variable expansion for commands ---
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
    skipTaskbar: true, resizable: false, hasShadow: false,
    backgroundColor: '#00000000', transparent: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true },
  });
  overlay.setIgnoreMouseEvents(false);
  overlay.setVisibleOnAllWorkspaces(true);
  overlay.loadFile(path.join(__dirname, '../renderer/index.html'));
  overlay.hide();
}

function openSettings() {
  if (settingsWin) { settingsWin.focus(); return; }
  settingsWin = new BrowserWindow({
    width: 760, height: 560,
    titleBarStyle: 'hiddenInset',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1d1d1f' : '#f5f5f7',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true },
  });
  settingsWin.loadFile(path.join(__dirname, '../settings/index.html'));
  settingsWin.on('closed', () => { settingsWin = null; });
}

const profileIcons = { 'Spotify': 'Music', 'Google Chrome': 'Globe', 'ChatGPT': 'Sparkles', 'Safari': 'Compass', 'Mail': 'Mail', 'Notes': 'StickyNote', 'WhatsApp': 'MessageCircle', 'Telegram': 'Send', 'Finder': 'Folder', 'Calendar': 'Calendar', 'Gemini': 'Sparkles', 'Preview': 'Image' };

function toggleOverlay() {
  if (!overlay) return;
  if (overlay.isVisible()) { overlay.hide(); return; }
  const activeApp = getActiveApp();
  lastActiveApp = activeApp;
  const actions = config.actions[activeApp] || config.actions._default;
  const rolProfiles = (config.rolProfiles || []).map(name => ({
    name, icon: profileIcons[name] || 'AppWindow',
    actions: (config.actions[name] || []).slice(0, 6),
  }));
  const isDark = nativeTheme.shouldUseDarkColors;
  overlay.webContents.send('show-ring', { actions, activeApp, rolProfiles, isDark });
  const cursor = screen.getCursorScreenPoint();
  overlay.setPosition(cursor.x - 350, cursor.y - 350);
  overlay.show();
  overlay.focus();
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, '../../tray-icon.png')).resize({ width: 18, height: 18 });
  icon.setTemplateImage(true);
  tray = new Tray(icon);
  tray.setToolTip(`Actions Ring (${config.hotkey})`);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Settings', click: openSettings },
    { label: 'Auto-start', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin, click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }) },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]));
}

function checkAccessibility() {
  if (!systemPreferences.isTrustedAccessibilityClient(false)) {
    systemPreferences.isTrustedAccessibilityClient(true);
  }
}

// --- App ready ---
app.whenReady().then(() => {
  loadConfig();
  createOverlay();
  createTray();
  checkAccessibility();
  watchClipboard();
  globalShortcut.register(config.hotkey, toggleOverlay);
  globalShortcut.register('Escape', () => { if (overlay && overlay.isVisible()) overlay.hide(); });
});

// --- IPC: Ring ---
ipcMain.on('execute-action', (_, action) => {
  if (action.type === 'profile') {
    const actions = config.actions[action.value] || config.actions._default;
    overlay.webContents.send('show-ring', { actions, activeApp: action.value, isSubring: true });
    return;
  }
  overlay.hide();
  const targetApp = action._fromProfile || lastActiveApp;

  if (action.type === 'shortcut' && targetApp) {
    try { execSync(`osascript -e 'tell application "${targetApp}" to activate'`); } catch {}
    setTimeout(() => executeAction(action), 200);
  } else if (action.type === 'shortcut') {
    setTimeout(() => executeAction(action), 200);
  } else {
    executeAction(action);
  }
});

ipcMain.on('close-ring', () => overlay.hide());
ipcMain.on('renderer-log', (_, msg) => console.log('[renderer]', msg));

// --- Macro execution (macOS via osascript) ---
function executeMacro(steps) {
  let delay = 0;
  for (const step of steps) {
    const d = step.delay || 50;
    setTimeout(() => {
      const keys = step.keys || '';
      if (keys.startsWith('type:')) {
        const text = expandVariables(keys.slice(5)).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        const proc = spawn('osascript', ['-']);
        proc.stdin.write(`tell application "System Events" to keystroke "${text}"`);
        proc.stdin.end();
      } else {
        executeAction({ type: 'shortcut', value: keys });
      }
    }, delay);
    delay += d;
  }
}

ipcMain.on('execute-macro', (_, macro) => {
  overlay.hide();
  if (lastActiveApp) {
    try { execSync(`osascript -e 'tell application "${lastActiveApp}" to activate'`); } catch {}
  }
  setTimeout(() => executeMacro(macro.steps), 200);
});

// --- IPC: Settings ---
ipcMain.handle('get-config', () => config);
ipcMain.handle('save-config', (_, newConfig) => {
  globalShortcut.unregisterAll();
  saveConfig(newConfig);
  globalShortcut.register(config.hotkey, toggleOverlay);
  globalShortcut.register('Escape', () => { if (overlay && overlay.isVisible()) overlay.hide(); });
});
ipcMain.handle('get-running-apps', () => {
  try {
    return execSync(`osascript -e 'tell application "System Events" to get name of every application process whose background only is false'`).toString().trim().split(', ').sort();
  } catch { return []; }
});
ipcMain.handle('get-clipboard-history', () => clipboardHistory);
ipcMain.handle('get-theme', () => nativeTheme.shouldUseDarkColors ? 'dark' : 'light');

// --- IPC: Macros ---
let recording = false;

ipcMain.handle('start-recording', () => {
  recording = true;
  globalShortcut.unregisterAll();
  console.log('[macro] Recording started, hotkeys unregistered');
  return true;
});

ipcMain.handle('stop-recording', () => {
  recording = false;
  globalShortcut.register(config.hotkey, toggleOverlay);
  globalShortcut.register('Escape', () => { if (overlay && overlay.isVisible()) overlay.hide(); });
  console.log('[macro] Recording stopped, hotkeys re-registered');
  return [];
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

// --- IPC: Window management ---
ipcMain.on('window-manage', (_, position) => {
  const script = {
    'left': 'tell application "System Events" to keystroke "Left" using {command down, option down}',
    'right': 'tell application "System Events" to keystroke "Right" using {command down, option down}',
    'maximize': 'tell application "System Events" to keystroke "f" using {command down, control down}',
    'center': 'tell application "System Events" to keystroke "c" using {command down, option down}',
  }[position];
  if (script) { const p = spawn('osascript', ['-']); p.stdin.write(script); p.stdin.end(); }
});

// --- Execute action ---
function executeAction(action) {
  switch (action.type) {
    case 'shortcut': {
      const keyList = action.value.split('+').map(k => k.trim());
      const mainKey = keyList.pop();
      const modMap = { 'Command': 'command down', 'Control': 'control down', 'Shift': 'shift down', 'Option': 'option down', 'Alt': 'option down' };
      const modifiers = keyList.map(m => modMap[m]).filter(Boolean);
      const usingClause = modifiers.length ? ` using {${modifiers.join(', ')}}` : '';
      const keyCodes = { 'Space':49,'`':50,'Delete':51,'Escape':53,'Tab':48,'Return':36,'-':27,'=':24,'\\':42,'/':44,'.':47,',':43,';':41,"'":39,'[':33,']':30,
        'F1':122,'F2':120,'F3':99,'F4':118,'F5':96,'F6':97,'F7':98,'F8':100,'F9':101,'F10':109,'F11':103,'F12':111,
        'ArrowRight':124,'ArrowDown':125,'ArrowUp':126,'ArrowLeft':123 };
      let keyAction;
      const code = keyCodes[mainKey];
      if (code !== undefined) { keyAction = `key code ${code}${usingClause}`; }
      else { keyAction = `keystroke "${mainKey.length === 1 ? mainKey.toLowerCase() : mainKey}"${usingClause}`; }
      const script = `tell application "System Events" to ${keyAction}`;
      const proc = spawn('osascript', ['-']); proc.stdin.write(script); proc.stdin.end();
      break;
    }
    case 'open': { try { execSync(`open -a "${action.value}"`); } catch {} break; }
    case 'command': {
      const cmd = expandVariables(action.value);
      if (cmd.startsWith('window:')) {
        const pos = cmd.split(':')[1];
        const scripts = {
          'left': 'tell application "System Events" to key code 123 using {control down, option down}',
          'right': 'tell application "System Events" to key code 124 using {control down, option down}',
          'maximize': 'tell application "System Events" to key code 3 using {control down, option down}',
        };
        if (scripts[pos]) { const p = spawn('osascript', ['-']); p.stdin.write(scripts[pos]); p.stdin.end(); }
      } else {
        try { execSync(cmd); } catch {}
      }
      break;
    }
    case 'snippet': {
      const text = expandVariables(action.value);
      clipboard.writeText(text);
      // Paste it
      setTimeout(() => {
        const proc = spawn('osascript', ['-']);
        proc.stdin.write('tell application "System Events" to keystroke "v" using {command down}');
        proc.stdin.end();
      }, 100);
      break;
    }
    case 'workflow': {
      // action.value is JSON array of actions
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
app.dock?.hide();
