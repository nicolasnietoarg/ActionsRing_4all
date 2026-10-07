import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { Copy, ClipboardPaste, Undo2, Save, Camera, Lock, Moon, Search, Terminal, Palette, GitBranch, FolderOpen, Columns2, X, Plus, RefreshCw, Link, EyeOff, ArrowLeft, ArrowRight, Code, Star, FolderPlus, Eye, Info, Trash2, Share2, Navigation, Trash, PenSquare, Reply, ReplyAll, Forward, Send, Archive, CheckCheck, FilePlus, Bold, List, ListChecks, Table, Pin, MessageSquarePlus, VolumeX, ChevronDown, ChevronUp, Pencil, Sparkles, Square, PenLine, PanelLeft, Play, SkipForward, SkipBack, Heart, Shuffle, Repeat, Volume2, CalendarPlus, CalendarCheck, Calendar, CalendarDays, CalendarRange, ZoomIn, ZoomOut, Maximize2, RotateCw, Download, Printer, Command, Target, Music, Globe, Compass, Mail, StickyNote, MessageCircle, Folder, Image, AppWindow, Clipboard, Move, ArrowUpRight, ArrowDownRight } from 'lucide-react';

const iconMap = { Copy, ClipboardPaste, Undo2, Save, Camera, Lock, Moon, Search, Terminal, Palette, GitBranch, FolderOpen, Columns2, X, Plus, RefreshCw, Link, EyeOff, ArrowLeft, ArrowRight, Code, Star, FolderPlus, Eye, Info, Trash2, Share2, Navigation, Trash, PenSquare, Reply, ReplyAll, Forward, Send, Archive, CheckCheck, FilePlus, Bold, List, ListChecks, Table, Pin, MessageSquarePlus, VolumeX, ChevronDown, ChevronUp, Pencil, Sparkles, Square, PenLine, PanelLeft, Play, SkipForward, SkipBack, Heart, Shuffle, Repeat, Volume2, CalendarPlus, CalendarCheck, Calendar, CalendarDays, CalendarRange, ZoomIn, ZoomOut, Maximize2, RotateCw, Download, Printer, Command, Target, Music, Globe, Compass, Mail, StickyNote, MessageCircle, Folder, Image, AppWindow, Clipboard, Move, ArrowUpRight, ArrowDownRight };

function Icon({ name, size = 22 }) {
  const LucideIcon = iconMap[name];
  if (LucideIcon) return <LucideIcon size={size} strokeWidth={1.8} />;
  return <span style={{ fontSize: size * 0.8 }}>{name}</span>;
}

const RADIUS = 140;
const OUTER_RADIUS = 215;
const SUB_RADIUS = 280;
const BUTTON_SIZE = 58;
const CENTER = 350;
const BASE_DURATION = 300;
const DEFAULT_ANIMATION = { enabled: true, entrance: 'deck', exit: 'deck', speed: 1.0, stagger: 50 };

function Ring() {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [actions, setActions] = useState([]);
  const [activeApp, setActiveApp] = useState('');
  const [rolProfiles, setRolProfiles] = useState([]);
  const [macros, setMacros] = useState([]);
  const [rolOpen, setRolOpen] = useState(false);
  const [macroOpen, setMacroOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [hovered, setHovered] = useState(-1);
  const [animation, setAnimation] = useState(DEFAULT_ANIMATION);
  const clickLock = useRef(false);
  const closeTimer = useRef(null);

  useEffect(() => {
    window.ring.onShowRing(({ actions: list, activeApp: app, rolProfiles: rp, animation: anim, macros: m }) => {
      if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
      setActions(Array.isArray(list) ? list : []);
      setActiveApp(app || '');
      setRolProfiles(Array.isArray(rp) ? rp : []);
      setMacros(Array.isArray(m) ? m : []);
      setAnimation(anim && Object.keys(anim).length ? { ...DEFAULT_ANIMATION, ...anim } : DEFAULT_ANIMATION);
      setClosing(false);
      setVisible(true);
      setRolOpen(false);
      setMacroOpen(false);
      setSelectedProfile(null);
    });
    // El main espera esta señal: si se abría el anillo antes de que el
    // renderer terminara de cargar, el mensaje se perdía y quedaba una
    // ventana en blanco.
    window.ring.ready();
  }, []);

  const hasRol = rolProfiles.length > 0;
  const hasMacros = macros.length > 0;
  const extraSlots = (hasRol ? 1 : 0) + (hasMacros ? 1 : 0);
  const totalSlots = Math.max(actions.length + extraSlots, 1);

  const reset = () => {
    setVisible(false);
    setClosing(false);
    setRolOpen(false);
    setMacroOpen(false);
    setSelectedProfile(null);
    setHovered(-1);
  };

  const animationsOff = !animation.enabled || animation.exit === 'none';
  // La salida tiene que esperar a TODAS las burbujas, incluidas Rol y Macro:
  // antes se calculaba solo con actions.length y las últimas se cortaban.
  const exitDuration = (totalSlots * (animation.stagger || 50) + BASE_DURATION) / (animation.speed || 1);

  // `send` corre después de la animación de salida (o al instante si está apagada).
  const closeWith = useCallback((send) => {
    if (animationsOff) {
      reset();
      send();
      return;
    }
    setClosing(true);
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null;
      reset();
      send();
    }, exitDuration);
  }, [animationsOff, exitDuration]);

  const close = useCallback(() => closeWith(() => window.ring.close()), [closeWith]);

  const exec = (action, fromProfile) => {
    const payload = fromProfile ? { ...action, _fromProfile: fromProfile } : action;
    // Ir a otro perfil no cierra el anillo: se reemplaza el contenido, así
    // que no corresponde animar la salida.
    if (action.type === 'profile') {
      window.ring.executeAction(payload);
      return;
    }
    closeWith(() => window.ring.executeAction(payload));
  };

  const execMacro = (macro) => closeWith(() => window.ring.executeMacro(macro));

  const safeClick = (fn) => {
    if (clickLock.current) return;
    clickLock.current = true;
    fn();
    setTimeout(() => { clickLock.current = false; }, 100);
  };

  // Escape se maneja acá, en la ventana. El main lo registraba como atajo
  // global permanente, lo que lo dejaba secuestrado para todo el sistema;
  // ahora solo lo registra mientras el anillo está abierto, como red de
  // seguridad. Las dos vías hacen lo mismo: cerrar.
  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      close();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [visible, close]);

  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  if (!visible) return null;

  const rolIndex = actions.length;
  const macroIndex = actions.length + (hasRol ? 1 : 0);
  const rolAngle = (rolIndex / totalSlots) * 2 * Math.PI - Math.PI / 2;
  const macroAngle = (macroIndex / totalSlots) * 2 * Math.PI - Math.PI / 2;

  const hiddenStyle = { display: 'none' };
  const visibleStyle = { display: 'flex' };

  const getBubbleStyle = (i, baseLeft, baseTop) => {
    const enabled = animation.enabled !== false;
    const speed = animation.speed || 1.0;
    const stagger = animation.stagger || 50;
    const duration = BASE_DURATION / speed;
    const delay = (i * stagger) / speed;
    const style = { left: baseLeft, top: baseTop };
    const type = closing ? animation.exit : animation.entrance;
    if (!enabled || type === 'none') return style;
    if (type === 'deck') {
      const exitDelay = ((totalSlots - 1 - i) * stagger) / speed;
      style.animation = `${closing ? 'deckOut' : 'deckIn'} ${duration}ms cubic-bezier(0.34, 1.56, 0.64, 1) ${closing ? exitDelay : delay}ms both`;
    } else if (type === 'pop') {
      style.animation = `${closing ? 'popOut' : 'bubblePop'} ${duration}ms cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}ms both`;
    } else if (type === 'fade') {
      style.animation = `${closing ? 'fadeOut' : 'fadeIn'} ${duration * 0.7}ms ease ${delay}ms both`;
    }
    return style;
  };

  const centerStyle = closing && animation.enabled && animation.exit !== 'none'
    ? { animation: `popOut ${200 / (animation.speed || 1)}ms ease ${(totalSlots * (animation.stagger || 50)) / (animation.speed || 1)}ms both` }
    : {};

  return (
    <div className="ring-container">
      <div className="ring-wrapper">

        {/* Click fuera de las burbujas = cerrar. Antes la ventana transparente
            de 700x700 se comía esos clicks sin hacer nada. */}
        <div className="ring-backdrop" onClick={close} aria-hidden="true" />

        <button className="center-btn" onClick={close} style={centerStyle} aria-label="Cerrar anillo" title="Cerrar (Escape)">
          <img className="center-icon" src="logo.png" alt="" style={{ width: 54, height: 54, objectFit: 'contain', filter: 'drop-shadow(0 0 8px rgba(38,186,142,0.4))' }} />
          <span className="center-label">{activeApp}</span>
        </button>

        {/* Perfil sin acciones: se muestra el aviso en lugar de dejar una
            ventana invisible que bloquea los clicks. */}
        {!actions.length && !extraSlots && (
          <div className="ring-empty">
            Sin acciones para <strong>{activeApp || 'esta app'}</strong>
            <small>Tray → Settings para configurarlas</small>
          </div>
        )}

        {actions.map((action, i) => {
          const angle = (i / totalSlots) * 2 * Math.PI - Math.PI / 2;
          const isPinned = action._pinned;
          const baseLeft = CENTER + RADIUS * Math.cos(angle) - BUTTON_SIZE / 2;
          const baseTop = CENTER + RADIUS * Math.sin(angle) - BUTTON_SIZE / 2;
          return (
            <button key={action.id || `${action.label}-${i}`}
              className={`bubble ${hovered === i ? 'bubble-hover' : ''} ${isPinned ? 'bubble-pinned' : ''}`}
              onClick={() => exec(action)}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(-1)}
              title={action.label}
              style={getBubbleStyle(i, baseLeft, baseTop)}>
              <span className="bubble-icon"><Icon name={action.icon} /></span>
              <span className="bubble-label">{action.label}</span>
              {isPinned && <span className="pin-dot" />}
            </button>
          );
        })}

        {/* Burbuja Rol */}
        {hasRol && (
          <button className={`bubble ${rolOpen ? 'bubble-hover' : ''}`}
            onClick={() => safeClick(() => { setRolOpen((v) => !v); setMacroOpen(false); setSelectedProfile(null); })}
            title="Perfiles de otras apps"
            style={getBubbleStyle(rolIndex, CENTER + RADIUS * Math.cos(rolAngle) - BUTTON_SIZE / 2, CENTER + RADIUS * Math.sin(rolAngle) - BUTTON_SIZE / 2)}>
            <span className="bubble-icon"><Icon name="Target" /></span>
            <span className="bubble-label">Rol</span>
          </button>
        )}

        {/* Burbuja Macro */}
        {hasMacros && (
          <button className={`bubble bubble-macro ${macroOpen ? 'bubble-hover' : ''}`}
            onClick={() => safeClick(() => { setMacroOpen((v) => !v); setRolOpen(false); setSelectedProfile(null); })}
            title="Macros grabadas"
            style={getBubbleStyle(macroIndex, CENTER + RADIUS * Math.cos(macroAngle) - BUTTON_SIZE / 2, CENTER + RADIUS * Math.sin(macroAngle) - BUTTON_SIZE / 2)}>
            <span className="bubble-icon"><Icon name="Play" /></span>
            <span className="bubble-label">Macro</span>
          </button>
        )}

        {/* Sub-burbujas de macros: arco compacto junto a la burbuja Macro */}
        {hasMacros && macros.map((macro, i) => {
          const gap = 0.26; // radianes, ~55px a radio 215
          const totalSpread = (macros.length - 1) * gap;
          const angle = macroAngle - totalSpread / 2 + i * gap;
          return (
            <button key={`macro-${macro.label}-${i}`}
              className="bubble sub-bubble"
              onClick={() => execMacro(macro)}
              title={macro.label}
              style={{ left: CENTER + OUTER_RADIUS * Math.cos(angle) - 26, top: CENTER + OUTER_RADIUS * Math.sin(angle) - 26, zIndex: 50, ...(macroOpen ? visibleStyle : hiddenStyle) }}>
              <span className="bubble-icon"><Icon name={macro.icon || 'Play'} size={18} /></span>
              <span className="bubble-label">{macro.label}</span>
            </button>
          );
        })}

        {/* Sub-burbujas de perfiles Rol */}
        {hasRol && rolProfiles.map((profile, i) => {
          const gap = 0.26;
          const totalSpread = (rolProfiles.length - 1) * gap;
          const angle = rolAngle - totalSpread / 2 + i * gap;
          return (
            <button key={profile.name}
              className={`bubble sub-bubble ${selectedProfile === profile.name ? 'bubble-hover' : ''}`}
              onClick={() => safeClick(() => setSelectedProfile((v) => (v === profile.name ? null : profile.name)))}
              title={profile.name}
              style={{ left: CENTER + OUTER_RADIUS * Math.cos(angle) - 26, top: CENTER + OUTER_RADIUS * Math.sin(angle) - 26, zIndex: 50, ...(rolOpen ? visibleStyle : hiddenStyle) }}>
              <span className="bubble-icon"><Icon name={profile.icon} size={18} /></span>
              <span className="bubble-label">{profile.name}</span>
            </button>
          );
        })}

        {/* Acciones de cada perfil Rol */}
        {hasRol && rolProfiles.map((profile, pIdx) => {
          const pSpread = Math.min(Math.PI * 0.3 * rolProfiles.length, Math.PI * 0.8);
          const pStep = rolProfiles.length === 1 ? 0 : pSpread / (rolProfiles.length - 1);
          const parentAngle = rolAngle - pSpread / 2 + pIdx * pStep;
          const isSelected = selectedProfile === profile.name;
          const list = (profile.actions || []).slice(0, 6);
          return list.map((action, i) => {
            const aSpread = Math.min(Math.PI * 0.12 * list.length, Math.PI * 0.5);
            const aStep = list.length === 1 ? 0 : aSpread / (list.length - 1);
            const angle = parentAngle - aSpread / 2 + i * aStep;
            return (
              <button key={`${profile.name}-${action.id || i}`} className="bubble action-sub-bubble"
                onClick={() => exec(action, profile.name)}
                style={{ left: CENTER + SUB_RADIUS * Math.cos(angle) - 22, top: CENTER + SUB_RADIUS * Math.sin(angle) - 22, zIndex: 30, ...(isSelected ? visibleStyle : hiddenStyle) }}
                title={action.label}>
                <span className="bubble-icon"><Icon name={action.icon} /></span>
                <span className="bubble-label">{action.label}</span>
              </button>
            );
          });
        })}
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<Ring />);
