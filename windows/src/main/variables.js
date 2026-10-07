// Expansión de variables dinámicas y saneo de lo interpolado.
// Módulo puro: recibe los valores ya resueltos, así se puede testear sin
// Electron (el portapapeles lo lee el proceso principal).

// Caracteres con significado para cmd.exe. Al interpolar el portapapeles
// (entrada no confiable) dentro de un comando, se neutralizan: antes un
// portapapeles con `& calc` ejecutaba comandos arbitrarios.
// Dos regex: la global es solo para replace, porque .test() con una regex /g
// mantiene lastIndex entre llamadas y devuelve resultados alternados.
const CMD_META_REPLACE = /["&|<>^%()!\r\n]/g;
const CMD_META_TEST = /["&|<>^%()!\r\n]/;

// `start <url>` o una URL suelta. Se detecta ANTES de expandir para que la
// variable se codifique como componente de URL.
const URL_COMMAND = /^(?:start\s+(?:""\s+)?)?((?:https?|mailto):\S*)$/i;

/**
 * @param {string} value plantilla con {clipboard}, {date}, {time}, {datetime}, {app}
 * @param {Record<string,string>} vars valores ya resueltos
 * @param {'raw'|'shell'|'url'} mode cómo sanear lo interpolado
 */
function expandVariables(value, vars = {}, mode = 'raw') {
  const sub = (text) => {
    const s = String(text ?? '');
    if (mode === 'url') return encodeURIComponent(s);
    if (mode === 'shell') return s.replace(CMD_META_REPLACE, ' ');
    return s;
  };
  return String(value ?? '')
    .replace(/\{clipboard\}/g, () => sub(vars.clipboard))
    .replace(/\{date\}/g, () => sub(vars.date))
    .replace(/\{time\}/g, () => sub(vars.time))
    .replace(/\{datetime\}/g, () => sub(vars.datetime))
    .replace(/\{app\}/g, () => sub(vars.app));
}

/** true si el valor trae caracteres que no deberían llegar al shell. */
function hasShellMeta(value) {
  return CMD_META_TEST.test(String(value ?? ''));
}

/**
 * Decide cómo ejecutar una acción de tipo `command`, sin ejecutar nada.
 * Devuelve:
 *   { kind: 'window', position }  → atajo de ventana
 *   { kind: 'url', url }          → abrir en el navegador, sin shell
 *   { kind: 'shell', command }    → cmd.exe con las variables saneadas
 */
function planCommand(template, vars = {}) {
  const raw = String(template ?? '');

  if (raw.startsWith('window:')) {
    return { kind: 'window', position: raw.slice('window:'.length).trim().toLowerCase() };
  }

  const urlMatch = raw.match(URL_COMMAND);
  if (urlMatch) {
    return { kind: 'url', url: expandVariables(urlMatch[1], vars, 'url') };
  }

  return { kind: 'shell', command: expandVariables(raw, vars, 'shell') };
}

/**
 * Decide cómo abrir un target de tipo `open`, sin ejecutar nada.
 * `exists` se inyecta para poder testear sin tocar el filesystem.
 *   { kind: 'url', url }         → protocolo conocido
 *   { kind: 'path', path }       → archivo o carpeta existente
 *   { kind: 'start', target }    → nombre corto, lo resuelve `start` del shell
 *   { kind: 'rejected', target } → trae metacaracteres de shell
 */
function planOpen(value, exists = () => false) {
  const target = String(value ?? '').trim();
  if (!target) return { kind: 'rejected', target };
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(target)) return { kind: 'url', url: target };
  if (/[\\/:]/.test(target) && exists(target)) return { kind: 'path', path: target };
  if (hasShellMeta(target)) return { kind: 'rejected', target };
  return { kind: 'start', target };
}

/**
 * Pasos de una macro con su momento de ejecución acumulado.
 * `delay` es la espera DESPUÉS de cada paso, igual que en el editor y en las
 * macros escritas a mano. Un 0 explícito se respeta: antes `step.delay || 50`
 * lo convertía en 50 ms.
 */
function scheduleMacro(steps) {
  const list = Array.isArray(steps) ? steps : [];
  const out = [];
  let elapsed = 0;
  for (const step of list) {
    if (!step || typeof step !== 'object') continue;
    out.push({ at: elapsed, keys: String(step.keys || '') });
    const d = Number(step.delay);
    elapsed += Number.isFinite(d) && d >= 0 ? d : 50;
  }
  return out;
}

module.exports = {
  CMD_META_REPLACE,
  CMD_META_TEST,
  expandVariables,
  hasShellMeta,
  planCommand,
  planOpen,
  scheduleMacro,
};
