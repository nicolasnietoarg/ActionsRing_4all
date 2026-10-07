// Mapeo de teclas y armado de los structs INPUT de Win32.
// Módulo puro (solo Buffer): no depende de Electron ni de koffi, así se
// puede testear con node sin levantar la app.

const INPUT_KEYBOARD = 1;
const KEYEVENTF_KEYUP = 0x0002;
const KEYEVENTF_EXTENDEDKEY = 0x0001;
const KEYEVENTF_UNICODE = 0x0004;

// sizeof(INPUT) en x64 = 4 (type) + 4 (padding) + 32 (union MOUSEINPUT) = 40.
// Dentro de la union, KEYBDINPUT arranca en el offset 8 del struct:
//   wVk @8, wScan @10, dwFlags @12, time @16, dwExtraInfo @24 (alineado a 8).
// El código anterior escribía dwExtraInfo en el offset 20, que es la
// posición equivocada (quedaba tapado por el relleno en cero).
const INPUT_SIZE = 40;
const OFF_TYPE = 0;
const OFF_VK = 8;
const OFF_SCAN = 10;
const OFF_FLAGS = 12;
const OFF_TIME = 16;
const OFF_EXTRA = 24;

const VK_MAP = {
  a: 0x41, b: 0x42, c: 0x43, d: 0x44, e: 0x45, f: 0x46, g: 0x47,
  h: 0x48, i: 0x49, j: 0x4A, k: 0x4B, l: 0x4C, m: 0x4D, n: 0x4E,
  o: 0x4F, p: 0x50, q: 0x51, r: 0x52, s: 0x53, t: 0x54, u: 0x55,
  v: 0x56, w: 0x57, x: 0x58, y: 0x59, z: 0x5A,
  0: 0x30, 1: 0x31, 2: 0x32, 3: 0x33, 4: 0x34,
  5: 0x35, 6: 0x36, 7: 0x37, 8: 0x38, 9: 0x39,
  f1: 0x70, f2: 0x71, f3: 0x72, f4: 0x73, f5: 0x74, f6: 0x75,
  f7: 0x76, f8: 0x77, f9: 0x78, f10: 0x79, f11: 0x7A, f12: 0x7B,
  enter: 0x0D, return: 0x0D, tab: 0x09, escape: 0x1B, esc: 0x1B,
  space: 0x20, backspace: 0x08, delete: 0x2E, del: 0x2E,
  arrowup: 0x26, arrowdown: 0x28, arrowleft: 0x25, arrowright: 0x27,
  up: 0x26, down: 0x28, left: 0x25, right: 0x27,
  home: 0x24, end: 0x23, pageup: 0x21, pagedown: 0x22,
  insert: 0x2D, printscreen: 0x2C, capslock: 0x14, numlock: 0x90, pause: 0x13,
  '`': 0xC0, '-': 0xBD, '=': 0xBB, '[': 0xDB, ']': 0xDD, '\\': 0xDC,
  ';': 0xBA, "'": 0xDE, ',': 0xBC, '.': 0xBE, '/': 0xBF,
  plus: 0xBB, minus: 0xBD,
  control: 0xA2, ctrl: 0xA2, shift: 0xA0, alt: 0xA4, option: 0xA4,
  win: 0x5B, meta: 0x5B, super: 0x5B, cmd: 0x5B,
  rcontrol: 0xA3, rctrl: 0xA3, rshift: 0xA1, ralt: 0xA5,
  // AltGr en Windows es Alt derecho (VK_RMENU). Antes no estaba mapeado y
  // cualquier macro grabada con AltGr tenía un paso que no hacía nada.
  altgr: 0xA5, altgraph: 0xA5,
  // Alias de los accelerators de Electron, para no marcar como inválido un
  // hotkey global correcto
  commandorcontrol: 0xA2, cmdorctrl: 0xA2,
  // Teclas multimedia
  volumemute: 0xAD, volumedown: 0xAE, volumeup: 0xAF,
  medianexttrack: 0xB0, mediaprevioustrack: 0xB1, mediastop: 0xB2, mediaplaypause: 0xB3,
};

// Teclas que requieren KEYEVENTF_EXTENDEDKEY
const EXTENDED_KEYS = new Set([
  0x25, 0x26, 0x27, 0x28, 0x24, 0x23, 0x21, 0x22, 0x2D, 0x2E, 0x5B,
  0xA3, 0xA5, 0x90, 0x2C,
  0xAD, 0xAE, 0xAF, 0xB0, 0xB1, 0xB2, 0xB3,
]);

function splitCombo(combo) {
  return String(combo || '')
    .split('+')
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
}

/** Teclas de un combo que SendInput no puede reproducir. */
function unmappedKeys(combo) {
  return splitCombo(combo).filter((k) => VK_MAP[k.toLowerCase()] === undefined);
}

/**
 * Convierte "Control+Shift+P" en la secuencia de eventos de teclado.
 * Devuelve { events, missing }: si `missing` tiene algo, `events` viene vacío
 * (antes se presionaban los modificadores y la tecla principal se perdía).
 */
function buildComboEvents(combo) {
  const parts = splitCombo(combo).map((k) => k.toLowerCase());
  if (!parts.length) return { events: [], missing: [] };

  const missing = parts.filter((k) => VK_MAP[k] === undefined);
  if (missing.length) return { events: [], missing };

  const mainKey = parts[parts.length - 1];
  const modifiers = parts.slice(0, -1);

  const events = [];
  for (const mod of modifiers) events.push({ vk: VK_MAP[mod], flags: 0 });
  events.push({ vk: VK_MAP[mainKey], flags: 0 });
  events.push({ vk: VK_MAP[mainKey], flags: KEYEVENTF_KEYUP });
  for (const mod of [...modifiers].reverse()) events.push({ vk: VK_MAP[mod], flags: KEYEVENTF_KEYUP });

  return { events, missing: [] };
}

/**
 * Eventos para escribir texto literal.
 * Recorre unidades de código UTF-16 y no caracteres, así los emoji y todo lo
 * que esté fuera del BMP se envían completos (antes se mandaba solo la mitad
 * alta del par surrogate). Enter y Tab van como teclas reales porque muchas
 * apps ignoran un \n enviado como Unicode.
 */
function buildTextEvents(text) {
  const str = String(text ?? '');
  const events = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code === 13) continue; // \r de un \r\n: se emite junto al \n
    if (code === 10) {
      events.push({ vk: VK_MAP.enter, flags: 0 }, { vk: VK_MAP.enter, flags: KEYEVENTF_KEYUP });
      continue;
    }
    if (code === 9) {
      events.push({ vk: VK_MAP.tab, flags: 0 }, { vk: VK_MAP.tab, flags: KEYEVENTF_KEYUP });
      continue;
    }
    events.push({ scan: code, flags: KEYEVENTF_UNICODE }, { scan: code, flags: KEYEVENTF_UNICODE | KEYEVENTF_KEYUP });
  }
  return events;
}

/** Serializa los eventos a un array de structs INPUT contiguos. */
function encodeInputs(events) {
  const buf = Buffer.alloc(INPUT_SIZE * events.length);
  events.forEach((ev, i) => {
    const offset = i * INPUT_SIZE;
    const vk = ev.vk || 0;
    let flags = ev.flags || 0;
    if (vk && EXTENDED_KEYS.has(vk)) flags |= KEYEVENTF_EXTENDEDKEY;
    buf.writeUInt32LE(INPUT_KEYBOARD, offset + OFF_TYPE);
    buf.writeUInt16LE(vk, offset + OFF_VK);
    buf.writeUInt16LE(ev.scan || 0, offset + OFF_SCAN);
    buf.writeUInt32LE(flags, offset + OFF_FLAGS);
    buf.writeUInt32LE(0, offset + OFF_TIME);
    buf.writeBigUInt64LE(0n, offset + OFF_EXTRA);
  });
  return buf;
}

module.exports = {
  INPUT_SIZE,
  OFF_TYPE,
  OFF_VK,
  OFF_SCAN,
  OFF_FLAGS,
  OFF_TIME,
  OFF_EXTRA,
  KEYEVENTF_KEYUP,
  KEYEVENTF_EXTENDEDKEY,
  KEYEVENTF_UNICODE,
  VK_MAP,
  EXTENDED_KEYS,
  unmappedKeys,
  buildComboEvents,
  buildTextEvents,
  encodeInputs,
};
