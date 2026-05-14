const { app, BrowserWindow, globalShortcut, ipcMain, screen, Tray, Menu, nativeImage, nativeTheme, clipboard } = require('electron');
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
    const cmd = `powershell -NoProfile -Command "(Get-Process | Where-Object {$_.MainWindowHandle -ne 0} | Sort-Object -Property CPU -Descending | Select-Object -First 1).ProcessName"`;
    return execSync(cmd, { encoding: 'utf-8' }).trim();
  } catch { return '_default'; }
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

// --- Send keys via PowerShell ---
function sendKeys(keys) {
  // Convert our format to .NET SendKeys format
  // Command+C → ^c, Shift+Command+P → ^+p, Control+Shift+` → ^+{`}
  const keyList = keys.split('+').map(k => k.trim());
  const mainKey = keyList.pop();

  let prefix = '';
  for (const mod of keyList) {
    if (/command|control|ctrl/i.test(mod)) prefix += '^';
    if (/shift/i.test(mod)) prefix += '+';
    if (/alt|option/i.test(mod)) prefix += '%';
  }

  // Special key mappings for SendKeys
  const specialKeys = {
    'Delete': '{DELETE}', 'Backspace': '{BACKSPACE}', 'Enter': '{ENTER}', 'Return': '{ENTER}',
    'Tab': '{TAB}', 'Escape': '{ESC}', 'Space': ' ',
    'ArrowUp': '{UP}', 'ArrowDown': '{DOWN}', 'ArrowLeft': '{LEFT}', 'ArrowRight': '{RIGHT}',
    'F1': '{F1}', 'F2': '{F2}', 'F3': '{F3}', 'F4': '{F4}', 'F5': '{F5}', 'F6': '{F6}',
    'F7': '{F7}', 'F8': '{F8}', 'F9': '{F9}', 'F10': '{F10}', 'F11': '{F11}', 'F12': '{F12}',
    '+': '{+}', '^': '{^}', '%': '{%}', '~': '{~}', '(': '{(}', ')': '{)}',
    '{': '{{}', '}': '{}}', '[': '{[}', ']': '{]}',
  };

  const key = specialKeys[mainKey] || mainKey.toLowerCase();
  const sendKeysStr = prefix + key;

  const script = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${sendKeysStr}')`;
  spawn('powershell', ['-NoProfile', '-Command', script], { detached: true, stdio: 'ignore' }).unref();
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
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1d1d1f' : '#f5f5f7',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true },
  });
  settingsWin.loadFile(path.join(__dirname, '../settings/index.html'));
  settingsWin.on('closed', () => { settingsWin = null; });
}

const profileIcons = { 'Spotify': 'Music', 'chrome': 'Globe', 'ChatGPT': 'Sparkles', 'msedge': 'Globe', 'OUTLOOK': 'Mail', 'notepad': 'StickyNote', 'WhatsApp': 'MessageCircle', 'Telegram': 'Send', 'explorer': 'Folder', 'Code': 'Code' };

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
  overlay.webContents.send('show-ring', { actions, activeApp, rolProfiles });
  const cursor = screen.getCursorScreenPoint();
  overlay.setPosition(cursor.x - 350, cursor.y - 350);
  overlay.show();
  overlay.focus();
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, '../../tray-icon.png')).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip(`Actions Ring (${config.hotkey})`);
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
  globalShortcut.register(config.hotkey, toggleOverlay);
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
  const targetApp = action._fromProfile || lastActiveApp;

  if (action.type === 'shortcut') {
    // Activate target window then send keys
    if (targetApp) {
      try { execSync(`powershell -NoProfile -Command "(Get-Process '${targetApp}' -ErrorAction SilentlyContinue | Where-Object {$_.MainWindowHandle -ne 0})[0] | ForEach-Object { [void][System.Runtime.InteropServices.Marshal]::GetActiveObject('') }"`, { encoding: 'utf-8' }); } catch {}
    }
    setTimeout(() => sendKeys(action.value), 200);
  } else {
    executeAction(action);
  }
});

ipcMain.on('close-ring', () => overlay.hide());
ipcMain.on('renderer-log', (_, msg) => console.log('[renderer]', msg));

ipcMain.handle('get-config', () => config);
ipcMain.handle('save-config', (_, newConfig) => {
  globalShortcut.unregisterAll();
  saveConfig(newConfig);
  globalShortcut.register(config.hotkey, toggleOverlay);
  globalShortcut.register('Escape', () => { if (overlay && overlay.isVisible()) overlay.hide(); });
});
ipcMain.handle('get-running-apps', () => {
  try {
    const result = execSync(`powershell -NoProfile -Command "Get-Process | Where-Object {$_.MainWindowHandle -ne 0} | Select-Object -ExpandProperty ProcessName | Sort-Object -Unique"`, { encoding: 'utf-8' });
    return result.trim().split('\n').map(s => s.trim()).filter(Boolean);
  } catch { return []; }
});
ipcMain.handle('get-clipboard-history', () => clipboardHistory);
ipcMain.handle('get-theme', () => nativeTheme.shouldUseDarkColors ? 'dark' : 'light');

// --- Execute action ---
function executeAction(action) {
  switch (action.type) {
    case 'shortcut': sendKeys(action.value); break;
    case 'open': { try { execSync(`start "" "${action.value}"`); } catch {} break; }
    case 'command': {
      const cmd = expandVariables(action.value);
      if (cmd.startsWith('window:')) {
        const pos = cmd.split(':')[1];
        const winKeys = { 'left': '#({LEFT})', 'right': '#({RIGHT})', 'maximize': '#({UP})' };
        if (winKeys[pos]) sendKeys(pos === 'left' ? 'Win+Left' : pos === 'right' ? 'Win+Right' : 'Win+Up');
      } else {
        try { execSync(cmd, { shell: 'cmd.exe' }); } catch {}
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
  }
}

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('activate', () => openSettings());
