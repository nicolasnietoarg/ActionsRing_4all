import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Copy, ClipboardPaste, Undo2, Save, Camera, Lock, Moon, Search, Terminal, Palette, GitBranch, FolderOpen, Columns2, X, Plus, RefreshCw, Link, EyeOff, ArrowLeft, ArrowRight, Code, Star, FolderPlus, Eye, Info, Trash2, Share2, Navigation, Trash, PenSquare, Reply, ReplyAll, Forward, Send, Archive, CheckCheck, FilePlus, Bold, List, ListChecks, Table, Pin, MessageSquarePlus, VolumeX, ChevronDown, ChevronUp, Pencil, Sparkles, Square, PenLine, PanelLeft, Play, SkipForward, SkipBack, Heart, Shuffle, Repeat, Volume2, CalendarPlus, CalendarCheck, Calendar, CalendarDays, CalendarRange, ZoomIn, ZoomOut, Maximize2, RotateCw, Download, Printer, Command, Target, Music, Globe, Compass, Mail, StickyNote, MessageCircle, Folder, Image, AppWindow, Clipboard, Move, ArrowUpRight, ArrowDownRight, Zap } from 'lucide-react';

const iconMap = { Copy, ClipboardPaste, Undo2, Save, Camera, Lock, Moon, Search, Terminal, Palette, GitBranch, FolderOpen, Columns2, X, Plus, RefreshCw, Link, EyeOff, ArrowLeft, ArrowRight, Code, Star, FolderPlus, Eye, Info, Trash2, Share2, Navigation, Trash, PenSquare, Reply, ReplyAll, Forward, Send, Archive, CheckCheck, FilePlus, Bold, List, ListChecks, Table, Pin, MessageSquarePlus, VolumeX, ChevronDown, ChevronUp, Pencil, Sparkles, Square, PenLine, PanelLeft, Play, SkipForward, SkipBack, Heart, Shuffle, Repeat, Volume2, CalendarPlus, CalendarCheck, Calendar, CalendarDays, CalendarRange, ZoomIn, ZoomOut, Maximize2, RotateCw, Download, Printer, Command, Target, Music, Globe, Compass, Mail, StickyNote, MessageCircle, Folder, Image, AppWindow, Clipboard, Move, ArrowUpRight, ArrowDownRight, Zap };

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

function Ring() {
  const [visible, setVisible] = useState(false);
  const [actions, setActions] = useState([]);
  const [activeApp, setActiveApp] = useState('');
  const [rolProfiles, setRolProfiles] = useState([]);
  const [rolOpen, setRolOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [hovered, setHovered] = useState(-1);
  const [closing, setClosing] = useState(false);
  const [macros, setMacros] = useState([]);
  const [macroOpen, setMacroOpen] = useState(false);
  const [animation, setAnimation] = useState({ enabled: true, entrance: 'deck', exit: 'deck', speed: 1.0, stagger: 50 });
  const clickLock = useRef(false);

  useEffect(() => {
    window.ring.onShowRing(({ actions, activeApp, rolProfiles: rp, animation: anim, macros: m }) => {
      setActions(actions.filter(a => a.type !== 'profile'));
      setActiveApp(activeApp);
      setRolProfiles(rp || []);
      setMacros(m || []);
      if (anim) setAnimation(anim);
      setVisible(true);
      setRolOpen(false);
      setMacroOpen(false);
      setSelectedProfile(null);
      setClosing(false);
    });
  }, []);

  const close = () => {
    if (!animation.enabled || animation.exit === 'none') {
      setVisible(false);
      window.ring.close();
      return;
    }
    setClosing(true);
    const totalDuration = (actions.length * (animation.stagger || 50) + 300) / (animation.speed || 1);
    setTimeout(() => {
      setVisible(false);
      setClosing(false);
      window.ring.close();
    }, totalDuration);
  };

  const exec = (action, fromProfile) => {
    setVisible(false);
    setRolOpen(false);
    setMacroOpen(false);
    setSelectedProfile(null);
    window.ring.executeAction(fromProfile ? { ...action, _fromProfile: fromProfile } : action);
  };

  const execMacro = (macro) => {
    setVisible(false);
    setRolOpen(false);
    setMacroOpen(false);
    window.ring.executeMacro(macro);
  };

  const safeClick = (fn) => {
    if (clickLock.current) return;
    clickLock.current = true;
    fn();
    setTimeout(() => { clickLock.current = false; }, 100);
  };

  const getBubbleStyle = (i, baseLeft, baseTop) => {
    const speed = animation.speed || 1.0;
    const stagger = animation.stagger || 50;
    const duration = 300 / speed;
    const delay = (i * stagger) / speed;
    const style = { left: baseLeft, top: baseTop };
    if (!animation.enabled || (closing ? animation.exit : animation.entrance) === 'none') return style;
    const type = closing ? animation.exit : animation.entrance;
    if (type === 'deck') {
      const exitDelay = closing ? ((actions.length - 1 - i) * stagger) / speed : delay;
      style.animation = `${closing ? 'deckOut' : 'deckIn'} ${duration}ms cubic-bezier(0.34, 1.56, 0.64, 1) ${closing ? exitDelay : delay}ms both`;
    } else if (type === 'pop') {
      style.animation = `${closing ? 'popOut' : 'bubblePop'} ${duration}ms cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}ms both`;
    } else if (type === 'fade') {
      style.animation = `${closing ? 'fadeOut' : 'fadeIn'} ${duration * 0.7}ms ease ${delay}ms both`;
    }
    return style;
  };

  if (!visible || !actions.length) return null;

  const hasRol = rolProfiles.length > 0;
  const hasMacros = macros.length > 0;
  const extraSlots = (hasRol ? 1 : 0) + (hasMacros ? 1 : 0);
  const totalSlots = actions.length + extraSlots;
  const rolAngle = (actions.length / totalSlots) * 2 * Math.PI - Math.PI / 2;
  const macroAngle = hasMacros ? ((actions.length + (hasRol ? 1 : 0)) / totalSlots) * 2 * Math.PI - Math.PI / 2 : 0;
  const selProfile = selectedProfile ? rolProfiles.find(p => p.name === selectedProfile) : null;

  const hiddenStyle = { display: 'none' };
  const visibleStyleObj = { display: 'flex' };

  return (
    <div className="ring-container">
      <div className="ring-wrapper">

        <button className="center-btn" onClick={close}>
          <span className="center-icon"><Icon name="Command" size={28} /></span>
          <span className="center-label">{activeApp}</span>
        </button>

        {actions.map((action, i) => {
          const angle = (i / totalSlots) * 2 * Math.PI - Math.PI / 2;
          const isPinned = action._pinned;
          const baseLeft = CENTER + RADIUS * Math.cos(angle) - BUTTON_SIZE / 2;
          const baseTop = CENTER + RADIUS * Math.sin(angle) - BUTTON_SIZE / 2;
          return (
            <button key={i}
              className={`bubble ${hovered === i ? 'bubble-hover' : ''} ${isPinned ? 'bubble-pinned' : ''}`}
              onClick={() => exec(action)}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(-1)}
              style={getBubbleStyle(i, baseLeft, baseTop)}>
              <span className="bubble-icon"><Icon name={action.icon} /></span>
              <span className="bubble-label">{action.label}</span>
              {isPinned && <span className="pin-dot" />}
            </button>
          );
        })}

        {hasRol && (
          <button className={`bubble ${rolOpen ? 'bubble-hover' : ''}`}
            onClick={() => safeClick(() => { setRolOpen(v => !v); setMacroOpen(false); setSelectedProfile(null); })}
            style={getBubbleStyle(actions.length, CENTER + RADIUS * Math.cos(rolAngle) - BUTTON_SIZE / 2, CENTER + RADIUS * Math.sin(rolAngle) - BUTTON_SIZE / 2)}>
            <span className="bubble-icon"><Icon name="Target" /></span>
            <span className="bubble-label">Rol</span>
          </button>
        )}

        {hasMacros && (
          <button className={`bubble bubble-macro ${macroOpen ? 'bubble-hover' : ''}`}
            onClick={() => safeClick(() => { setMacroOpen(v => !v); setRolOpen(false); setSelectedProfile(null); })}
            style={getBubbleStyle(actions.length + (hasRol ? 1 : 0), CENTER + RADIUS * Math.cos(macroAngle) - BUTTON_SIZE / 2, CENTER + RADIUS * Math.sin(macroAngle) - BUTTON_SIZE / 2)}>
            <span className="bubble-icon"><Icon name="Zap" /></span>
            <span className="bubble-label">Macro</span>
          </button>
        )}

        {/* Macro sub-bubbles */}
        {hasMacros && macros.map((macro, i) => {
          const count = macros.length;
          const gap = 0.26;
          const totalSpread = (count - 1) * gap;
          const angle = macroAngle - totalSpread / 2 + i * gap;
          return (
            <button key={'macro-' + i}
              className="bubble sub-bubble bubble-macro"
              onClick={() => execMacro(macro)}
              style={{ left: CENTER + OUTER_RADIUS * Math.cos(angle) - 24, top: CENTER + OUTER_RADIUS * Math.sin(angle) - 24, zIndex: 50, ...(macroOpen ? visibleStyleObj : hiddenStyle) }}
              title={macro.label}>
              <span className="bubble-icon"><Icon name={macro.icon || 'Zap'} size={18} /></span>
              <span className="bubble-label">{macro.label}</span>
            </button>
          );
        })}

        {/* Rol profile sub-bubbles */}
        {hasRol && rolProfiles.map((profile, i) => {
          const count = rolProfiles.length;
          const gap = 0.26;
          const totalSpread = (count - 1) * gap;
          const angle = rolAngle - totalSpread / 2 + i * gap;
          return (
            <button key={profile.name}
              className={`bubble sub-bubble ${selectedProfile === profile.name ? 'bubble-hover' : ''}`}
              onClick={() => safeClick(() => setSelectedProfile(v => v === profile.name ? null : profile.name))}
              style={{ left: CENTER + OUTER_RADIUS * Math.cos(angle) - 24, top: CENTER + OUTER_RADIUS * Math.sin(angle) - 24, zIndex: 50, ...(rolOpen ? visibleStyleObj : hiddenStyle) }}>
              <span className="bubble-icon"><Icon name={profile.icon} size={18} /></span>
              <span className="bubble-label">{profile.name}</span>
            </button>
          );
        })}

        {/* Rol action sub-bubbles */}
        {hasRol && rolProfiles.map((profile, pIdx) => {
          const pCount = rolProfiles.length;
          const pGap = 0.26;
          const pTotalSpread = (pCount - 1) * pGap;
          const parentAngle = rolAngle - pTotalSpread / 2 + pIdx * pGap;
          const isSelected = selectedProfile === profile.name;
          return profile.actions.slice(0, 6).map((action, i) => {
            const count = Math.min(profile.actions.length, 6);
            const gap = 0.26;
            const totalSpread = (count - 1) * gap;
            const angle = parentAngle - totalSpread / 2 + i * gap;
            return (
              <button key={profile.name + '-' + i} className="bubble action-sub-bubble"
                onClick={() => exec(action, profile.name)}
                style={{ left: CENTER + SUB_RADIUS * Math.cos(angle) - 22, top: CENTER + SUB_RADIUS * Math.sin(angle) - 22, zIndex: 30, ...(isSelected ? visibleStyleObj : hiddenStyle) }}
                title={action.label}>
                <span className="bubble-icon"><Icon name={action.icon} size={15} /></span>
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
