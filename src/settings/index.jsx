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

  useEffect(() => {
    if (!recording) return;
    const handler = (e) => {
      e.preventDefault();
      e.stopPropagation();
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
      </div>

      <div className="main">
        {selectedProfile === '__clipboard' ? <ClipboardPanel /> : <>
        <h2>{selectedProfile === '_default' ? 'Default' : selectedProfile}</h2>

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
