import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { Copy, ClipboardPaste, Undo2, Save, Camera, Lock, Moon, Search, Terminal, Palette, GitBranch, FolderOpen, Columns2, X, Plus, RefreshCw, Link, EyeOff, ArrowLeft, ArrowRight, Code, Star, FolderPlus, Eye, Info, Trash2, Share2, Navigation, Trash, PenSquare, Reply, ReplyAll, Forward, Send, Archive, CheckCheck, FilePlus, Bold, List, ListChecks, Table, Pin, MessageSquarePlus, VolumeX, ChevronDown, ChevronUp, Pencil, Sparkles, Square, PenLine, PanelLeft, Play, SkipForward, SkipBack, Heart, Shuffle, Repeat, Volume2, CalendarPlus, CalendarCheck, Calendar, CalendarDays, CalendarRange, ZoomIn, ZoomOut, Maximize2, RotateCw, Download, Printer, Command, Target, Music, Globe, Compass, Mail, StickyNote, MessageCircle, Folder, Image, AppWindow, Clipboard, Move, Zap, Circle, GripVertical, Film, AlertTriangle, Keyboard } from 'lucide-react';

const iconMap = { Copy, ClipboardPaste, Undo2, Save, Camera, Lock, Moon, Search, Terminal, Palette, GitBranch, FolderOpen, Columns2, X, Plus, RefreshCw, Link, EyeOff, ArrowLeft, ArrowRight, Code, Star, FolderPlus, Eye, Info, Trash2, Share2, Navigation, Trash, PenSquare, Reply, ReplyAll, Forward, Send, Archive, CheckCheck, FilePlus, Bold, List, ListChecks, Table, Pin, MessageSquarePlus, VolumeX, ChevronDown, ChevronUp, Pencil, Sparkles, Square, PenLine, PanelLeft, Play, SkipForward, SkipBack, Heart, Shuffle, Repeat, Volume2, CalendarPlus, CalendarCheck, Calendar, CalendarDays, CalendarRange, ZoomIn, ZoomOut, Maximize2, RotateCw, Download, Printer, Command, Target, Music, Globe, Compass, Mail, StickyNote, MessageCircle, Folder, Image, AppWindow, Clipboard, Move, Zap, Circle, GripVertical, Film, AlertTriangle, Keyboard };

function Icon({ name, size = 18 }) {
  const LucideIcon = iconMap[name];
  if (LucideIcon) return <LucideIcon size={size} strokeWidth={1.8} />;
  return <span>{name}</span>;
}

let idSeq = 0;
function genId() {
  idSeq += 1;
  return `a${Date.now().toString(36)}${idSeq.toString(36)}`;
}

// Las acciones necesitan un id estable para que las pinned sean una
// referencia y no una copia: así renombrar la original se refleja sola.
function withIds(cfg) {
  const next = { ...cfg, actions: { ...(cfg.actions || {}) } };
  for (const [profile, list] of Object.entries(next.actions)) {
    if (!Array.isArray(list)) { next.actions[profile] = []; continue; }
    next.actions[profile] = list.map((a) => (a && a.id ? a : { ...a, id: genId() }));
  }
  return next;
}

const ACCEL_KEY_ALIASES = { ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right', Escape: 'Esc', ' ': 'Space' };

/**
 * mode 'accelerator' → formato de atajo global de Electron (modificador Super).
 * mode 'keys'        → formato que entiende SendInput (modificador Win).
 */
function KeyRecorder({ value, onChange, mode = 'keys' }) {
  const [recording, setRecording] = useState(false);
  const modsRef = useRef(new Set());

  useEffect(() => {
    if (!recording) return;
    modsRef.current = new Set();

    const downHandler = (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === 'Meta' || e.key === 'OS') { modsRef.current.add('Meta'); return; }
      if (e.key === 'Control') { modsRef.current.add('Control'); return; }
      if (e.key === 'Shift') { modsRef.current.add('Shift'); return; }
      if (e.key === 'Alt' || e.key === 'AltGraph') { modsRef.current.add('Alt'); return; }

      const parts = [];
      if (modsRef.current.has('Control')) parts.push('Control');
      if (modsRef.current.has('Alt')) parts.push('Alt');
      if (modsRef.current.has('Shift')) parts.push('Shift');
      // "Win" no es un modificador válido para los atajos globales de Electron:
      // ahí se llama "Super". Para las acciones de teclas sí se usa "Win".
      if (modsRef.current.has('Meta')) parts.push(mode === 'accelerator' ? 'Super' : 'Win');

      let key = e.key;
      if (mode === 'accelerator' && ACCEL_KEY_ALIASES[key]) key = ACCEL_KEY_ALIASES[key];
      else if (key === ' ') key = 'Space';
      if (key.length === 1) key = key.toUpperCase();

      parts.push(key);
      onChange(parts.join('+'));
      setRecording(false);
    };

    const upHandler = (e) => { if (e.key === 'Escape') setRecording(false); };

    window.addEventListener('keydown', downHandler, true);
    window.addEventListener('keyup', upHandler, true);
    return () => {
      window.removeEventListener('keydown', downHandler, true);
      window.removeEventListener('keyup', upHandler, true);
    };
  }, [recording, mode, onChange]);

  return (
    <button className={`key-recorder ${recording ? 'recording' : ''}`} onClick={() => setRecording(true)}>
      {recording ? <><Circle size={9} fill="currentColor" /> Presioná las teclas...</> : (value || 'Click para grabar')}
    </button>
  );
}

function HotkeySection({ config, save }) {
  const [warning, setWarning] = useState('');

  const setHotkey = (value) => {
    setWarning('');
    save({ ...config, hotkey: value });
  };

  useEffect(() => {
    let alive = true;
    window.settings.validateKeys(config.hotkey).then((missing) => {
      if (!alive) return;
      setWarning(missing.length ? `Teclas no reconocidas: ${missing.join(', ')}` : '');
    });
    return () => { alive = false; };
  }, [config.hotkey]);

  return (
    <div className="section">
      <div className="section-label section-label-icon"><Keyboard size={13} /> Hotkey global</div>
      <div className="hotkey-row">
        <KeyRecorder value={config.hotkey} onChange={setHotkey} mode="accelerator" />
        <input
          className="input-field hotkey-manual"
          value={config.hotkey}
          onChange={(e) => setHotkey(e.target.value)}
          placeholder="Control+Alt+Space"
          aria-label="Hotkey global (edición manual)"
        />
      </div>
      {warning && <div className="warn-text"><AlertTriangle size={12} /> {warning}</div>}
      <div className="macro-hint">
        Si la combinación la tiene tomada otra app, no se registra y se vuelve a <code>Control+Alt+Space</code>.
        El anillo también se abre desde el ícono del tray.
      </div>
    </div>
  );
}

function ClipboardPanel() {
  const [history, setHistory] = useState([]);

  const refresh = useCallback(() => { window.settings.getClipboardHistory().then(setHistory); }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
  }, [refresh]);

  return (
    <>
      <h2>Clipboard History</h2>
      <div className="section">
        <div className="section-label">Últimos {history.length} items copiados</div>
        <div className="actions-table">
          {history.map((text, i) => (
            <div key={i} className="action-row" onClick={() => navigator.clipboard.writeText(text)} title="Click para copiar de nuevo">
              <span className="row-icon"><Icon name="Clipboard" /></span>
              <span className="row-label" style={{ fontFamily: 'Consolas, monospace', fontSize: 11 }}>
                {text.slice(0, 60)}{text.length > 60 ? '...' : ''}
              </span>
            </div>
          ))}
          {!history.length && <div className="action-row"><span className="row-label" style={{ opacity: 0.5 }}>Aún no hay items</span></div>}
        </div>
        <div className="btn-row">
          {/* El historial puede capturar lo que copiás de un gestor de
              contraseñas: conviene poder vaciarlo a mano. */}
          <button className="btn btn-danger" onClick={() => window.settings.clearClipboardHistory().then(setHistory)}>
            <Trash2 size={13} /> Vaciar historial
          </button>
        </div>
        <div className="macro-hint">Se guarda solo en memoria (máx. 20 items) y se borra al salir de la app.</div>
      </div>
    </>
  );
}

function MacroEditor({ value, onChange }) {
  const steps = Array.isArray(value) ? value : (() => { try { return JSON.parse(value); } catch { return []; } })();
  const [badKeys, setBadKeys] = useState({});

  // Se avisa si un paso usa una tecla que SendInput no puede reproducir:
  // antes esos pasos se ejecutaban como no-op, en silencio.
  useEffect(() => {
    let alive = true;
    Promise.all(steps.map((s) => {
      const keys = String(s.keys || '');
      if (!keys || keys.startsWith('type:')) return Promise.resolve([]);
      return window.settings.validateKeys(keys);
    })).then((results) => {
      if (!alive) return;
      const map = {};
      results.forEach((missing, i) => { if (missing.length) map[i] = missing; });
      setBadKeys(map);
    });
    return () => { alive = false; };
  }, [JSON.stringify(steps)]);

  const update = (newSteps) => onChange(newSteps);
  const updateStep = (i, field, val) => { const s = [...steps]; s[i] = { ...s[i], [field]: val }; update(s); };
  const addStep = () => update([...steps, { keys: '', delay: 50 }]);
  const removeStep = (i) => update(steps.filter((_, j) => j !== i));

  return (
    <div className="macro-editor">
      <div className="section-label">Pasos de la macro</div>
      {steps.map((step, i) => (
        <div key={i}>
          <div className="macro-step">
            <span className="macro-step-num">{i + 1}</span>
            <input className="macro-input" value={step.keys || ''} onChange={(e) => updateStep(i, 'keys', e.target.value)} placeholder="Control+C o type:texto" />
            <input className="macro-delay" type="number" min="0" value={step.delay ?? 0} onChange={(e) => updateStep(i, 'delay', Math.max(0, parseInt(e.target.value, 10) || 0))} title="Espera después de este paso (ms)" />
            <span className="macro-delay-label">ms</span>
            <button className="macro-remove" aria-label="Eliminar paso" onClick={() => removeStep(i)}><X size={14} /></button>
          </div>
          {badKeys[i] && <div className="warn-text"><AlertTriangle size={12} /> Paso {i + 1}: {badKeys[i].join(', ')} no se puede reproducir</div>}
        </div>
      ))}
      <button className="btn btn-small" onClick={addStep}><Plus size={12} /> Paso</button>
      <div className="macro-hint">
        <code>type:texto</code> escribe texto literal; si no, es un atajo tipo <code>Control+A</code>.
        El delay es la espera <strong>después</strong> del paso.
      </div>
    </div>
  );
}

function MacrosSection({ config, save }) {
  const macros = config.macros || [];
  const [recording, setRecording] = useState(false);
  const [recordedSteps, setRecordedSteps] = useState([]);
  const [liveKeys, setLiveKeys] = useState([]);
  const [newName, setNewName] = useState('');
  const [expanded, setExpanded] = useState(-1);
  const lastKeyTime = useRef(Date.now());
  const liveRef = useRef(null);

  const startRecording = async () => {
    setRecordedSteps([]);
    setLiveKeys([]);
    setRecording(true);
    lastKeyTime.current = Date.now();
    await window.settings.startRecording();
  };

  const stopRecording = useCallback(async () => {
    setRecording(false);
    await window.settings.stopRecording();
  }, []);

  useEffect(() => {
    if (liveRef.current) liveRef.current.scrollTop = liveRef.current.scrollHeight;
  }, [liveKeys]);

  // Si la ventana se cierra en medio de una grabación, hay que avisarle al
  // main para que vuelva a registrar el hotkey.
  useEffect(() => {
    const onUnload = () => { if (recording) window.settings.stopRecording(); };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [recording]);

  useEffect(() => {
    if (!recording) return;

    const addLive = (key, event) => setLiveKeys((prev) => [...prev, { key, event, time: Date.now() }]);

    const downHandler = (e) => {
      e.preventDefault();
      e.stopPropagation();

      const keyName = e.key === ' ' ? 'Space' : e.key;
      addLive(keyName, '↓ down');

      if (['Shift', 'Control', 'Alt', 'Meta', 'OS'].includes(e.key)) return;

      const now = Date.now();
      const gap = Math.min(now - lastKeyTime.current, 2000);
      lastKeyTime.current = now;

      const isAltGr = e.ctrlKey && e.altKey;
      const isPrintable = e.key.length === 1 && e.key !== ' ';
      const hasCtrlOrAlt = e.ctrlKey || e.altKey || e.metaKey;

      // `delay` es la espera DESPUÉS del paso, igual que en el editor y en el
      // reproductor. Por eso la pausa medida se asigna al paso ANTERIOR;
      // antes se guardaba en el paso actual y toda la macro salía corrida.
      const appendStep = (step) => setRecordedSteps((prev) => {
        if (!prev.length) return [step];
        const head = prev.slice(0, -1);
        const last = { ...prev[prev.length - 1], delay: gap };
        if (step.keys.startsWith('type:') && last.keys.startsWith('type:') && gap < 300) {
          // Texto tipeado de corrido: se junta en un solo paso
          return [...head, { keys: last.keys + step.keys.slice(5), delay: last.delay }];
        }
        return [...head, last, step];
      });

      if (isPrintable && (!hasCtrlOrAlt || isAltGr)) {
        appendStep({ keys: `type:${e.key}`, delay: 0 });
        return;
      }

      const parts = [];
      if (e.ctrlKey) parts.push('Control');
      if (e.altKey) parts.push('Alt');
      if (e.shiftKey) parts.push('Shift');
      if (e.metaKey) parts.push('Win');
      let key = e.key;
      if (key === ' ') key = 'Space';
      else if (key.length === 1) key = key.toUpperCase();
      parts.push(key);

      appendStep({ keys: parts.join('+'), delay: 0 });
    };

    const upHandler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      addLive(e.key === ' ' ? 'Space' : e.key, '↑ up');
      if (e.key === 'Escape') stopRecording();
    };

    window.addEventListener('keydown', downHandler, true);
    window.addEventListener('keyup', upHandler, true);
    return () => {
      window.removeEventListener('keydown', downHandler, true);
      window.removeEventListener('keyup', upHandler, true);
    };
  }, [recording, stopRecording]);

  const saveMacro = () => {
    const label = newName.trim();
    if (!label || !recordedSteps.length) return;
    save({ ...config, macros: [...macros, { label, icon: 'Play', steps: recordedSteps }] });
    setRecordedSteps([]);
    setLiveKeys([]);
    setNewName('');
  };

  const deleteMacro = (i) => {
    if (!confirm(`¿Eliminar la macro "${macros[i].label}"?`)) return;
    save({ ...config, macros: macros.filter((_, j) => j !== i) });
  };

  return (
    <div className="section">
      <div className="section-label section-label-icon"><Zap size={13} /> Macros (secuencias de teclas grabadas)</div>
      <div className="actions-table">
        {macros.map((macro, i) => (
          <div key={i} className="action-row" style={{ flexWrap: 'wrap', cursor: 'pointer' }} onClick={() => setExpanded(expanded === i ? -1 : i)}>
            <span className="row-icon"><Icon name={macro.icon || 'Play'} /></span>
            <span className="row-label">{macro.label}</span>
            <span className="row-type">{(macro.steps || []).length} pasos</span>
            <button className="macro-remove" aria-label="Eliminar macro" onClick={(e) => { e.stopPropagation(); deleteMacro(i); }}><X size={14} /></button>
            {expanded === i && (
              <div className="macro-steps-detail">
                {(macro.steps || []).map((s, j) => (
                  <span key={j} className="step-tag">{s.keys} <small>{s.delay ?? 0}ms</small></span>
                ))}
              </div>
            )}
          </div>
        ))}
        {!macros.length && <div className="action-row"><span className="row-label" style={{ opacity: 0.5 }}>No hay macros grabadas</span></div>}
      </div>

      <div className="macro-recorder">
        {!recording && recordedSteps.length === 0 && (
          <button className="btn btn-record" onClick={startRecording}><Circle size={11} fill="currentColor" /> Grabar macro</button>
        )}
        {recording && (
          <div className="recording-active">
            <span className="recording-dot"><Circle size={10} fill="currentColor" /></span> Grabando... ({recordedSteps.length} pasos) — <small>ESC para parar</small>
            <button className="btn btn-stop" onClick={stopRecording}><Square size={11} fill="currentColor" /> Parar</button>
            <div className="live-keys" ref={liveRef}>
              {liveKeys.map((lk, i) => (
                <div key={i} className={lk.event.includes('down') ? 'live-down' : 'live-up'}>
                  <span className="live-event">{lk.event}</span>
                  <strong>{lk.key}</strong>
                </div>
              ))}
              {liveKeys.length === 0 && <span style={{ opacity: 0.4 }}>Presioná teclas...</span>}
            </div>
          </div>
        )}
        {!recording && recordedSteps.length > 0 && (
          <div className="recording-save">
            <div className="recorded-preview">
              {recordedSteps.map((s, i) => <span key={i} className="step-tag">{s.keys} <small>{s.delay ?? 0}ms</small></span>)}
            </div>
            <div className="save-row">
              <input className="input-field" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nombre de la macro" />
              <button className="btn btn-primary" onClick={saveMacro}>Guardar</button>
              <button className="btn" onClick={() => { setRecordedSteps([]); setLiveKeys([]); }}>Descartar</button>
            </div>
          </div>
        )}
      </div>
      <div className="macro-hint">
        <AlertTriangle size={12} /> Las macros se guardan en texto plano en el archivo de configuración.
        Si grabás una contraseña, queda legible para cualquiera con acceso a tu perfil de Windows.
      </div>
    </div>
  );
}

function AnimationSection({ config, save }) {
  const anim = config.animation || { enabled: true, entrance: 'deck', exit: 'deck', speed: 1.0, stagger: 50 };
  const update = (field, val) => save({ ...config, animation: { ...anim, [field]: val } });

  return (
    <div className="section">
      <div className="section-label section-label-icon"><Film size={13} /> Animaciones</div>
      <div className="form-grid">
        <div className="form-field">
          <label>Activar</label>
          <select value={anim.enabled ? 'on' : 'off'} onChange={(e) => update('enabled', e.target.value === 'on')}>
            <option value="on">Activadas</option>
            <option value="off">Desactivadas</option>
          </select>
        </div>
        <div className="form-field">
          <label>Entrada</label>
          <select value={anim.entrance} onChange={(e) => update('entrance', e.target.value)} disabled={!anim.enabled}>
            <option value="deck">Baraja (deck)</option>
            <option value="pop">Pop (bounce)</option>
            <option value="fade">Fade</option>
            <option value="none">Sin animación</option>
          </select>
        </div>
        <div className="form-field">
          <label>Salida</label>
          <select value={anim.exit} onChange={(e) => update('exit', e.target.value)} disabled={!anim.enabled}>
            <option value="deck">Baraja (deck)</option>
            <option value="pop">Pop</option>
            <option value="fade">Fade</option>
            <option value="none">Sin animación</option>
          </select>
        </div>
        <div className="form-field">
          <label>Velocidad ({anim.speed}x)</label>
          <input type="range" min="0.3" max="3" step="0.1" value={anim.speed} onChange={(e) => update('speed', parseFloat(e.target.value))} disabled={!anim.enabled} />
        </div>
        <div className="form-field">
          <label>Stagger ({anim.stagger}ms)</label>
          <input type="range" min="10" max="150" step="5" value={anim.stagger} onChange={(e) => update('stagger', parseInt(e.target.value, 10))} disabled={!anim.enabled} />
        </div>
      </div>
    </div>
  );
}

function PinnedSection({ config, save }) {
  // pinnedActions guarda ids. Los objetos inline vienen de configs viejas.
  const pinned = config.pinnedActions || [];
  const pinnedIds = new Set(pinned.filter((p) => typeof p === 'string'));
  const inlineCount = pinned.length - pinnedIds.size;

  const allActions = [];
  for (const [profile, list] of Object.entries(config.actions || {})) {
    for (const action of (list || [])) {
      if (action && action.id) allActions.push({ ...action, _profile: profile });
    }
  }

  const togglePin = (action) => {
    const next = pinnedIds.has(action.id)
      ? pinned.filter((p) => p !== action.id)
      : [...pinned, action.id];
    save({ ...config, pinnedActions: next });
  };

  return (
    <div className="section">
      <div className="section-label section-label-icon"><Pin size={13} /> Acciones Pinned (siempre visibles — seleccioná de las existentes)</div>
      <div className="actions-table pinned-picker">
        {allActions.map((action) => {
          const isPinned = pinnedIds.has(action.id);
          return (
            <div key={action.id} className={`action-row ${isPinned ? 'pinned-active' : ''}`} onClick={() => togglePin(action)}>
              <span className={`pin-check ${isPinned ? 'checked' : ''}`}>{isPinned ? <Pin size={14} fill="currentColor" /> : <Circle size={13} />}</span>
              <span className="row-icon"><Icon name={action.icon} /></span>
              <span className="row-label">{action.label}</span>
              <span className="row-type">{action.type}</span>
              <span className="row-profile-tag">{action._profile === '_default' ? 'Default' : action._profile}</span>
            </div>
          );
        })}
        {!allActions.length && <div className="action-row"><span className="row-label" style={{ opacity: 0.5 }}>No hay acciones para fijar</span></div>}
      </div>
      {inlineCount > 0 && (
        <div className="macro-hint">
          {inlineCount} acción(es) fijadas de una versión anterior se mantienen tal cual.
          Volvé a fijarlas desde la lista para que sigan los cambios de la acción original.
        </div>
      )}
    </div>
  );
}

function Settings() {
  const [config, setConfig] = useState(null);
  const [selectedProfile, setSelectedProfile] = useState('_default');
  const [editing, setEditing] = useState(null);
  const [addingProfile, setAddingProfile] = useState(false);
  const [runningApps, setRunningApps] = useState([]);
  const [configPath, setConfigPath] = useState('');
  const pending = useRef(null);
  const timer = useRef(null);

  useEffect(() => {
    window.settings.getConfig().then((cfg) => {
      const normalized = withIds(cfg);
      setConfig(normalized);
      // Si hubo que asignar ids, se persiste una sola vez.
      if (JSON.stringify(normalized) !== JSON.stringify(cfg)) window.settings.saveConfig(normalized);
    });
    window.settings.getConfigPath().then(setConfigPath);
  }, []);

  const flush = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (pending.current) { window.settings.saveConfig(pending.current); pending.current = null; }
  }, []);

  // El estado local se actualiza al instante (UI fluida) pero la escritura a
  // disco se agrupa: antes cada tecla reescribía el JSON completo y volvía a
  // registrar el hotkey global.
  const save = useCallback((newConfig) => {
    setConfig(newConfig);
    pending.current = newConfig;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 400);
  }, [flush]);

  useEffect(() => {
    window.addEventListener('beforeunload', flush);
    return () => { window.removeEventListener('beforeunload', flush); flush(); };
  }, [flush]);

  if (!config) return <div className="loading">Cargando...</div>;

  const profiles = Object.keys(config.actions);
  const actions = config.actions[selectedProfile] || [];
  const isTool = selectedProfile === '__clipboard' || selectedProfile === '__macros';

  const startAddProfile = async () => {
    const apps = await window.settings.getRunningApps();
    setRunningApps(apps.filter((a) => !config.actions[a]));
    setAddingProfile(true);
  };

  const confirmAddProfile = (name) => {
    if (!name || config.actions[name]) return;
    save({ ...config, actions: { ...config.actions, [name]: [] } });
    setSelectedProfile(name);
    setAddingProfile(false);
  };

  const updateAction = (idx, field, value) => {
    save({
      ...config,
      actions: {
        ...config.actions,
        [selectedProfile]: actions.map((a, i) => (i === idx ? { ...a, [field]: value } : a)),
      },
    });
  };

  const addAction = () => {
    save({
      ...config,
      actions: {
        ...config.actions,
        [selectedProfile]: [...actions, { id: genId(), label: 'New', icon: 'Star', type: 'shortcut', value: '' }],
      },
    });
    setEditing(actions.length);
  };

  const removeAction = (idx) => {
    const target = actions[idx];
    save({
      ...config,
      actions: { ...config.actions, [selectedProfile]: actions.filter((_, i) => i !== idx) },
      // Si estaba fijada, se quita también de pinned para no dejar una referencia huérfana.
      pinnedActions: (config.pinnedActions || []).filter((p) => p !== (target && target.id)),
    });
    setEditing(null);
  };

  const removeProfile = () => {
    if (selectedProfile === '_default') return;
    if (!confirm(`¿Eliminar perfil "${selectedProfile}"?`)) return;
    const { [selectedProfile]: removed, ...rest } = config.actions;
    const removedIds = new Set((removed || []).map((a) => a.id));
    save({
      ...config,
      actions: rest,
      rolProfiles: (config.rolProfiles || []).filter((p) => p !== selectedProfile),
      pinnedActions: (config.pinnedActions || []).filter((p) => !removedIds.has(p)),
    });
    setSelectedProfile('_default');
    setEditing(null);
  };

  const current = editing !== null ? actions[editing] : null;

  return (
    <div className="app">
      <div className="sidebar">
        <div className="sidebar-title">Perfiles</div>
        {profiles.map((p) => (
          <div key={p} className={`sidebar-item ${p === selectedProfile ? 'active' : ''}`} onClick={() => { setSelectedProfile(p); setEditing(null); }}>
            <span className="icon"><Icon name={p === '_default' ? 'Globe' : 'AppWindow'} size={16} /></span>
            {p === '_default' ? 'Default' : p}
          </div>
        ))}
        {addingProfile ? (
          <div className="add-profile-dropdown">
            <div className="dropdown-hint">Abrí la app y seleccionala:</div>
            <select className="dropdown-select" defaultValue="" onChange={(e) => confirmAddProfile(e.target.value)}>
              <option value="" disabled>Elegir app...</option>
              {runningApps.map((app) => <option key={app} value={app}>{app}</option>)}
            </select>
            <button className="dropdown-cancel" onClick={() => setAddingProfile(false)}>Cancelar</button>
          </div>
        ) : (
          <button className="sidebar-add" onClick={startAddProfile}><Plus size={13} /> Agregar perfil</button>
        )}

        <div className="sidebar-title" style={{ marginTop: 16 }}>Herramientas</div>
        <div className={`sidebar-item ${selectedProfile === '__clipboard' ? 'active' : ''}`} onClick={() => { setSelectedProfile('__clipboard'); setEditing(null); }}>
          <span className="icon"><Icon name="Clipboard" size={16} /></span> Clipboard
        </div>
        <div className={`sidebar-item ${selectedProfile === '__macros' ? 'active' : ''}`} onClick={() => { setSelectedProfile('__macros'); setEditing(null); }}>
          <span className="icon"><Icon name="Zap" size={16} /></span> Macros
        </div>

        <div className="sidebar-footer">
          <button className="sidebar-add" onClick={() => window.settings.openConfigFolder()} title={configPath}>
            <FolderOpen size={13} /> Carpeta de config
          </button>
          <div className="sidebar-credit">Desarrollado por <a href="https://www.linkedin.com/in/niconietoarg/" target="_blank" rel="noopener">Nicolás Nieto</a></div>
          <div className="sidebar-credit"><a href="https://github.com/nicolasnietoarg/ActionsRing_4all" target="_blank" rel="noopener">GitHub Repo</a></div>
        </div>
      </div>

      <div className="main">
        {selectedProfile === '__clipboard' && <ClipboardPanel />}

        {selectedProfile === '__macros' && (
          <>
            <h2>Macros</h2>
            <MacrosSection config={config} save={save} />
          </>
        )}

        {!isTool && (
          <>
            <h2>{selectedProfile === '_default' ? 'Default' : selectedProfile}</h2>

            <HotkeySection config={config} save={save} />
            <PinnedSection config={config} save={save} />
            <AnimationSection config={config} save={save} />

            <div className="section">
              <div className="section-label">Perfiles en Rol (acceso rápido a otras apps)</div>
              <div className="rol-config">
                {(config.rolProfiles || []).map((name, i) => (
                  <span key={name} className="rol-tag">
                    {name}
                    <button className="rol-tag-remove" aria-label="Quitar de Rol" onClick={() => save({ ...config, rolProfiles: config.rolProfiles.filter((_, j) => j !== i) })}>
                      <X size={13} />
                    </button>
                  </span>
                ))}
                <select className="rol-add-select" value="" onChange={(e) => {
                  if (!e.target.value) return;
                  save({ ...config, rolProfiles: [...(config.rolProfiles || []), e.target.value] });
                }}>
                  <option value="">+ Agregar...</option>
                  {profiles.filter((p) => p !== '_default' && !(config.rolProfiles || []).includes(p)).map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="section">
              <div className="section-label">Acciones ({actions.length}) — arrastrá para reordenar</div>
              <div className="actions-table">
                {actions.map((action, i) => (
                  <div key={action.id || i} className={`action-row ${editing === i ? 'selected' : ''}`}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', String(i))}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
                      if (Number.isNaN(from) || from === i) return;
                      const reordered = [...actions];
                      const [moved] = reordered.splice(from, 1);
                      reordered.splice(i, 0, moved);
                      save({ ...config, actions: { ...config.actions, [selectedProfile]: reordered } });
                      setEditing(null);
                    }}
                    onClick={() => setEditing(editing === i ? null : i)}>
                    <span className="drag-handle" aria-label="Arrastrar para reordenar"><GripVertical size={14} /></span>
                    <span className="row-icon"><Icon name={action.icon} /></span>
                    <span className="row-label">{action.label}</span>
                    <span className="row-type">{action.type}</span>
                    <span className="row-value">{typeof action.value === 'string' ? action.value : JSON.stringify(action.value)}</span>
                  </div>
                ))}
                {!actions.length && <div className="action-row"><span className="row-label" style={{ opacity: 0.5 }}>Sin acciones en este perfil</span></div>}
              </div>

              <div className="btn-row">
                <button className="btn btn-primary" onClick={addAction}><Plus size={13} /> Agregar</button>
                {selectedProfile !== '_default' && (
                  <button className="btn btn-danger delete-profile" onClick={removeProfile}>Eliminar perfil</button>
                )}
              </div>
            </div>

            {current && (
              <div className="edit-panel">
                <h3>Editar: {current.label}</h3>
                <div className="form-grid">
                  <div className="form-field">
                    <label>Icono</label>
                    <input value={current.icon || ''} onChange={(e) => updateAction(editing, 'icon', e.target.value)} />
                  </div>
                  <div className="form-field">
                    <label>Nombre</label>
                    <input value={current.label || ''} onChange={(e) => updateAction(editing, 'label', e.target.value)} />
                  </div>
                  <div className="form-field">
                    <label>Tipo</label>
                    <select value={current.type} onChange={(e) => updateAction(editing, 'type', e.target.value)}>
                      <option value="shortcut">Shortcut</option>
                      <option value="open">Abrir App</option>
                      <option value="command">Comando</option>
                      <option value="snippet">Snippet</option>
                      <option value="macro">Macro</option>
                      <option value="workflow">Workflow</option>
                      <option value="profile">Ir a Perfil</option>
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Valor</label>
                    {current.type === 'shortcut' ? (
                      <KeyRecorder value={current.value} onChange={(v) => updateAction(editing, 'value', v)} mode="keys" />
                    ) : current.type === 'macro' ? (
                      <MacroEditor value={current.value} onChange={(v) => updateAction(editing, 'value', v)} />
                    ) : current.type === 'profile' ? (
                      <select value={current.value || ''} onChange={(e) => updateAction(editing, 'value', e.target.value)}>
                        <option value="">Elegir perfil...</option>
                        {profiles.filter((p) => p !== selectedProfile).map((p) => <option key={p} value={p}>{p === '_default' ? 'Default' : p}</option>)}
                      </select>
                    ) : (
                      <input
                        value={typeof current.value === 'string' ? current.value : JSON.stringify(current.value)}
                        onChange={(e) => updateAction(editing, 'value', e.target.value)}
                        placeholder={current.type === 'open' ? 'notepad, chrome, C:\\ruta\\app.exe' : 'comando de shell'}
                      />
                    )}
                  </div>
                </div>
                {current.type === 'command' && (
                  <div className="macro-hint">
                    Variables: <code>{'{clipboard}'}</code>, <code>{'{date}'}</code>, <code>{'{time}'}</code>, <code>{'{app}'}</code>.
                    Lo que venga del portapapeles se sanea antes de ir al shell.
                    Atajos de ventana: <code>window:left</code>, <code>window:right</code>, <code>window:maximize</code>.
                  </div>
                )}
                <div className="btn-row">
                  <button className="btn btn-danger" onClick={() => removeAction(editing)}>Eliminar acción</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<Settings />);
