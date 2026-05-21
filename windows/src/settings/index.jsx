import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Copy, ClipboardPaste, Undo2, Save, Camera, Lock, Moon, Search, Terminal, Palette, GitBranch, FolderOpen, Columns2, X, Plus, RefreshCw, Link, EyeOff, ArrowLeft, ArrowRight, Code, Star, FolderPlus, Eye, Info, Trash2, Share2, Navigation, Trash, PenSquare, Reply, ReplyAll, Forward, Send, Archive, CheckCheck, FilePlus, Bold, List, ListChecks, Table, Pin, MessageSquarePlus, VolumeX, ChevronDown, ChevronUp, Pencil, Sparkles, Square, PenLine, PanelLeft, Play, SkipForward, SkipBack, Heart, Shuffle, Repeat, Volume2, CalendarPlus, CalendarCheck, Calendar, CalendarDays, CalendarRange, ZoomIn, ZoomOut, Maximize2, RotateCw, Download, Printer, Command, Target, Music, Globe, Compass, Mail, StickyNote, MessageCircle, Folder, Image, AppWindow, Clipboard, Move } from 'lucide-react';

const iconMap = { Copy, ClipboardPaste, Undo2, Save, Camera, Lock, Moon, Search, Terminal, Palette, GitBranch, FolderOpen, Columns2, X, Plus, RefreshCw, Link, EyeOff, ArrowLeft, ArrowRight, Code, Star, FolderPlus, Eye, Info, Trash2, Share2, Navigation, Trash, PenSquare, Reply, ReplyAll, Forward, Send, Archive, CheckCheck, FilePlus, Bold, List, ListChecks, Table, Pin, MessageSquarePlus, VolumeX, ChevronDown, ChevronUp, Pencil, Sparkles, Square, PenLine, PanelLeft, Play, SkipForward, SkipBack, Heart, Shuffle, Repeat, Volume2, CalendarPlus, CalendarCheck, Calendar, CalendarDays, CalendarRange, ZoomIn, ZoomOut, Maximize2, RotateCw, Download, Printer, Command, Target, Music, Globe, Compass, Mail, StickyNote, MessageCircle, Folder, Image, AppWindow, Clipboard, Move };

function Icon({ name, size = 18 }) {
  const LucideIcon = iconMap[name];
  if (LucideIcon) return <LucideIcon size={size} strokeWidth={1.8} />;
  return <span>{name}</span>;
}
function KeyRecorder({ value, onChange }) {
  const [recording, setRecording] = useState(false);
  const modsRef = useRef(new Set());

  useEffect(() => {
    if (!recording) return;
    modsRef.current = new Set();

    const downHandler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Track modifier keys pressed
      if (e.key === 'Meta' || e.key === 'OS') modsRef.current.add('Win');
      else if (e.key === 'Control') modsRef.current.add('Control');
      else if (e.key === 'Shift') modsRef.current.add('Shift');
      else if (e.key === 'Alt') modsRef.current.add('Alt');
      else {
        // Non-modifier key pressed — finalize
        const parts = [];
        if (modsRef.current.has('Control')) parts.push('Control');
        if (modsRef.current.has('Alt')) parts.push('Alt');
        if (modsRef.current.has('Shift')) parts.push('Shift');
        if (modsRef.current.has('Win')) parts.push('Win');
        let key = e.key;
        if (key === ' ') key = 'Space';
        else if (key.length === 1) key = key.toUpperCase();
        else if (key === 'Backspace') key = 'Delete';
        parts.push(key);
        onChange(parts.join('+'));
        setRecording(false);
      }
    };

    // If user releases all keys without pressing a non-modifier, cancel
    const upHandler = (e) => {
      if (e.key === 'Escape') { setRecording(false); }
    };

    window.addEventListener('keydown', downHandler, true);
    window.addEventListener('keyup', upHandler, true);
    return () => {
      window.removeEventListener('keydown', downHandler, true);
      window.removeEventListener('keyup', upHandler, true);
    };
  }, [recording]);

  return (
    <button className={`key-recorder ${recording ? 'recording' : ''}`} onClick={() => setRecording(true)}>
      {recording ? '● Presioná las teclas...' : (value || 'Click para grabar')}
    </button>
  );
}

function ClipboardPanel() {
  const [history, setHistory] = useState([]);
  useEffect(() => { window.settings.getClipboardHistory().then(setHistory); const t = setInterval(() => window.settings.getClipboardHistory().then(setHistory), 2000); return () => clearInterval(t); }, []);
  return (
    <>
      <h2>Clipboard History</h2>
      <div className="section">
        <div className="section-label">Últimos {history.length} items copiados</div>
        <div className="actions-table">
          {history.map((text, i) => (
            <div key={i} className="action-row" onClick={() => { navigator.clipboard.writeText(text); }}>
              <span className="row-icon"><Icon name="Clipboard" /></span>
              <span className="row-label" style={{fontFamily: 'SF Mono, monospace', fontSize: 11}}>{text.slice(0, 60)}{text.length > 60 ? '...' : ''}</span>
            </div>
          ))}
          {!history.length && <div className="action-row"><span className="row-label" style={{opacity:0.5}}>Aún no hay items</span></div>}
        </div>
      </div>
    </>
  );
}

function MacroEditor({ value, onChange }) {
  const steps = Array.isArray(value) ? value : (() => { try { return JSON.parse(value); } catch { return []; } })();
  const update = (newSteps) => onChange(newSteps);
  const updateStep = (i, field, val) => { const s = [...steps]; s[i] = { ...s[i], [field]: val }; update(s); };
  const addStep = () => update([...steps, { keys: '', delay: 50 }]);
  const removeStep = (i) => update(steps.filter((_, j) => j !== i));

  return (
    <div className="macro-editor">
      <div className="section-label">Pasos de la macro</div>
      {steps.map((step, i) => (
        <div key={i} className="macro-step">
          <span className="macro-step-num">{i + 1}</span>
          <input className="macro-input" value={step.keys} onChange={(e) => updateStep(i, 'keys', e.target.value)} placeholder="Control+C o type:texto" />
          <input className="macro-delay" type="number" value={step.delay || 0} onChange={(e) => updateStep(i, 'delay', parseInt(e.target.value) || 0)} title="Delay (ms)" />
          <span className="macro-delay-label">ms</span>
          <button className="macro-remove" onClick={() => removeStep(i)}>×</button>
        </div>
      ))}
      <button className="btn btn-small" onClick={addStep}>＋ Paso</button>
      <div className="macro-hint">Usar <code>type:texto</code> para escribir texto, o shortcuts como <code>Control+A</code></div>
    </div>
  );
}

function MacrosSection({ config, save }) {
  const [macros, setMacros] = useState(config.macros || []);
  const [recording, setRecording] = useState(false);
  const [recordedSteps, setRecordedSteps] = useState([]);
  const [newName, setNewName] = useState('');
  const lastKeyTime = useRef(Date.now());

  useEffect(() => { setMacros(config.macros || []); }, [config]);

  const startRecording = () => {
    setRecordedSteps([]);
    setRecording(true);
    lastKeyTime.current = Date.now();
  };

  const stopRecording = () => {
    setRecording(false);
  };

  // Local key capture while recording
  useEffect(() => {
    if (!recording) return;
    const handler = (e) => {
      e.preventDefault();
      if (['Shift', 'Control', 'Alt', 'Meta', 'OS'].includes(e.key)) return;

      const now = Date.now();
      const delay = Math.min(now - lastKeyTime.current, 2000);
      lastKeyTime.current = now;

      // AltGr produces ctrlKey+altKey but the result is a printable char (like @, #, etc.)
      // Detect: if key is a single printable char and AltGr was used, treat as typed character
      const isAltGr = e.ctrlKey && e.altKey;
      const isPrintable = e.key.length === 1;
      const hasCtrlOrAlt = e.ctrlKey || e.altKey || e.metaKey;

      // Printable char without real modifiers (or with AltGr) → save as type:
      if (isPrintable && (!hasCtrlOrAlt || isAltGr)) {
        setRecordedSteps(prev => {
          // Merge consecutive type: steps into one
          const last = prev[prev.length - 1];
          if (last && last.keys.startsWith('type:') && delay < 300) {
            const merged = [...prev.slice(0, -1), { keys: last.keys + e.key, delay: last.delay }];
            return merged;
          }
          return [...prev, { keys: `type:${e.key}`, delay: prev.length === 0 ? 0 : delay }];
        });
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

      setRecordedSteps(prev => [...prev, { keys: parts.join('+'), delay: prev.length === 0 ? 0 : delay }]);
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [recording]);

  const saveMacro = () => {
    if (!newName || recordedSteps.length === 0) return;
    const macro = { label: newName, icon: 'Play', steps: recordedSteps };
    const updated = [...macros, macro];
    setMacros(updated);
    save({ ...config, macros: updated });
    setRecordedSteps([]);
    setNewName('');
  };

  const deleteMacro = (i) => {
    const updated = macros.filter((_, j) => j !== i);
    setMacros(updated);
    save({ ...config, macros: updated });
  };

  return (
    <div className="section">
      <div className="section-label">🎹 Macros (secuencias de teclas grabadas)</div>
      <div className="actions-table">
        {macros.map((macro, i) => (
          <div key={i} className="action-row">
            <span className="row-icon"><Icon name={macro.icon || 'Play'} /></span>
            <span className="row-label">{macro.label}</span>
            <span className="row-type">{macro.steps.length} pasos</span>
            <button className="macro-remove" onClick={() => deleteMacro(i)}>×</button>
          </div>
        ))}
        {!macros.length && <div className="action-row"><span className="row-label" style={{opacity:0.5}}>No hay macros grabadas</span></div>}
      </div>

      <div className="macro-recorder">
        {!recording && recordedSteps.length === 0 && (
          <button className="btn btn-record" onClick={startRecording}>🔴 Grabar macro</button>
        )}
        {recording && (
          <div className="recording-active">
            <span className="recording-dot">●</span> Grabando... ({recordedSteps.length} pasos)
            <button className="btn btn-stop" onClick={stopRecording}>⏹ Parar</button>
          </div>
        )}
        {!recording && recordedSteps.length > 0 && (
          <div className="recording-save">
            <div className="recorded-preview">
              {recordedSteps.map((s, i) => <span key={i} className="step-tag">{s.keys} <small>{s.delay}ms</small></span>)}
            </div>
            <div className="save-row">
              <input className="input-field" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nombre de la macro" />
              <button className="btn btn-primary" onClick={saveMacro}>Guardar</button>
              <button className="btn" onClick={() => setRecordedSteps([])}>Descartar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AnimationSection({ config, save }) {
  const anim = config.animation || { enabled: true, entrance: 'deck', exit: 'deck', speed: 1.0, stagger: 50 };
  const update = (field, val) => save({ ...config, animation: { ...anim, [field]: val } });

  return (
    <div className="section">
      <div className="section-label">🎬 Animaciones</div>
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
          <input type="range" min="10" max="150" step="5" value={anim.stagger} onChange={(e) => update('stagger', parseInt(e.target.value))} disabled={!anim.enabled} />
        </div>
      </div>
    </div>
  );
}

function PinnedSection({ config, save }) {
  const pinned = config.pinnedActions || [];
  const pinnedKeys = new Set(pinned.map(a => `${a.label}|${a.type}|${JSON.stringify(a.value)}`));

  // Collect all unique actions from all profiles
  const allActions = [];
  const seen = new Set();
  for (const [profile, actions] of Object.entries(config.actions || {})) {
    for (const action of actions) {
      const key = `${action.label}|${action.type}|${JSON.stringify(action.value)}`;
      if (!seen.has(key)) { seen.add(key); allActions.push({ ...action, _profile: profile, _key: key }); }
    }
  }

  const togglePin = (action) => {
    const key = action._key;
    if (pinnedKeys.has(key)) {
      save({ ...config, pinnedActions: pinned.filter(a => `${a.label}|${a.type}|${JSON.stringify(a.value)}` !== key) });
    } else {
      const { _profile, _key, ...clean } = action;
      save({ ...config, pinnedActions: [...pinned, clean] });
    }
  };

  return (
    <div className="section">
      <div className="section-label">📌 Acciones Pinned (siempre visibles — seleccioná de las existentes)</div>
      <div className="actions-table pinned-picker">
        {allActions.map((action, i) => {
          const isPinned = pinnedKeys.has(action._key);
          return (
            <div key={i} className={`action-row ${isPinned ? 'pinned-active' : ''}`} onClick={() => togglePin(action)}>
              <span className={`pin-check ${isPinned ? 'checked' : ''}`}>{isPinned ? '📌' : '○'}</span>
              <span className="row-icon"><Icon name={action.icon} /></span>
              <span className="row-label">{action.label}</span>
              <span className="row-type">{action.type}</span>
              <span className="row-profile-tag">{action._profile === '_default' ? 'Default' : action._profile}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Settings() {
  const [config, setConfig] = useState(null);
  const [selectedProfile, setSelectedProfile] = useState('_default');
  const [editing, setEditing] = useState(null);
  const [addingProfile, setAddingProfile] = useState(false);
  const [runningApps, setRunningApps] = useState([]);

  useEffect(() => { window.settings.getConfig().then(setConfig); }, []);

  const profiles = config ? Object.keys(config.actions) : [];
  const actions = config ? (config.actions[selectedProfile] || []) : [];

  const save = (newConfig) => { setConfig(newConfig); window.settings.saveConfig(newConfig); };

  const startAddProfile = async () => {
    const apps = await window.settings.getRunningApps();
    setRunningApps(apps.filter(a => !config.actions[a]));
    setAddingProfile(true);
  };

  const confirmAddProfile = (name) => {
    if (!name || config.actions[name]) return;
    save({ ...config, actions: { ...config.actions, [name]: [] } });
    setSelectedProfile(name);
    setAddingProfile(false);
  };

  const updateAction = (idx, field, value) => {
    const updated = { ...config, actions: { ...config.actions, [selectedProfile]: config.actions[selectedProfile].map((a, i) => i === idx ? { ...a, [field]: value } : a) } };
    save(updated);
  };

  const addAction = () => {
    const updated = { ...config, actions: { ...config.actions, [selectedProfile]: [...actions, { label: 'New', icon: '⭐', type: 'shortcut', value: '' }] } };
    save(updated);
    setEditing(actions.length);
  };

  const removeAction = (idx) => {
    const updated = { ...config, actions: { ...config.actions, [selectedProfile]: actions.filter((_, i) => i !== idx) } };
    save(updated);
    setEditing(null);
  };

  const removeProfile = () => {
    if (selectedProfile === '_default') return;
    if (!confirm(`¿Eliminar perfil "${selectedProfile}"?`)) return;
    const { [selectedProfile]: _, ...rest } = config.actions;
    save({ ...config, actions: rest });
    setSelectedProfile('_default');
  };

  if (!config) return <div className="loading">Cargando...</div>;

  const current = editing !== null ? actions[editing] : null;

  return (
    <div className="app">
      <div className="sidebar">
        <div className="sidebar-title">Perfiles</div>
        {profiles.map(p => (
          <div key={p} className={`sidebar-item ${p === selectedProfile ? 'active' : ''}`} onClick={() => { setSelectedProfile(p); setEditing(null); }}>
            <span className="icon">{p === '_default' ? '🌐' : '📱'}</span>
            {p === '_default' ? 'Default' : p}
          </div>
        ))}
        {addingProfile ? (
          <div className="add-profile-dropdown">
            <div className="dropdown-hint">Abrí la app y seleccionala:</div>
            <select className="dropdown-select" defaultValue="" onChange={(e) => confirmAddProfile(e.target.value)}>
              <option value="" disabled>Elegir app...</option>
              {runningApps.map(app => <option key={app} value={app}>{app}</option>)}
            </select>
            <button className="dropdown-cancel" onClick={() => setAddingProfile(false)}>Cancelar</button>
          </div>
        ) : (
          <button className="sidebar-add" onClick={startAddProfile}>＋ Agregar perfil</button>
        )}
        <div className="sidebar-title" style={{marginTop: 16}}>Herramientas</div>
        <div className="sidebar-item" onClick={() => { setSelectedProfile('__clipboard'); setEditing(null); }}>
          <span className="icon">📋</span> Clipboard
        </div>
        <div className="sidebar-item" onClick={() => { setSelectedProfile('__macros'); setEditing(null); }}>
          <span className="icon">🎹</span> Macros
        </div>
      </div>

      <div className="main">
        {selectedProfile === '__clipboard' ? <ClipboardPanel /> : selectedProfile === '__macros' ? <MacrosSection config={config} save={save} /> : <>
        <h2>{selectedProfile === '_default' ? 'Default' : selectedProfile}</h2>

        <div className="section">
          <div className="section-label">Hotkey global</div>
          <input className="input-field" value={config.hotkey} onChange={(e) => save({ ...config, hotkey: e.target.value })} />
        </div>

        <PinnedSection config={config} save={save} />

        <AnimationSection config={config} save={save} />

        <MacrosSection config={config} save={save} />

        <div className="section">
          <div className="section-label">Perfiles en Rol (hover para acceso rápido)</div>
          <div className="rol-config">
            {(config.rolProfiles || []).map((name, i) => (
              <span key={name} className="rol-tag">
                {name}
                <button className="rol-tag-remove" onClick={() => {
                  const rp = config.rolProfiles.filter((_, j) => j !== i);
                  save({ ...config, rolProfiles: rp });
                }}>×</button>
              </span>
            ))}
            <select className="rol-add-select" value="" onChange={(e) => {
              if (!e.target.value) return;
              const rp = [...(config.rolProfiles || []), e.target.value];
              save({ ...config, rolProfiles: rp });
              e.target.value = '';
            }}>
              <option value="">+ Agregar...</option>
              {profiles.filter(p => p !== '_default' && !(config.rolProfiles || []).includes(p)).map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="section">
          <div className="section-label">Acciones ({actions.length}) — arrastrá para reordenar</div>
          <div className="actions-table">
            {actions.map((action, i) => (
              <div key={i} className={`action-row ${editing === i ? 'selected' : ''}`}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('text/plain', i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const from = parseInt(e.dataTransfer.getData('text/plain'));
                  if (from === i) return;
                  const newActions = [...actions];
                  const [moved] = newActions.splice(from, 1);
                  newActions.splice(i, 0, moved);
                  const updated = { ...config, actions: { ...config.actions, [selectedProfile]: newActions } };
                  save(updated);
                  setEditing(null);
                }}
                onClick={() => setEditing(editing === i ? null : i)}>
                <span className="drag-handle">⠿</span>
                <span className="row-icon"><Icon name={action.icon} /></span>
                <span className="row-label">{action.label}</span>
                <span className="row-type">{action.type}</span>
                <span className="row-value">{action.value}</span>
              </div>
            ))}
          </div>

          <div className="btn-row">
            <button className="btn btn-primary" onClick={addAction}>＋ Agregar</button>
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
                <input value={current.icon} onChange={(e) => updateAction(editing, 'icon', e.target.value)} />
              </div>
              <div className="form-field">
                <label>Nombre</label>
                <input value={current.label} onChange={(e) => updateAction(editing, 'label', e.target.value)} />
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
                  <KeyRecorder value={current.value} onChange={(v) => updateAction(editing, 'value', v)} />
                ) : current.type === 'macro' ? (
                  <MacroEditor value={current.value} onChange={(v) => updateAction(editing, 'value', v)} />
                ) : current.type === 'profile' ? (
                  <select value={current.value} onChange={(e) => updateAction(editing, 'value', e.target.value)}>
                    <option value="">Elegir perfil...</option>
                    {profiles.filter(p => p !== selectedProfile).map(p => <option key={p} value={p}>{p === '_default' ? 'Default' : p}</option>)}
                  </select>
                ) : (
                  <input value={typeof current.value === 'string' ? current.value : JSON.stringify(current.value)} onChange={(e) => updateAction(editing, 'value', e.target.value)} placeholder={current.type === 'open' ? 'Nombre de la app' : 'comando shell'} />
                )}
              </div>
            </div>
            <div className="btn-row">
              <button className="btn btn-danger" onClick={() => removeAction(editing)}>Eliminar acción</button>
            </div>
          </div>
        )}
        </>}
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<Settings />);
