// Esquema de configuración y normalización.
// Módulo puro: no depende de Electron, se puede testear con node.

const DEFAULT_HOTKEY = 'Control+Alt+Space';

const DEFAULT_ANIMATION = { enabled: true, entrance: 'deck', exit: 'deck', speed: 1, stagger: 50 };

const DEFAULT_CONFIG = {
  hotkey: DEFAULT_HOTKEY,
  animation: { ...DEFAULT_ANIMATION },
  macros: [],
  rolProfiles: [],
  pinnedActions: [],
  actions: { _default: [] },
};

let idSeq = 0;
function genId() {
  idSeq += 1;
  return `a${Date.now().toString(36)}${idSeq.toString(36)}`;
}

/** Clave para reconocer una acción de una config vieja que no tenía id. */
function actionShapeKey(a) {
  return `${a.label}|${a.type}|${JSON.stringify(a.value)}`;
}

/**
 * Completa lo que falte y asigna ids estables a cada acción.
 * Devuelve { config, changed } para poder persistir la normalización una vez.
 *
 * Migra `pinnedActions` del formato viejo (copias completas de la acción) al
 * nuevo (ids). Con copias, renombrar la acción original dejaba la fijada
 * desactualizada. Las que no se puedan resolver se conservan inline para no
 * perder nada.
 */
function normalizeConfig(raw) {
  let changed = false;
  const cfg = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};

  if (typeof cfg.hotkey !== 'string' || !cfg.hotkey.trim()) { cfg.hotkey = DEFAULT_HOTKEY; changed = true; }
  if (!cfg.actions || typeof cfg.actions !== 'object' || Array.isArray(cfg.actions)) { cfg.actions = { _default: [] }; changed = true; }
  if (!Array.isArray(cfg.actions._default)) { cfg.actions._default = []; changed = true; }
  if (!Array.isArray(cfg.macros)) { cfg.macros = []; changed = true; }
  if (!Array.isArray(cfg.rolProfiles)) { cfg.rolProfiles = []; changed = true; }
  if (!Array.isArray(cfg.pinnedActions)) { cfg.pinnedActions = []; changed = true; }

  const anim = { ...DEFAULT_ANIMATION, ...(cfg.animation || {}) };
  if (JSON.stringify(anim) !== JSON.stringify(cfg.animation)) { cfg.animation = anim; changed = true; }

  const byShape = new Map();
  for (const key of Object.keys(cfg.actions)) {
    if (!Array.isArray(cfg.actions[key])) { cfg.actions[key] = []; changed = true; continue; }
    for (const action of cfg.actions[key]) {
      if (!action || typeof action !== 'object') continue;
      if (typeof action.id !== 'string' || !action.id) { action.id = genId(); changed = true; }
      const shape = actionShapeKey(action);
      if (!byShape.has(shape)) byShape.set(shape, action.id);
    }
  }

  const originalPinned = JSON.stringify(cfg.pinnedActions);
  const pinned = [];
  for (const entry of cfg.pinnedActions) {
    if (typeof entry === 'string') { pinned.push(entry); continue; }
    if (!entry || typeof entry !== 'object') continue;
    const id = byShape.get(actionShapeKey(entry));
    if (id) pinned.push(id);
    else {
      if (typeof entry.id !== 'string' || !entry.id) entry.id = genId();
      pinned.push(entry);
    }
  }
  cfg.pinnedActions = pinned;
  if (JSON.stringify(pinned) !== originalPinned) changed = true;

  return { config: cfg, changed };
}

/** Perfil del proceso activo. El match es case-insensitive. */
function profileActionsFor(cfg, appName) {
  const all = (cfg && cfg.actions) || {};
  if (Array.isArray(all[appName])) return all[appName];
  const wanted = String(appName || '').toLowerCase();
  const key = Object.keys(all).find((k) => k.toLowerCase() === wanted);
  if (key && Array.isArray(all[key])) return all[key];
  return Array.isArray(all._default) ? all._default : [];
}

/** Índice id → acción, sobre todos los perfiles. */
function actionsById(cfg) {
  const index = new Map();
  for (const list of Object.values((cfg && cfg.actions) || {})) {
    if (!Array.isArray(list)) continue;
    for (const action of list) if (action && action.id) index.set(action.id, action);
  }
  return index;
}

/** Acciones fijadas resueltas contra los perfiles, marcadas con _pinned. */
function resolvePinnedActions(cfg) {
  const index = actionsById(cfg);
  const out = [];
  for (const entry of ((cfg && cfg.pinnedActions) || [])) {
    const action = typeof entry === 'string' ? index.get(entry) : entry;
    if (action && typeof action === 'object') out.push({ ...action, _pinned: true });
  }
  return out;
}

/** Lista final del anillo: fijadas primero, sin repetir las del perfil. */
function buildRingActions(cfg, appName) {
  const pinned = resolvePinnedActions(cfg);
  const pinnedIds = new Set(pinned.map((a) => a.id).filter(Boolean));
  const pinnedLabels = new Set(pinned.map((a) => a.label));
  const profile = profileActionsFor(cfg, appName)
    .filter((a) => a && !pinnedIds.has(a.id) && !pinnedLabels.has(a.label));
  return [...pinned, ...profile];
}

module.exports = {
  DEFAULT_HOTKEY,
  DEFAULT_ANIMATION,
  DEFAULT_CONFIG,
  genId,
  actionShapeKey,
  normalizeConfig,
  profileActionsFor,
  actionsById,
  resolvePinnedActions,
  buildRingActions,
};
