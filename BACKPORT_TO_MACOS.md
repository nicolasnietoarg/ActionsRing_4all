# Backport Guide: Apply Windows v0.4.0 Features to macOS

This document describes all changes made to the Windows version that should be ported to the macOS version (root `src/` folder). Use this as a spec for Kiro on macOS.

---

## Summary of Features to Port

1. **Macro Recorder & Macro Bubble** — record keystroke sequences, replay from ring
2. **Pinned Actions** — actions that persist across all app profiles
3. **Configurable Animations** — deck/pop/fade/none with speed and stagger controls
4. **Macro Action Type** — new action type for keystroke sequences with delays
5. **Improved Layout** — larger center button, compact sub-bubble spacing, label overflow fix
6. **Hover Glow on All Bubbles** — not just pinned

---

## 1. Config Changes (`config/default.json`)

Add these new top-level keys:

```json
{
  "hotkey": "Cmd+Shift+Space",
  "animation": {
    "enabled": true,
    "entrance": "deck",
    "exit": "deck",
    "speed": 1.0,
    "stagger": 50
  },
  "pinnedActions": [
    { "label": "Screenshot", "icon": "Camera", "type": "shortcut", "value": "Command+Shift+4" },
    { "label": "Lock", "icon": "Lock", "type": "shortcut", "value": "Command+Control+Q" }
  ],
  "macros": [
    {
      "label": "Select All + Copy",
      "icon": "Clipboard",
      "steps": [
        { "keys": "Command+A", "delay": 80 },
        { "keys": "Command+C", "delay": 0 }
      ]
    }
  ],
  "rolProfiles": [...],
  "actions": {...}
}
```

### Config Schema

| Key | Type | Description |
|-----|------|-------------|
| `animation.enabled` | bool | Toggle all animations |
| `animation.entrance` | string | `deck`, `pop`, `fade`, `none` |
| `animation.exit` | string | `deck`, `pop`, `fade`, `none` |
| `animation.speed` | float | Multiplier 0.3–3.0 (1.0 = normal) |
| `animation.stagger` | int | ms between each bubble animation (10–150) |
| `pinnedActions` | array | Actions shown in every profile |
| `macros` | array | Recorded macro sequences |
| `macros[].label` | string | Display name |
| `macros[].icon` | string | Lucide icon name |
| `macros[].steps` | array | `{keys, delay}` pairs |
| `macros[].steps[].keys` | string | Shortcut (`Command+C`) or `type:text` |
| `macros[].steps[].delay` | int | ms to wait after this step |

---

## 2. Main Process Changes (`src/main/main.js`)

### 2.1 Pinned Actions in toggleOverlay

When building the actions array to send to the renderer, merge `config.pinnedActions` at the beginning:

```javascript
const profileActions = config.actions[activeApp] || config.actions._default;
const pinnedActions = (config.pinnedActions || []).map(a => ({ ...a, _pinned: true }));
const pinnedLabels = new Set(pinnedActions.map(a => a.label));
const actions = [...pinnedActions, ...profileActions.filter(a => !pinnedLabels.has(a.label))];
```

### 2.2 Send macros and animation config to renderer

```javascript
overlay.webContents.send('show-ring', {
  actions, activeApp, rolProfiles,
  animation: config.animation || {},
  macros: config.macros || []
});
```

### 2.3 New action type: `macro`

Add to `executeAction()`:

```javascript
case 'macro': {
  const steps = typeof action.value === 'string' ? JSON.parse(action.value) : action.value;
  executeMacro(steps);
  break;
}
```

### 2.4 executeMacro function

```javascript
function executeMacro(steps) {
  let delay = 0;
  for (const step of steps) {
    const d = step.delay || 50;
    setTimeout(() => {
      const keys = step.keys || '';
      if (keys.startsWith('type:')) {
        typeText(expandVariables(keys.slice(5)));
      } else {
        sendKeys(keys); // use existing osascript-based sendKeys
      }
    }, delay);
    delay += d;
  }
}
```

### 2.5 typeText function (macOS version)

For macOS, use osascript to type text:

```javascript
function typeText(text) {
  const escaped = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const script = `tell application "System Events" to keystroke "${escaped}"`;
  exec(`osascript -e '${script}'`);
}
```

### 2.6 IPC handlers for macro execution from ring

```javascript
ipcMain.on('execute-macro', (_, macro) => {
  overlay.hide();
  setTimeout(() => executeMacro(macro.steps), 200);
});
```

### 2.7 IPC handlers for Settings (save/delete macros)

```javascript
ipcMain.handle('save-macro', (_, macro) => {
  if (!config.macros) config.macros = [];
  config.macros.push(macro);
  saveConfig(config);
  return config.macros;
});

ipcMain.handle('delete-macro', (_, index) => {
  if (config.macros) config.macros.splice(index, 1);
  saveConfig(config);
  return config.macros;
});

ipcMain.handle('get-macros', () => config.macros || []);
```

---

## 3. Preload Changes (`src/main/preload.js`)

Add to `ring` context:

```javascript
executeMacro: (macro) => ipcRenderer.send('execute-macro', macro),
```

Add to `settings` context:

```javascript
startRecording: () => ipcRenderer.invoke('start-recording'),
stopRecording: () => ipcRenderer.invoke('stop-recording'),
saveMacro: (macro) => ipcRenderer.invoke('save-macro', macro),
deleteMacro: (index) => ipcRenderer.invoke('delete-macro', index),
getMacros: () => ipcRenderer.invoke('get-macros'),
```

---

## 4. Renderer Changes (`src/renderer/index.jsx`)

### 4.1 New state variables

```javascript
const [closing, setClosing] = useState(false);
const [macros, setMacros] = useState([]);
const [macroOpen, setMacroOpen] = useState(false);
const [animation, setAnimation] = useState({ enabled: true, entrance: 'deck', exit: 'deck', speed: 1.0, stagger: 50 });
```

### 4.2 Update onShowRing to receive macros and animation

```javascript
window.ring.onShowRing(({ actions, activeApp, rolProfiles: rp, animation: anim, macros: m }) => {
  // ... existing code ...
  setMacros(m || []);
  if (anim) setAnimation(anim);
  setMacroOpen(false);
  setClosing(false);
});
```

### 4.3 Exit animation logic

When closing, set `closing=true`, wait for animation duration, then actually hide:

```javascript
const close = () => {
  if (!animation.enabled || animation.exit === 'none') {
    setVisible(false); window.ring.close(); return;
  }
  setClosing(true);
  const totalDuration = (actions.length * animation.stagger + 300) / animation.speed;
  setTimeout(() => { setVisible(false); setClosing(false); window.ring.close(); }, totalDuration);
};
```

### 4.4 getBubbleStyle function (dynamic animation per bubble)

```javascript
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
```

### 4.5 Macro bubble (add after Rol bubble)

```jsx
{hasMacros && (
  <button className="bubble bubble-macro"
    onClick={() => { setMacroOpen(v => !v); setRolOpen(false); }}
    style={getBubbleStyle(macroIndex, ...)}>
    <Icon name="Play" />
    <span className="bubble-label">Macro</span>
  </button>
)}

{hasMacros && macros.map((macro, i) => {
  const gap = 0.26; // radians, compact spacing
  const totalSpread = (count - 1) * gap;
  const angle = macroAngle - totalSpread / 2 + i * gap;
  return (
    <button className="bubble sub-bubble"
      onClick={() => execMacro(macro)}
      style={{ left: ..., top: ..., ...(macroOpen ? visibleStyle : hiddenStyle) }}>
      <Icon name={macro.icon || 'Play'} />
      <span className="bubble-label">{macro.label}</span>
    </button>
  );
})}
```

### 4.6 Pinned indicator on bubbles

```jsx
<button className={`bubble ${isPinned ? 'bubble-pinned' : ''}`}>
  ...
  {isPinned && <span className="pin-dot" />}
</button>
```

### 4.7 Slot calculation update

```javascript
const extraSlots = (hasRol ? 1 : 0) + (hasMacros ? 1 : 0);
const totalSlots = actions.length + extraSlots;
```

### 4.8 Compact sub-bubble spacing for Rol (same as Macro)

```javascript
const gap = 0.26; // fixed radians between sub-bubbles
const totalSpread = (count - 1) * gap;
const angle = parentAngle - totalSpread / 2 + i * gap;
```

---

## 5. Renderer CSS Changes (`src/renderer/index.html`)

### 5.1 New keyframes

```css
@keyframes deckIn {
  0% { transform: translate(calc(350px - 100%), calc(350px - 100%)) scale(0.3) rotate(-15deg); opacity: 0; }
  30% { opacity: 1; }
  100% { transform: translate(0, 0) scale(1) rotate(0deg); opacity: 1; }
}
@keyframes deckOut {
  0% { transform: translate(0, 0) scale(1) rotate(0deg); opacity: 1; }
  70% { opacity: 1; }
  100% { transform: translate(calc(350px - 100%), calc(350px - 100%)) scale(0.3) rotate(15deg); opacity: 0; }
}
@keyframes popOut {
  0% { transform: scale(1); opacity: 1; }
  100% { transform: scale(0); opacity: 0; }
}
@keyframes fadeOut {
  from { opacity: 1; } to { opacity: 0; }
}
@keyframes pinPulse {
  0%, 100% { box-shadow: 0 4px 16px rgba(15,23,42,0.25), 0 0 0 0 rgba(56,189,248,0.4); }
  50% { box-shadow: 0 4px 16px rgba(15,23,42,0.25), 0 0 0 8px rgba(56,189,248,0); }
}
@keyframes bubblePop {
  0% { transform: scale(0); opacity: 0; }
  50% { transform: scale(1.18); opacity: 1; }
  75% { transform: scale(0.92); }
  100% { transform: scale(1); }
}
```

### 5.2 Hover glow (all bubbles)

```css
.bubble:hover, .bubble-hover {
  transform: scale(1.2) !important;
  box-shadow: 0 8px 28px rgba(15,23,42,0.35), 0 0 20px rgba(56,189,248,0.3) !important;
  border: 1px solid rgba(56,189,248,0.3);
}
.bubble:active { transform: scale(0.85) !important; transition-duration: 0.1s; }
```

### 5.3 Pinned indicator

```css
.bubble-pinned { border: 1.5px solid rgba(56,189,248,0.5); }
.bubble-pinned:not([style*="Out"]) { animation: pinPulse 2.5s ease-in-out 1.5s infinite !important; }
.pin-dot {
  position: absolute; top: 3px; right: 3px;
  width: 7px; height: 7px; border-radius: 50%;
  background: #38bdf8; box-shadow: 0 0 4px rgba(56,189,248,0.6);
}
```

### 5.4 Macro bubble accent

```css
.bubble-macro { border: 1.5px solid rgba(168,85,247,0.4); color: #a855f7; }
.bubble-macro:hover { box-shadow: 0 8px 28px rgba(15,23,42,0.35), 0 0 20px rgba(168,85,247,0.3) !important; }
```

### 5.5 Center button (larger)

```css
.center-btn {
  left: calc(50% - 50px); top: calc(50% - 50px);
  width: 100px; height: 100px;
}
```

### 5.6 Label overflow fix

```css
.bubble-label {
  font-size: 8px;
  max-width: 64px;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

### 5.7 Ring radius

In `index.jsx`:
```javascript
const RADIUS = 140;      // was 120
const OUTER_RADIUS = 215; // was 195
const SUB_RADIUS = 280;   // was 260
```

---

## 6. Settings Changes (`src/settings/index.jsx`)

### 6.1 New components to add

- **`MacroEditor`** — step editor for macro action type (keys + delay per step)
- **`MacrosSection`** — list of macros + real-time recorder (🔴 Record / ⏹ Stop / Save)
- **`AnimationSection`** — dropdowns for entrance/exit type, sliders for speed/stagger, toggle
- **`PinnedSection`** — checkbox list of all existing actions to pin/unpin

### 6.2 Macro Recorder logic (in MacrosSection)

```javascript
const [recording, setRecording] = useState(false);
const [recordedSteps, setRecordedSteps] = useState([]);
const lastKeyTime = useRef(Date.now());

// keydown handler while recording:
// - AltGr + printable char → type:char
// - Printable without Ctrl/Alt/Cmd → merge into type:text
// - Shortcuts → save as-is with real delay
```

### 6.3 KeyRecorder fix (for macOS keep existing, but ensure Win key maps correctly on Windows)

The macOS version should keep `Command` mapping. No changes needed for macOS KeyRecorder.

### 6.4 Add `macro` to action type dropdown

```jsx
<option value="macro">Macro</option>
```

When type is `macro`, show `<MacroEditor>` instead of text input.

### 6.5 Sidebar additions

```jsx
<div className="sidebar-item" onClick={() => setSelectedProfile('__macros')}>
  🎹 Macros
</div>
```

---

## 7. Settings CSS (`src/settings/index.html`)

Add styles for:
- `.macro-recorder`, `.btn-record`, `.btn-stop`, `.recording-active`, `.recording-dot`
- `.recorded-preview`, `.step-tag`
- `.macro-editor`, `.macro-step`, `.macro-input`, `.macro-delay`, `.macro-remove`
- `.pinned-picker`, `.pinned-active`, `.pin-check`, `.row-profile-tag`
- `@keyframes blink` for recording indicator

---

## 8. macOS-Specific Notes

- **sendKeys**: Keep using `osascript` for shortcuts (already works)
- **typeText**: Use `osascript -e 'tell application "System Events" to keystroke "text"'`
- **No koffi needed**: macOS version doesn't need Win32 API
- **Hotkey**: Keep `Cmd+Shift+Space` (works fine on macOS)
- **AltGr**: Not applicable on macOS (Option key works differently)

---

## Reference

Full working implementation: `windows/` folder in this repo.
