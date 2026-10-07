// Tests de la lógica pura del proceso principal.
// Sin dependencias: se corre con `npm test` (node puro, no hace falta Electron).
//
// Cada bloque referencia el bug que cubre, para que una regresión futura
// falle acá y no en producción.

const assert = require('node:assert/strict');
const keys = require('../src/main/keys');
const schema = require('../src/main/config-schema');
const vars = require('../src/main/variables');

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ok   ${name}`);
  } catch (e) {
    failed += 1;
    failures.push({ name, message: e.message });
    console.log(`  FAIL ${name}`);
    console.log(`       ${e.message.split('\n')[0]}`);
  }
}

function suite(title, fn) {
  console.log(`\n${title}`);
  fn();
}

const clone = (o) => JSON.parse(JSON.stringify(o));

// ---------------------------------------------------------------------------
suite('keys — mapeo de teclas y structs INPUT', () => {
  test('un combo genera down de modificadores, down/up de la tecla y up en orden inverso', () => {
    const { events, missing } = keys.buildComboEvents('Control+Shift+P');
    assert.deepEqual(missing, []);
    assert.equal(events.length, 6);
    assert.deepEqual(events.map((e) => e.vk), [0xA2, 0xA0, 0x50, 0x50, 0xA0, 0xA2]);
    assert.deepEqual(events.map((e) => e.flags), [0, 0, 0, keys.KEYEVENTF_KEYUP, keys.KEYEVENTF_KEYUP, keys.KEYEVENTF_KEYUP]);
  });

  test('AltGr se mapea a Alt derecho (antes el paso no hacía nada)', () => {
    const { events, missing } = keys.buildComboEvents('AltGraph');
    assert.deepEqual(missing, []);
    assert.equal(events.length, 2);
    assert.equal(events[0].vk, 0xA5);
  });

  test('una tecla sin mapeo no envía nada en lugar de dejar modificadores colgados', () => {
    const { events, missing } = keys.buildComboEvents('Control+Dead');
    assert.deepEqual(missing, ['dead']);
    assert.equal(events.length, 0);
  });

  test('las teclas multimedia están mapeadas', () => {
    assert.equal(keys.buildComboEvents('MediaPlayPause').events[0].vk, 0xB3);
    assert.equal(keys.buildComboEvents('VolumeUp').events[0].vk, 0xAF);
  });

  test('un accelerator global válido no se reporta como tecla inválida', () => {
    assert.deepEqual(keys.unmappedKeys('Control+Alt+Space'), []);
    assert.deepEqual(keys.unmappedKeys('CommandOrControl+Shift+Space'), []);
    assert.deepEqual(keys.unmappedKeys('Super+K'), []);
    assert.deepEqual(keys.unmappedKeys('Control+Nope'), ['Nope']);
  });

  test('un emoji se escribe completo (antes se mandaba media surrogate pair)', () => {
    const events = keys.buildTextEvents('😀');
    assert.equal(events.length, 4); // 2 code units x (down + up)
    assert.equal(events[0].scan, 0xD83D);
    assert.equal(events[2].scan, 0xDE00);
  });

  test('un salto de línea va como tecla Enter real, no como unicode 10', () => {
    const events = keys.buildTextEvents('a\nb');
    const enter = events.find((e) => e.vk === keys.VK_MAP.enter);
    assert.ok(enter, 'tiene que haber un evento con VK_RETURN');
    assert.ok(!events.some((e) => e.scan === 10), 'no debe quedar un unicode 10');
  });

  test('\\r\\n no duplica el Enter', () => {
    const events = keys.buildTextEvents('a\r\nb');
    assert.equal(events.filter((e) => e.vk === keys.VK_MAP.enter).length, 2); // down + up
  });

  test('el struct INPUT mide 40 bytes y dwExtraInfo va en el offset 24', () => {
    assert.equal(keys.INPUT_SIZE, 40);
    assert.equal(keys.OFF_EXTRA, 24);
    const buf = keys.encodeInputs([{ vk: 0x41, flags: 0 }]);
    assert.equal(buf.length, 40);
    assert.equal(buf.readUInt32LE(keys.OFF_TYPE), 1);   // INPUT_KEYBOARD
    assert.equal(buf.readUInt16LE(keys.OFF_VK), 0x41);
    assert.equal(buf.readUInt32LE(keys.OFF_FLAGS), 0);
    assert.equal(buf.readBigUInt64LE(keys.OFF_EXTRA), 0n);
  });

  test('las teclas extendidas llevan el flag KEYEVENTF_EXTENDEDKEY', () => {
    const buf = keys.encodeInputs([{ vk: keys.VK_MAP.arrowleft, flags: 0 }]);
    assert.equal(buf.readUInt32LE(keys.OFF_FLAGS) & keys.KEYEVENTF_EXTENDEDKEY, keys.KEYEVENTF_EXTENDEDKEY);
    const plain = keys.encodeInputs([{ vk: keys.VK_MAP.a, flags: 0 }]);
    assert.equal(plain.readUInt32LE(keys.OFF_FLAGS) & keys.KEYEVENTF_EXTENDEDKEY, 0);
  });

  test('los eventos unicode no escriben wVk', () => {
    const buf = keys.encodeInputs(keys.buildTextEvents('x'));
    assert.equal(buf.readUInt16LE(keys.OFF_VK), 0);
    assert.equal(buf.readUInt16LE(keys.OFF_SCAN), 'x'.charCodeAt(0));
    assert.equal(buf.readUInt32LE(keys.OFF_FLAGS), keys.KEYEVENTF_UNICODE);
  });
});

// ---------------------------------------------------------------------------
suite('config-schema — normalización y acciones fijadas', () => {
  test('una config vacía queda usable y no rompe la app', () => {
    const { config, changed } = schema.normalizeConfig({});
    assert.equal(changed, true);
    assert.equal(config.hotkey, schema.DEFAULT_HOTKEY);
    assert.deepEqual(config.actions._default, []);
    assert.deepEqual(config.macros, []);
    assert.deepEqual(config.pinnedActions, []);
    assert.equal(config.animation.entrance, 'deck');
  });

  test('tolera tipos basura sin tirar excepción', () => {
    const { config } = schema.normalizeConfig({ hotkey: 42, actions: 'nope', macros: {}, pinnedActions: 'x', animation: 7 });
    assert.equal(config.hotkey, schema.DEFAULT_HOTKEY);
    assert.deepEqual(config.actions, { _default: [] });
    assert.deepEqual(config.macros, []);
    assert.deepEqual(config.pinnedActions, []);
  });

  test('asigna ids a las acciones y es idempotente en la segunda pasada', () => {
    const first = schema.normalizeConfig({ actions: { _default: [{ label: 'A', type: 'shortcut', value: 'Control+A' }] } });
    assert.equal(first.changed, true);
    const id = first.config.actions._default[0].id;
    assert.ok(id, 'la acción tiene que tener id');
    const second = schema.normalizeConfig(first.config);
    assert.equal(second.changed, false, 'no debería volver a reescribir');
    assert.equal(second.config.actions._default[0].id, id);
  });

  test('migra pinnedActions del formato viejo (copia) al nuevo (id)', () => {
    const raw = {
      actions: { _default: [{ label: 'Screenshot', type: 'command', value: 'snip' }] },
      pinnedActions: [{ label: 'Screenshot', type: 'command', value: 'snip' }],
    };
    const { config } = schema.normalizeConfig(raw);
    const id = config.actions._default[0].id;
    assert.deepEqual(config.pinnedActions, [id]);
  });

  test('una pinned que no matchea ninguna acción se conserva inline (no se pierde)', () => {
    const { config } = schema.normalizeConfig({
      actions: { _default: [] },
      pinnedActions: [{ label: 'Huérfana', type: 'open', value: 'notepad' }],
    });
    assert.equal(config.pinnedActions.length, 1);
    assert.equal(typeof config.pinnedActions[0], 'object');
    assert.equal(config.pinnedActions[0].label, 'Huérfana');
    assert.equal(schema.resolvePinnedActions(config)[0].label, 'Huérfana');
  });

  test('renombrar la acción original se refleja en la fijada', () => {
    const { config } = schema.normalizeConfig({
      actions: { _default: [{ label: 'Viejo', type: 'open', value: 'notepad' }] },
      pinnedActions: [{ label: 'Viejo', type: 'open', value: 'notepad' }],
    });
    config.actions._default[0].label = 'Nuevo';
    config.actions._default[0].value = 'wordpad';
    const pinned = schema.resolvePinnedActions(config);
    assert.equal(pinned[0].label, 'Nuevo');
    assert.equal(pinned[0].value, 'wordpad');
  });

  test('el perfil se resuelve sin importar mayúsculas', () => {
    const cfg = schema.normalizeConfig({
      actions: { _default: [{ label: 'D', type: 'open', value: 'x' }], chrome: [{ label: 'C', type: 'open', value: 'y' }] },
    }).config;
    assert.equal(schema.profileActionsFor(cfg, 'chrome')[0].label, 'C');
    assert.equal(schema.profileActionsFor(cfg, 'Chrome')[0].label, 'C');
    assert.equal(schema.profileActionsFor(cfg, 'CHROME')[0].label, 'C');
    assert.equal(schema.profileActionsFor(cfg, 'desconocida')[0].label, 'D');
  });

  test('el anillo pone las fijadas primero y no repite la del perfil', () => {
    const cfg = schema.normalizeConfig({
      actions: {
        _default: [{ label: 'Lock', type: 'command', value: 'l' }],
        chrome: [{ label: 'Lock', type: 'command', value: 'l' }, { label: 'Tab', type: 'shortcut', value: 'Control+T' }],
      },
      pinnedActions: [{ label: 'Lock', type: 'command', value: 'l' }],
    }).config;
    const ring = schema.buildRingActions(cfg, 'chrome');
    assert.deepEqual(ring.map((a) => a.label), ['Lock', 'Tab']);
    assert.equal(ring[0]._pinned, true);
    assert.equal(ring.filter((a) => a.label === 'Lock').length, 1);
  });

  test('un perfil sin acciones devuelve lista vacía, no explota', () => {
    const cfg = schema.normalizeConfig({ actions: { _default: [], vacio: [] } }).config;
    assert.deepEqual(schema.buildRingActions(cfg, 'vacio'), []);
  });
});

// ---------------------------------------------------------------------------
suite('variables — expansión, saneo e inyección de comandos', () => {
  const V = { clipboard: 'hola mundo', date: '07/10/2026', time: '14:30', datetime: '2026-10-07T14:30:00Z', app: 'chrome' };

  test('modo raw deja el texto tal cual (snippets y type:)', () => {
    assert.equal(vars.expandVariables('Hola {clipboard} desde {app}', V, 'raw'), 'Hola hola mundo desde chrome');
  });

  test('modo url codifica lo interpolado', () => {
    assert.equal(vars.expandVariables('q={clipboard}', V, 'url'), 'q=hola%20mundo');
  });

  test('modo shell neutraliza los metacaracteres de cmd.exe', () => {
    const malicioso = { ...V, clipboard: 'x & calc.exe' };
    const out = vars.expandVariables('echo {clipboard}', malicioso, 'shell');
    assert.ok(!out.includes('&'), `no debe quedar un & suelto: ${out}`);
    assert.ok(!vars.hasShellMeta(out.replace('echo ', '')), 'lo interpolado tiene que quedar limpio');
  });

  test('hasShellMeta no cambia de respuesta entre llamadas (bug del flag /g)', () => {
    for (let i = 0; i < 5; i++) assert.equal(vars.hasShellMeta('a & b'), true, `iteración ${i}`);
    for (let i = 0; i < 5; i++) assert.equal(vars.hasShellMeta('limpio'), false, `iteración ${i}`);
  });

  test('la acción Google por defecto se abre como URL y no por el shell', () => {
    const plan = vars.planCommand('start https://www.google.com/search?q={clipboard}', V);
    assert.equal(plan.kind, 'url');
    assert.equal(plan.url, 'https://www.google.com/search?q=hola%20mundo');
  });

  test('un portapapeles con & no inyecta comandos en la búsqueda', () => {
    const plan = vars.planCommand('start https://www.google.com/search?q={clipboard}', { ...V, clipboard: 'x & calc.exe' });
    assert.equal(plan.kind, 'url');
    assert.ok(!plan.url.includes('&'), `el & tiene que quedar codificado: ${plan.url}`);
    assert.ok(plan.url.includes('%26'));
  });

  test('window: se reconoce antes de expandir variables', () => {
    assert.deepEqual(vars.planCommand('window:left', V), { kind: 'window', position: 'left' });
    assert.deepEqual(vars.planCommand('window:MAXIMIZE', V), { kind: 'window', position: 'maximize' });
  });

  test('un comando de shell común sigue funcionando', () => {
    assert.deepEqual(vars.planCommand('wt -d .', V), { kind: 'shell', command: 'wt -d .' });
  });

  test('open: nombre corto va por start, ruta existente por el shell del SO, URL al navegador', () => {
    assert.deepEqual(vars.planOpen('notepad'), { kind: 'start', target: 'notepad' });
    assert.deepEqual(vars.planOpen('https://canva.com'), { kind: 'url', url: 'https://canva.com' });
    assert.deepEqual(vars.planOpen('C:\\apps\\x.exe', () => true), { kind: 'path', path: 'C:\\apps\\x.exe' });
  });

  test('open rechaza valores con metacaracteres de shell', () => {
    assert.equal(vars.planOpen('notepad & calc').kind, 'rejected');
    assert.equal(vars.planOpen('').kind, 'rejected');
  });

  test('el delay de una macro es la espera DESPUÉS del paso', () => {
    const plan = vars.scheduleMacro([
      { keys: 'Control+A', delay: 80 },
      { keys: 'Control+C', delay: 0 },
    ]);
    assert.deepEqual(plan, [{ at: 0, keys: 'Control+A' }, { at: 80, keys: 'Control+C' }]);
  });

  test('un delay 0 explícito se respeta (antes `|| 50` lo convertía en 50 ms)', () => {
    const plan = vars.scheduleMacro([{ keys: 'A', delay: 0 }, { keys: 'B', delay: 0 }, { keys: 'C', delay: 0 }]);
    assert.deepEqual(plan.map((s) => s.at), [0, 0, 0]);
  });

  test('un delay ausente o inválido cae en 50 ms', () => {
    const plan = vars.scheduleMacro([{ keys: 'A' }, { keys: 'B', delay: 'xx' }, { keys: 'C', delay: -5 }]);
    assert.deepEqual(plan.map((s) => s.at), [0, 50, 100]);
  });

  test('pasos basura se ignoran sin romper la macro', () => {
    const plan = vars.scheduleMacro([null, { keys: 'A', delay: 10 }, 'x', { keys: 'B', delay: 0 }]);
    assert.deepEqual(plan, [{ at: 0, keys: 'A' }, { at: 10, keys: 'B' }]);
  });

  test('scheduleMacro tolera un valor que no es array', () => {
    assert.deepEqual(vars.scheduleMacro(undefined), []);
    assert.deepEqual(vars.scheduleMacro('nope'), []);
  });
});

// ---------------------------------------------------------------------------
suite('config shipped — el archivo que se publica queda sano', () => {
  const shipped = require('../config/default.json');

  test('el default publicado normaliza sin cambios estructurales inesperados', () => {
    const { config } = schema.normalizeConfig(clone(shipped));
    assert.ok(Array.isArray(config.actions._default));
    assert.ok(config.actions._default.length > 0);
    assert.deepEqual(keys.unmappedKeys(config.hotkey), [], 'el hotkey por defecto tiene que ser reproducible');
  });

  test('ninguna macro publicada tipea credenciales', () => {
    const texto = JSON.stringify(shipped.macros || []).toLowerCase();
    for (const patron of ['prism', 'password', 'passwd', '@007']) {
      assert.ok(!texto.includes(patron), `la macro publicada no debe contener "${patron}"`);
    }
  });

  test('todos los pasos de las macros publicadas son reproducibles', () => {
    for (const macro of (shipped.macros || [])) {
      for (const step of (macro.steps || [])) {
        const k = String(step.keys || '');
        if (k.startsWith('type:')) continue;
        assert.deepEqual(keys.unmappedKeys(k), [], `macro "${macro.label}", paso "${k}"`);
      }
    }
  });

  test('todas las acciones de tipo shortcut publicadas son reproducibles', () => {
    for (const [profile, list] of Object.entries(shipped.actions || {})) {
      for (const action of list) {
        if (action.type !== 'shortcut') continue;
        assert.deepEqual(keys.unmappedKeys(action.value), [], `perfil ${profile}, acción "${action.label}" (${action.value})`);
      }
    }
  });

  test('los perfiles declarados en rolProfiles existen', () => {
    for (const name of (shipped.rolProfiles || [])) {
      assert.ok(shipped.actions[name], `rolProfiles menciona "${name}" pero no hay perfil con ese nombre`);
    }
  });
});

// ---------------------------------------------------------------------------
console.log(`\n${passed} ok, ${failed} fallidos`);
if (failed) {
  console.log('\nFallos:');
  for (const f of failures) console.log(`  - ${f.name}\n    ${f.message.split('\n')[0]}`);
  process.exit(1);
}
