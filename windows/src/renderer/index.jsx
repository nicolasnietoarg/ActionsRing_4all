import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Copy, ClipboardPaste, Undo2, Save, Camera, Lock, Moon, Search, Terminal, Palette, GitBranch, FolderOpen, Columns2, X, Plus, RefreshCw, Link, EyeOff, ArrowLeft, ArrowRight, Code, Star, FolderPlus, Eye, Info, Trash2, Share2, Navigation, Trash, PenSquare, Reply, ReplyAll, Forward, Send, Archive, CheckCheck, FilePlus, Bold, List, ListChecks, Table, Pin, MessageSquarePlus, VolumeX, ChevronDown, ChevronUp, Pencil, Sparkles, Square, PenLine, PanelLeft, Play, SkipForward, SkipBack, Heart, Shuffle, Repeat, Volume2, CalendarPlus, CalendarCheck, Calendar, CalendarDays, CalendarRange, ZoomIn, ZoomOut, Maximize2, RotateCw, Download, Printer, Command, Target, Music, Globe, Compass, Mail, StickyNote, MessageCircle, Folder, Image, AppWindow, Clipboard, Move, ArrowUpRight, ArrowDownRight } from 'lucide-react';

const iconMap = { Copy, ClipboardPaste, Undo2, Save, Camera, Lock, Moon, Search, Terminal, Palette, GitBranch, FolderOpen, Columns2, X, Plus, RefreshCw, Link, EyeOff, ArrowLeft, ArrowRight, Code, Star, FolderPlus, Eye, Info, Trash2, Share2, Navigation, Trash, PenSquare, Reply, ReplyAll, Forward, Send, Archive, CheckCheck, FilePlus, Bold, List, ListChecks, Table, Pin, MessageSquarePlus, VolumeX, ChevronDown, ChevronUp, Pencil, Sparkles, Square, PenLine, PanelLeft, Play, SkipForward, SkipBack, Heart, Shuffle, Repeat, Volume2, CalendarPlus, CalendarCheck, Calendar, CalendarDays, CalendarRange, ZoomIn, ZoomOut, Maximize2, RotateCw, Download, Printer, Command, Target, Music, Globe, Compass, Mail, StickyNote, MessageCircle, Folder, Image, AppWindow, Clipboard, Move, ArrowUpRight, ArrowDownRight };

function Icon({ name, size = 22 }) {
  const LucideIcon = iconMap[name];
  if (LucideIcon) return <LucideIcon size={size} strokeWidth={1.8} />;
  return <span style={{ fontSize: size * 0.8 }}>{name}</span>;
}

const RADIUS = 120;
const OUTER_RADIUS = 195;
const SUB_RADIUS = 260;
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
  const clickLock = useRef(false);

  useEffect(() => {
    window.ring.onShowRing(({ actions, activeApp, rolProfiles: rp }) => {
      setActions(actions.filter(a => a.type !== 'profile'));
      setActiveApp(activeApp);
      setRolProfiles(rp || []);
      setVisible(true);
      setRolOpen(false);
      setSelectedProfile(null);
    });
  }, []);

  const close = () => {
    setVisible(false);
    setRolOpen(false);
    setSelectedProfile(null);
    window.ring.close();
  };

  const exec = (action, fromProfile) => {
    setVisible(false);
    setRolOpen(false);
    setSelectedProfile(null);
    window.ring.executeAction(fromProfile ? { ...action, _fromProfile: fromProfile } : action);
  };

  const safeClick = (fn) => {
    if (clickLock.current) return;
    clickLock.current = true;
    fn();
    setTimeout(() => { clickLock.current = false; }, 100);
  };

  if (!visible || !actions.length) return null;

  const hasRol = rolProfiles.length > 0;
  const totalSlots = hasRol ? actions.length + 1 : actions.length;
  const rolAngle = (actions.length / totalSlots) * 2 * Math.PI - Math.PI / 2;
  const selProfile = selectedProfile ? rolProfiles.find(p => p.name === selectedProfile) : null;

  // Hidden style for sub-bubbles when closed
  const hiddenStyle = { display: 'none' };
  const visibleStyle = { display: 'flex' };

  return (
    <div className="ring-container">
      <div className="ring-wrapper">

        <button className="center-btn" onClick={close}>
          <span className="center-icon"><Icon name="Command" size={24} /></span>
          <span className="center-label">{activeApp}</span>
        </button>

        {actions.map((action, i) => {
          const angle = (i / totalSlots) * 2 * Math.PI - Math.PI / 2;
          return (
            <button key={i} className={`bubble ${hovered === i ? 'bubble-hover' : ''}`}
              onClick={() => exec(action)}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(-1)}
              style={{ left: CENTER + RADIUS * Math.cos(angle) - BUTTON_SIZE / 2, top: CENTER + RADIUS * Math.sin(angle) - BUTTON_SIZE / 2 }}>
              <span className="bubble-icon"><Icon name={action.icon} /></span>
              <span className="bubble-label">{action.label}</span>
            </button>
          );
        })}

        {hasRol && (
          <button className={`bubble ${rolOpen ? 'bubble-hover' : ''}`}
            onClick={() => safeClick(() => { setRolOpen(v => !v); setSelectedProfile(null); })}
            style={{ left: CENTER + RADIUS * Math.cos(rolAngle) - BUTTON_SIZE / 2, top: CENTER + RADIUS * Math.sin(rolAngle) - BUTTON_SIZE / 2, zIndex: 100 }}>
            <span className="bubble-icon"><Icon name="Target" /></span>
            <span className="bubble-label">Rol</span>
          </button>
        )}

        {/* Always render profile bubbles, toggle visibility */}
        {hasRol && rolProfiles.map((profile, i) => {
          const spread = Math.min(Math.PI * 0.3 * rolProfiles.length, Math.PI * 0.8);
          const step = rolProfiles.length === 1 ? 0 : spread / (rolProfiles.length - 1);
          const angle = rolAngle - spread / 2 + i * step;
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

        {/* Always render action sub-bubbles for all profiles, toggle visibility */}
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
