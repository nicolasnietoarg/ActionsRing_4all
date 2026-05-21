import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Copy, ClipboardPaste, Undo2, Save, Camera, Lock, Moon, Search, Terminal, Palette, GitBranch, FolderOpen, Columns2, X, Plus, RefreshCw, Link, EyeOff, ArrowLeft, ArrowRight, Code, Star, FolderPlus, Eye, Info, Trash2, Share2, Navigation, Trash, PenSquare, Reply, ReplyAll, Forward, Send, Archive, CheckCheck, FilePlus, Bold, List, ListChecks, Table, Pin, MessageSquarePlus, VolumeX, ChevronDown, ChevronUp, Pencil, Sparkles, Square, PenLine, PanelLeft, Play, SkipForward, SkipBack, Heart, Shuffle, Repeat, Volume2, CalendarPlus, CalendarCheck, Calendar, CalendarDays, CalendarRange, ZoomIn, ZoomOut, Maximize2, RotateCw, Download, Printer, Command, Target, Music, Globe, Compass, Mail, StickyNote, MessageCircle, Folder, Image, AppWindow, Clipboard, Move, Zap } from 'lucide-react';

const iconMap = { Copy, ClipboardPaste, Undo2, Save, Camera, Lock, Moon, Search, Terminal, Palette, GitBranch, FolderOpen, Columns2, X, Plus, RefreshCw, Link, EyeOff, ArrowLeft, ArrowRight, Code, Star, FolderPlus, Eye, Info, Trash2, Share2, Navigation, Trash, PenSquare, Reply, ReplyAll, Forward, Send, Archive, CheckCheck, FilePlus, Bold, List, ListChecks, Table, Pin, MessageSquarePlus, VolumeX, ChevronDown, ChevronUp, Pencil, Sparkles, Square, PenLine, PanelLeft, Play, SkipForward, SkipBack, Heart, Shuffle, Repeat, Volume2, CalendarPlus, CalendarCheck, Calendar, CalendarDays, CalendarRange, ZoomIn, ZoomOut, Maximize2, RotateCw, Download, Printer, Command, Target, Music, Globe, Compass, Mail, StickyNote, MessageCircle, Folder, Image, AppWindow, Clipboard, Move, Zap };

function Icon({ name, size = 18 }) {
  const LucideIcon = iconMap[name];
  if (LucideIcon) return <LucideIcon size={size} strokeWidth={1.8} />;
  return <span>{name}</span>;
}

function KeyRecorder({ value, onChange }) {
  const [recording, setRecording] = useState(false);
  useEffect(() => {
    if (!recording) return;
    const handler = (e) => {
      e.preventDefault(); e.stopPropagation();
      if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
      const parts = [];
      if (e.metaKey) parts.push('Command');
      if (e.ctrlKey) parts.push('Control');
      if (e.altKey) parts.push('Option');
      if (e.shiftKey) parts.push('Shift');
      let key = e.key;
      if (key === ' ') key = 'Space';
      else if (key.length === 1) key = key.toUpperCase();
      else if (key === 'Backspace') key = 'Delete';
      parts.push(key);
      onChange(parts.join('+'));
      setRecording(false);
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [recording]);
  return (
    <button className={`key-recorder ${recording ? 'recording' : ''}`} onClick={() => setRecording(true)}>
      {recording ? '● Presioná las teclas...' : (value || 'Click para grabar')}
    </button>
  );
}

function MacroEditor({ steps, onChange }) {
  const update = (idx, field, val) => {
    const s = [...steps];
    s[idx] = { ...s[idx], [field]: val };
    onChange(s);
  };
  const remove = (idx) => onChange(steps.filter((_, i) => i !== idx));
  const add = () => onChange([...steps, { keys: '', delay: 50 }]);
  return (
    <div className="macro-editor">
      {steps.map((step, i) => (
        <div key={i} className="macro-step">
          <input className="macro-input" placeholder="Command+C o type:texto" value={step.keys} onChange={(e) => update(i, 'keys', e.target.value)} />
          <input className="macro-delay" type="number" min="0" max="5000" value={step.delay} onChange={(e) => update(i, 'delay', parseInt(e.target.value) || 0)} />
          <span className="macro-delay-label">ms</span>
          <button className="macro-remove" onClick={() => remove(i)}>×</button>
        </div>
      ))}
      <button className="btn btn-small" onClick={add}>＋ Step</button>
    </div>
  );
}

function MacrosSection({ config, save }) {
  const macros = config.macros || [];
  const [newLabel, setNewLabel] = useState('');
  const [newIcon, setNewIcon] = useState('Zap');
  const [newSteps, setNewSteps] = useState([{ keys: '', delay: 50 }]);

  const addMacro = () => {
    if (!newLabel || !newSteps.some(s => s.keys)) return;
    const updated = { ...config, macros: [...macros, { label: newLabel, icon: newIcon, steps: newSteps }] };
    save(updated);
    setNewLabel(''); setNewIcon('Zap'); setNewSteps([{ keys: '', delay: 50 }]);
  };
  const deleteMacro = (idx) => {
    const updated = { ...config, macros: macros.filter((_, i) => i !== idx) };
    save(updated);
  };

  return (
    <>
      <h2>🎹 Macros</h2>
      <div className="section">
        <div className="section-label">Macros guardados ({macros.length})</div>
        <div className="actions-table">
          {macros.map((m, i) => (
            <div key={i} className="action-row">
              <span className="row-icon"><Icon name={m.icon || 'Zap'} /></span>
              <span className="row-label">{m.label}</span>
              <span className="row-type">{m.steps.length} steps</span>
              <button className="btn btn-danger btn-small" onClick={() => deleteMacro(i)}>×</button>
            </div>
          ))}
          {!macros.length && <div className="action-row"><span className="row-label" style={{opacity:0.5}}>No hay macros</span></div>}
        </div>
      </div>
      <div className="section">
        <div className="section-label">Nuevo macro</div>
        <div className="form-grid">
          <div className="form-field"><label>Nombre</label><input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Select All + Copy" /></div>
          <div className="form-field"><label>Icono</label><input value={newIcon} onChange={(e) => setNewIcon(e.target.value)} placeholder="Zap" /></div>
        </div>
        <div style={{marginTop: 12}}>
          <div className="section-label">Steps (keys + delay)</div>
          <MacroEditor steps={newSteps} onChange={setNewSteps} />
        </div>
        <div className="btn-row"><button className="btn btn-primary" onClick={addMacro}>Guardar macro</button></div>
      </div>
    </>
  );
}

function AnimationSection({ config, save }) {
  const anim = config.animation || { enabled: true, entrance: 'deck', exit: 'deck', speed: 1.0, stagger: 50 };
  const update = (field, val) => save({ ...config, animation: { ...anim, [field]: val } });
  return (
    <div className="section">
      <div className="section-label">Animaciones</div>
      <div className="form-grid">
        <div className="form-field">
          <label>Habilitadas</label>
          <select value={anim.enabled ? 'true' : 'false'} onChange={(e) => update('enabled', e.target.value === 'true')}>
            <option value="true">Sí</option><option value="false">No</option>
          </select>
        </div>
        <div className="form-field">
          <label>Entrada</label>
          <select value={anim.entrance} onChange={(e) => update('entrance', e.target.value)}>
            <option value="deck">Deck</option><option value="pop">Pop</option><option value="fade">Fade</option><option value="none">None</option>
          </select>
        </div>
        <div className="form-field">
          <label>Salida</label>
          <select value={anim.exit} onChange={(e) => update('exit', e.target.value)}>
            <option value="deck">Deck</option><option value="pop">Pop</option><option value="fade">Fade</option><option value="none">None</option>
          </select>
        </div>
        <div className="form-field">
          <label>Velocidad ({anim.speed}x)</label>
          <input type="range" min="0.3" max="3" step="0.1" value={anim.speed} onChange={(e) => update('speed', parseFloat(e.target.value))} />
        </div>
        <div className="form-field">
          <label>Stagger ({anim.stagger}ms)</label>
          <input type="range" min="10" max="150" step="5" value={anim.stagger} onChange={(e) => update('stagger', parseInt(e.target.value))} />
        </div>
      </div>
    </div>
  );
}

function PinnedSection({ config, save }) {
  const pinned = config.pinnedActions || [];
  const allActions = Object.values(config.actions).flat();
  const uniqueActions = [];
  const seen = new Set();
  allActions.forEach(a => { if (!seen.has(a.label)) { seen.add(a.label); uniqueActions.push(a); } });
  const pinnedLabels = new Set(pinned.map(a => a.label));

  const toggle = (action) => {
    let newPinned;
    if (pinnedLabels.has(action.label)) {
      newPinned = pinned.filter(a => a.label !== action.label);
    } else {
      newPinned = [...pinned, action];
    }
    save({ ...config, pinnedActions: newPinned });
  };

  return (
    <div className="section">
      <div className="section-label">Acciones fijadas (aparecen en todos los perfiles)</div>
      <div className="pinned-picker">
        {uniqueActions.slice(0, 30).map((a, i) => (
          <div key={i} className={`action-row ${pinnedLabels.has(a.label) ? 'pinned-active' : ''}`} onClick={() => toggle(a)}>
            <span className="pin-check">{pinnedLabels.has(a.label) ? '📌' : '○'}</span>
            <span className="row-icon"><Icon name={a.icon} /></span>
            <span className="row-label">{a.label}</span>
            <span className="row-type">{a.type}</span>
          </div>
        ))}
      </div>
    </div>
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
            <span className="icon"><Icon name={p === '_default' ? 'Globe' : 'AppWindow'} size={16} /></span>
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
        <div className={`sidebar-item ${selectedProfile === '__macros' ? 'active' : ''}`} onClick={() => { setSelectedProfile('__macros'); setEditing(null); }}>
          <span className="icon"><Icon name="Zap" size={16} /></span> Macros
        </div>
        <div className={`sidebar-item ${selectedProfile === '__clipboard' ? 'active' : ''}`} onClick={() => { setSelectedProfile('__clipboard'); setEditing(null); }}>
          <span className="icon"><Icon name="Clipboard" size={16} /></span> Clipboard
        </div>
        <div className="sidebar-footer">
          <div className="sidebar-credit">Desarrollado por <a href="https://www.linkedin.com/in/niconietoarg/" target="_blank" rel="noopener">Nicolás Nieto</a></div>
          <div className="sidebar-credit"><a href="https://github.com/nicolasnietoarg/ActionsRing_4all" target="_blank" rel="noopener">GitHub Repo</a></div>
        </div>
      </div>

      <div className="main">
        {selectedProfile === '__clipboard' ? <ClipboardPanel /> :
         selectedProfile === '__macros' ? <MacrosSection config={config} save={save} /> : <>
        <h2>{selectedProfile === '_default' ? 'Default' : selectedProfile}</h2>

        <AnimationSection config={config} save={save} />
        <PinnedSection config={config} save={save} />

        <div className="section">
          <div className="section-label">Hotkey global</div>
          <input className="input-field" value={config.hotkey} onChange={(e) => save({ ...config, hotkey: e.target.value })} />
        </div>

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
                  <option value="workflow">Workflow</option>
                  <option value="profile">Ir a Perfil</option>
                  <option value="macro">Macro</option>
                </select>
              </div>
              <div className="form-field">
                <label>Valor</label>
                {current.type === 'shortcut' ? (
                  <KeyRecorder value={current.value} onChange={(v) => updateAction(editing, 'value', v)} />
                ) : current.type === 'profile' ? (
                  <select value={current.value} onChange={(e) => updateAction(editing, 'value', e.target.value)}>
                    <option value="">Elegir perfil...</option>
                    {profiles.filter(p => p !== selectedProfile).map(p => <option key={p} value={p}>{p === '_default' ? 'Default' : p}</option>)}
                  </select>
                ) : current.type === 'macro' ? (
                  <MacroEditor steps={current.value ? (typeof current.value === 'string' ? JSON.parse(current.value) : current.value) : []} onChange={(steps) => updateAction(editing, 'value', JSON.stringify(steps))} />
                ) : (
                  <input value={current.value} onChange={(e) => updateAction(editing, 'value', e.target.value)} placeholder={current.type === 'open' ? 'Nombre de la app' : 'comando shell'} />
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
