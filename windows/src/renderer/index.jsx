import React, { useState, useEffect, useRef } from 'react';
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
  const [animation, setAnimation] = useState({ enabled: true, entrance: 'deck', exit: 'deck', speed: 1.0, stagger: 50 });
  const clickLock = useRef(false);

  useEffect(() => {
    window.ring.onShowRing(({ actions, activeApp, rolProfiles: rp, animation: anim, macros: m }) => {
      setActions(actions.filter(a => a.type !== 'profile'));
      setActiveApp(activeApp);
      setRolProfiles(rp || []);
      setMacros(m || []);
      if (anim) setAnimation(anim);
      setClosing(false);
      setVisible(true);
      setRolOpen(false);
      setMacroOpen(false);
      setSelectedProfile(null);
    });
  }, []);

  const close = () => {
    if (!animation.enabled || animation.exit === 'none') {
      setVisible(false); setRolOpen(false); setMacroOpen(false); setSelectedProfile(null);
      window.ring.close();
      return;
    }
    setClosing(true);
    const totalDuration = (actions.length * animation.stagger + 300) / animation.speed;
    setTimeout(() => {
      setVisible(false); setClosing(false); setRolOpen(false); setMacroOpen(false); setSelectedProfile(null);
      window.ring.close();
    }, totalDuration);
  };

  const exec = (action, fromProfile) => {
    if (!animation.enabled || animation.exit === 'none') {
      setVisible(false); setRolOpen(false); setMacroOpen(false); setSelectedProfile(null);
      window.ring.executeAction(fromProfile ? { ...action, _fromProfile: fromProfile } : action);
      return;
    }
    setClosing(true);
    const totalDuration = (actions.length * animation.stagger + 300) / animation.speed;
    setTimeout(() => {
      setVisible(false); setClosing(false); setRolOpen(false); setMacroOpen(false); setSelectedProfile(null);
      window.ring.executeAction(fromProfile ? { ...action, _fromProfile: fromProfile } : action);
    }, totalDuration);
  };

  const execMacro = (macro) => {
    setVisible(false); setClosing(false); setRolOpen(false); setMacroOpen(false);
    window.ring.executeMacro(macro);
  };

  const safeClick = (fn) => {
    if (clickLock.current) return;
    clickLock.current = true;
    fn();
    setTimeout(() => { clickLock.current = false; }, 100);
  };

  if (!visible || !actions.length) return null;

  const hasRol = rolProfiles.length > 0;
  const hasMacros = macros.length > 0;
  const extraSlots = (hasRol ? 1 : 0) + (hasMacros ? 1 : 0);
  const totalSlots = actions.length + extraSlots;
  const rolIndex = actions.length;
  const macroIndex = actions.length + (hasRol ? 1 : 0);
  const rolAngle = (rolIndex / totalSlots) * 2 * Math.PI - Math.PI / 2;
  const macroAngle = (macroIndex / totalSlots) * 2 * Math.PI - Math.PI / 2;

  const hiddenStyle = { display: 'none' };
  const visibleStyle = { display: 'flex' };

  const getBubbleStyle = (i, baseLeft, baseTop) => {
    const anim = animation;
    const enabled = anim.enabled !== false;
    const speed = anim.speed || 1.0;
    const stagger = anim.stagger || 50;
    const duration = (300 / speed);
    const delay = (i * stagger) / speed;
    const style = { left: baseLeft, top: baseTop };
    if (!enabled || (closing ? anim.exit : anim.entrance) === 'none') return style;
    const type = closing ? anim.exit : anim.entrance;
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

  return (
    <div className="ring-container">
      <div className="ring-wrapper">

        <button className="center-btn" onClick={close}
          style={closing ? { animation: `popOut ${200 / (animation.speed || 1)}ms ease ${(actions.length * (animation.stagger || 50)) / (animation.speed || 1)}ms both` } : {}}>
          <img className="center-icon" src="logo.png" style={{width: 54, height: 54, objectFit: 'contain', filter: 'drop-shadow(0 0 8px rgba(38,186,142,0.4))'}} />
          <span className="center-label">{activeApp}</span>
        </button>

        {actions.map((action, i) => {
          const angle = (i / totalSlots) * 2 * Math.PI - Math.PI / 2;
          const isPinned = action._pinned;
          const baseLeft = CENTER + RADIUS * Math.cos(angle) - BUTTON_SIZE / 2;
          const baseTop = CENTER + RADIUS * Math.sin(angle) - BUTTON_SIZE / 2;
          return (
            <button key={i} className={`bubble ${hovered === i ? 'bubble-hover' : ''} ${isPinned ? 'bubble-pinned' : ''}`}
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

        {/* Rol bubble */}
        {hasRol && (
          <button className={`bubble ${rolOpen ? 'bubble-hover' : ''}`}
            onClick={() => safeClick(() => { setRolOpen(v => !v); setMacroOpen(false); setSelectedProfile(null); })}
            style={getBubbleStyle(rolIndex, CENTER + RADIUS * Math.cos(rolAngle) - BUTTON_SIZE / 2, CENTER + RADIUS * Math.sin(rolAngle) - BUTTON_SIZE / 2)}>
            <span className="bubble-icon"><Icon name="Target" /></span>
            <span className="bubble-label">Rol</span>
          </button>
        )}

        {/* Macro bubble */}
        {hasMacros && (
          <button className={`bubble bubble-macro ${macroOpen ? 'bubble-hover' : ''}`}
            onClick={() => safeClick(() => { setMacroOpen(v => !v); setRolOpen(false); setSelectedProfile(null); })}
            style={getBubbleStyle(macroIndex, CENTER + RADIUS * Math.cos(macroAngle) - BUTTON_SIZE / 2, CENTER + RADIUS * Math.sin(macroAngle) - BUTTON_SIZE / 2)}>
            <span className="bubble-icon"><Icon name="Play" /></span>
            <span className="bubble-label">Macro</span>
          </button>
        )}

        {/* Macro sub-bubbles - compact arc near the Macro bubble */}
        {hasMacros && macros.map((macro, i) => {
          const count = macros.length;
          // Fixed angular gap between bubbles (~55px apart at OUTER_RADIUS)
          const gap = 0.26; // radians, ~55px at radius 215
          const totalSpread = (count - 1) * gap;
          const angle = macroAngle - totalSpread / 2 + i * gap;
          return (
            <button key={'macro-' + i}
              className="bubble sub-bubble"
              onClick={() => execMacro(macro)}
              style={{ left: CENTER + OUTER_RADIUS * Math.cos(angle) - 26, top: CENTER + OUTER_RADIUS * Math.sin(angle) - 26, zIndex: 50, ...(macroOpen ? visibleStyle : hiddenStyle) }}>
              <span className="bubble-icon"><Icon name={macro.icon || 'Play'} size={18} /></span>
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
              style={{ left: CENTER + OUTER_RADIUS * Math.cos(angle) - 26, top: CENTER + OUTER_RADIUS * Math.sin(angle) - 26, zIndex: 50, ...(rolOpen ? visibleStyle : hiddenStyle) }}>
              <span className="bubble-icon"><Icon name={profile.icon} size={18} /></span>
              <span className="bubble-label">{profile.name}</span>
            </button>
          );
        })}

        {/* Rol action sub-bubbles */}
        {hasRol && rolProfiles.map((profile, pIdx) => {
          const pSpread = Math.min(Math.PI * 0.3 * rolProfiles.length, Math.PI * 0.8);
          const pStep = rolProfiles.length === 1 ? 0 : pSpread / (rolProfiles.length - 1);
          const parentAngle = rolAngle - pSpread / 2 + pIdx * pStep;
          const isSelected = selectedProfile === profile.name;
          return profile.actions.slice(0, 6).map((action, i) => {
            const count = Math.min(profile.actions.length, 6);
            const aSpread = Math.min(Math.PI * 0.12 * count, Math.PI * 0.5);
            const aStep = count === 1 ? 0 : aSpread / (count - 1);
            const angle = parentAngle - aSpread / 2 + i * aStep;
            return (
              <button key={profile.name + '-' + i} className="bubble action-sub-bubble"
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
