// Harness de integración del proceso principal.
// Carga src/main/main.js con `electron` y `koffi` simulados.
//
// El problema original: `app.whenReady().then(...)` es asíncrono, así que los
// handlers IPC quedan pendientes si el harness consulta el Map antes de que
// la promise se resuelva.  La solución es hacer que `whenReady` devuelva una
// Promise que solucionamos nosotros desde afuera, y esperar con `await` antes
// de correr cada suite.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');

const MAIN = path.resolve(__dirname, '../src/main/main.js');
const KEYS = path.resolve(__dirname, '../src/main/keys.js');
const SCHEMA = path.resolve(__dirname, '../src/main/config-schema.js');
const VARS = path.resolve(__dirname, '../src/main/variables.js');

const out = (s) => process.stdout.write(`${s}\n`);

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); passed += 1; out(`  ok   ${name}`); }
  catch (e) {
    failed += 1;
    out(`  FAIL ${name}`);
    out(`       ${e.message.split('\n')[0]}`);
  }
}

// --------------------------------------------------------------------------
// Fábrica del harness
// --------------------------------------------------------------------------
async function makeHarness({ userDataDir, activeProcessName = 'chrome' }) {
  const calls = {
    sentMessages: [],
    registeredHotkeys: [],
    unregistered: [],
    openedExternal: [],
    openedPaths: [],
    overlayVisible: false,
    logs: [],
    errors: [],
  };

  const ipcOnMap = new Map();
  const ipcHandleMap = new Map();

  const webContents = {
    send: (channel, payload) => calls.sentMessages.push({ channel, payload }),
    on: () => {},
  };

  class FakeWindow {
    constructor() { this.webContents = webContents; this.destroyed = false; }
    isDestroyed() { return this.destroyed; }
    isVisible() { return calls.overlayVisible; }
    show() { calls.overlayVisible = true; }
    hide() { calls.overlayVisible = false; }
    focus() {}
    loadFile() {}
    setAlwaysOnTop() {}
    setVisibleOnAllWorkspaces() {}
    setMenuBarVisibility() {}
    getSize() { return [700, 700]; }
    setPosition() {}
    on() {}
  }

  // Resolvemos whenReady desde acá
  let resolveReady;
  const readyPromise = new Promise((res) => { resolveReady = res; });

  const electron = {
    app: {
      setName: () => {},
      getPath: () => userDataDir,
      getLoginItemSettings: () => ({ openAtLogin: false }),
      setLoginItemSettings: () => {},
      requestSingleInstanceLock: () => true,
      quit: () => { throw new Error('app.quit() inesperado'); },
      on: () => {},
      whenReady: () => readyPromise,
      isPackaged: false,
    },
    BrowserWindow: FakeWindow,
    globalShortcut: {
      register: (accel) => {
        if (/Invalido/i.test(accel)) throw new Error(`Invalid accelerator: ${accel}`);
        calls.registeredHotkeys.push(accel);
        return true;
      },
      unregister: (accel) => calls.unregistered.push(accel),
      unregisterAll: () => calls.unregistered.push('*'),
    },
    ipcMain: {
      on: (channel, cb) => ipcOnMap.set(channel, cb),
      handle: (channel, cb) => ipcHandleMap.set(channel, cb),
    },
    screen: {
      getCursorScreenPoint: () => ({ x: 1900, y: 60 }),
      getDisplayNearestPoint: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1040 } }),
      getPrimaryDisplay: () => ({ workAreaSize: { width: 1920, height: 1040 } }),
    },
    Tray: class {
      isDestroyed() { return false; }
      setToolTip() {}
      setContextMenu() {}
      on() {}
    },
    Menu: { buildFromTemplate: (t) => t },
    nativeImage: { createFromPath: () => ({ resize: () => ({}) }) },
    clipboard: {
      _text: 'contenido previo',
      readText() { return this._text; },
      writeText(t) { this._text = t; },
    },
    shell: {
      openExternal: (u) => calls.openedExternal.push(u),
      openPath: (p) => calls.openedPaths.push(p),
    },
  };

  const win32 = {
    GetForegroundWindow: () => ({ handle: 1 }),
    GetWindowThreadProcessId: (_hwnd, pidBuf) => { pidBuf[0] = 4242; return 1; },
    SetForegroundWindow: () => true,
    OpenProcess: () => ({ handle: 2 }),
    CloseHandle: () => true,
    GetModuleBaseNameW: (_h, _m, buf) => {
      const name = `${activeProcessName}.exe`;
      buf.write(name, 0, 'utf16le');
      return name.length;
    },
    SendInput: (count) => count,
    EnumWindows: () => true,
    IsWindowVisible: () => true,
    GetWindowTextLengthW: () => 5,
    GetCurrentThreadId: () => 1,
    AttachThreadInput: () => true,
    SetFocus: () => ({}),
  };

  const koffi = {
    load: () => ({ func: (name) => win32[name] || (() => 0) }),
    pointer: (a) => a,
    opaque: () => 'opaque',
    alias: (n) => n,
    proto: (n) => n,
    out: (t) => t,
    register: () => 'cb',
    unregister: () => {},
  };

  // Interceptar require
  const originalLoad = Module._load;
  Module._load = function patched(request, parent, isMain) {
    if (request === 'electron') return electron;
    if (request === 'koffi') return koffi;
    return originalLoad.call(this, request, parent, isMain);
  };

  // Silenciar logs internos del main
  const origLog = console.log;
  const origError = console.error;
  console.log = (...a) => calls.logs.push(a.join(' '));
  console.error = (...a) => calls.errors.push(a.join(' '));

  // Limpiar caché para que cada harness cargue el main de cero
  for (const p of [MAIN, KEYS, SCHEMA, VARS]) delete require.cache[p];
  require(MAIN);

  // Esperar a que `app.whenReady().then(...)` se ejecute completamente
  resolveReady();
  await readyPromise;
  // un tick extra para que el .then() termine
  await new Promise((r) => setImmediate(r));

  const restore = () => {
    Module._load = originalLoad;
    console.log = origLog;
    console.error = origError;
  };

  return {
    calls,
    ipc: { on: ipcOnMap, handle: ipcHandleMap },
    electron,
    restore,
  };
}

function tmpDir(tag) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `actionsring-${tag}-`));
}

function seedConfig(dir, content) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'config.json'), content, 'utf-8');
}

const SAMPLE = {
  hotkey: 'Control+Alt+Space',
  actions: {
    _default: [{ label: 'Lock', icon: 'Lock', type: 'command', value: 'rundll32 user32.dll,LockWorkStation' }],
    chrome: [{ label: 'Nueva pestaña', icon: 'Plus', type: 'shortcut', value: 'Control+T' }],
  },
  pinnedActions: [{ label: 'Lock', type: 'command', value: 'rundll32 user32.dll,LockWorkStation' }],
  rolProfiles: [],
  macros: [{ label: 'Copiar todo', icon: 'Play', steps: [{ keys: 'Control+A', delay: 80 }, { keys: 'Control+C', delay: 0 }] }],
};

// --------------------------------------------------------------------------
// Suites
// --------------------------------------------------------------------------
async function main() {
  // --- arranque ---
  out('\nmain.js — arranque');
  {
    const dir = tmpDir('boot');
    seedConfig(dir, JSON.stringify(SAMPLE));
    const h = await makeHarness({ userDataDir: dir });

    test('registra el hotkey de la config', () => {
      assert.deepEqual(h.calls.registeredHotkeys, ['Control+Alt+Space']);
    });

    test('registra todos los canales IPC que usan los preload', () => {
      for (const ch of ['execute-action', 'execute-macro', 'close-ring', 'renderer-log', 'ring-ready']) {
        assert.ok(h.ipc.on.has(ch), `falta ipcMain.on('${ch}')`);
      }
      for (const ch of ['get-config', 'save-config', 'get-running-apps', 'get-clipboard-history',
        'clear-clipboard-history', 'get-config-path', 'open-config-folder', 'validate-keys',
        'start-recording', 'stop-recording']) {
        assert.ok(h.ipc.handle.has(ch), `falta ipcMain.handle('${ch}')`);
      }
    });

    test('normaliza y persiste la config (pinned migrada a id)', () => {
      const saved = JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf-8'));
      assert.equal(typeof saved.pinnedActions[0], 'string', 'la pinned tiene que quedar como id');
      assert.equal(saved.pinnedActions[0], saved.actions._default[0].id);
    });

    test('get-config-path apunta a la carpeta de datos del usuario', () => {
      const p = h.ipc.handle.get('get-config-path')();
      assert.equal(p, path.join(dir, 'config.json'));
    });

    h.restore();
  }

  // --- apertura del anillo ---
  out('\nmain.js — apertura del anillo');
  {
    const dir = tmpDir('ring');
    seedConfig(dir, JSON.stringify(SAMPLE));
    const h = await makeHarness({ userDataDir: dir, activeProcessName: 'chrome' });

    test('sin ring-ready no se muestra el anillo (ventana en blanco)', () => {
      assert.equal(h.calls.sentMessages.filter((m) => m.channel === 'show-ring').length, 0);
      assert.equal(h.calls.overlayVisible, false);
    });

    test('ring-ready sin hotkey previo no abre el anillo solo', () => {
      h.ipc.on.get('ring-ready')();
      assert.equal(h.calls.overlayVisible, false);
    });

    test('close-ring oculta el overlay sin tirar error', () => {
      h.ipc.on.get('close-ring')();
      assert.equal(h.calls.overlayVisible, false);
    });

    test('validate-keys detecta teclas no reproducibles', () => {
      assert.deepEqual(h.ipc.handle.get('validate-keys')(null, 'Control+Alt+Space'), []);
      assert.deepEqual(h.ipc.handle.get('validate-keys')(null, 'Control+Inexistente'), ['Inexistente']);
    });

    test('get-config devuelve la config cargada', () => {
      const cfg = h.ipc.handle.get('get-config')();
      assert.equal(cfg.hotkey, 'Control+Alt+Space');
      assert.ok(Array.isArray(cfg.actions._default));
    });

    test('clear-clipboard-history vacía el historial', () => {
      assert.deepEqual(h.ipc.handle.get('clear-clipboard-history')(), []);
    });

    h.restore();
  }

  // --- hotkey inválido ---
  out('\nmain.js — hotkey inválido');
  {
    const dir = tmpDir('hotkey');
    seedConfig(dir, JSON.stringify(SAMPLE));
    const h = await makeHarness({ userDataDir: dir });

    test('guardar un hotkey inválido no tira excepción y cae al default', () => {
      const result = h.ipc.handle.get('save-config')(null, { ...SAMPLE, hotkey: 'Totalmente+Invalido' });
      assert.equal(result.hotkey, 'Control+Alt+Space', 'tiene que quedar el default');
      assert.ok(h.calls.errors.some((e) => e.includes('inválido')), 'tiene que loguear el error');
    });

    test('la app queda con un hotkey activo después de uno inválido', () => {
      const last = h.calls.registeredHotkeys[h.calls.registeredHotkeys.length - 1];
      assert.equal(last, 'Control+Alt+Space');
    });

    test('guardar un hotkey válido lo registra', () => {
      const result = h.ipc.handle.get('save-config')(null, { ...SAMPLE, hotkey: 'Control+Shift+F12' });
      assert.equal(result.hotkey, 'Control+Shift+F12');
    });

    test('guardar un hotkey nuevo lo reemplaza en el tray', () => {
      // El tooltip se actualiza en updateTrayTooltip; acá solo verificamos
      // que no se quede el hotkey viejo en la lista después del cambio
      const last = h.calls.registeredHotkeys[h.calls.registeredHotkeys.length - 1];
      assert.equal(last, 'Control+Shift+F12');
    });

    h.restore();
  }

  // --- config corrupta y faltante ---
  out('\nmain.js — config corrupta y faltante');
  {
    const corruptDir = tmpDir('corrupt');
    seedConfig(corruptDir, '{ esto no es json valido ');
    const h1 = await makeHarness({ userDataDir: corruptDir });

    test('arranca igual con un config corrupto', () => {
      assert.ok(h1.calls.registeredHotkeys.length > 0, 'tiene que haber registrado el hotkey');
    });

    test('respalda el archivo corrupto como .bad-<timestamp>', () => {
      const backups = fs.readdirSync(corruptDir).filter((f) => f.includes('.bad-'));
      assert.equal(backups.length, 1, `se esperaba 1 respaldo, hay ${backups.length}`);
    });

    test('deja un config válido escrito después de corrupción', () => {
      const written = JSON.parse(fs.readFileSync(path.join(corruptDir, 'config.json'), 'utf-8'));
      assert.ok(written.hotkey);
      assert.ok(Array.isArray(written.actions._default));
    });

    h1.restore();

    const missingDir = tmpDir('missing'); // sin config previa
    const h2 = await makeHarness({ userDataDir: missingDir });

    test('sin config previa crea uno desde los defaults publicados', () => {
      const written = JSON.parse(fs.readFileSync(path.join(missingDir, 'config.json'), 'utf-8'));
      assert.ok(Array.isArray(written.actions._default));
      assert.ok(written.actions._default.length > 0, 'tiene que traer acciones por defecto');
    });

    h2.restore();
  }

  // --- grabación ---
  out('\nmain.js — grabación de macros');
  {
    const dir = tmpDir('record');
    seedConfig(dir, JSON.stringify(SAMPLE));
    const h = await makeHarness({ userDataDir: dir });

    const hotkeysBefore = h.calls.registeredHotkeys.length;

    test('start-recording desregistra el hotkey', () => {
      const unregBefore = h.calls.unregistered.length;
      h.ipc.handle.get('start-recording')();
      assert.ok(h.calls.unregistered.length > unregBefore, 'tiene que liberar el hotkey');
    });

    test('stop-recording lo vuelve a registrar', () => {
      h.ipc.handle.get('stop-recording')();
      assert.ok(h.calls.registeredHotkeys.length > hotkeysBefore, 'tiene que volver a registrarlo');
    });

    h.restore();
  }

  // --- acciones ---
  out('\nmain.js — ejecución de acciones');
  {
    const dir = tmpDir('exec');
    seedConfig(dir, JSON.stringify(SAMPLE));
    const h = await makeHarness({ userDataDir: dir });

    // Ejecutar la acción de open con URL
    h.ipc.on.get('execute-action')(null, { type: 'open', value: 'https://canva.com' });

    // El main aplica un setTimeout de 200 ms antes de ejecutar; esperamos
    await new Promise((r) => setTimeout(r, 350));

    test('una acción de tipo open con URL abre el navegador, no el shell', () => {
      assert.deepEqual(h.calls.openedExternal, ['https://canva.com']);
    });

    // Sub-anillo: navigate to profile, no cierra el overlay
    h.ipc.on.get('ring-ready')();
    await new Promise((r) => setImmediate(r));

    test('una acción de tipo profile redirige al perfil sin cerrar el overlay', () => {
      const msgsBefore = h.calls.sentMessages.filter((m) => m.channel === 'show-ring').length;
      h.ipc.on.get('execute-action')(null, { type: 'profile', value: 'chrome' });
      const msgsAfter = h.calls.sentMessages.filter((m) => m.channel === 'show-ring').length;
      assert.ok(msgsAfter > msgsBefore, 'tiene que haber mandado show-ring al perfil chrome');
    });

    test('close-ring después de una acción no tira error', () => {
      assert.doesNotThrow(() => h.ipc.on.get('close-ring')());
    });

    h.restore();
  }

  // --------------------------------------------------------------------------
  out(`\n${passed} ok, ${failed} fallidos`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { out(`ERROR inesperado: ${e.message}`); process.exit(1); });
