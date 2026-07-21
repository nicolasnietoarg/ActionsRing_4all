# Windows Port - Changelog

## v0.4.1 — 2026-07-17

### Security: Credential cleanup

Removed leaked credentials from config and documentation. Git history purged with `git filter-repo`.

**What was removed:**
- Macros containing hardcoded username/password from `config/default.json`
- Password examples from `CHANGES.md` and `README.md`
- All traces from git history (21 commits rewritten)

**Recommendation:** Never store credentials in macros. Use a password manager.

### Fixed: CI/CD pipeline now works

The GitHub Actions workflow `build-windows.yml` was failing on every tag push since the project was created. Two bugs fixed:

| Bug | Cause | Fix |
|-----|-------|-----|
| `npm ci` fails with "Missing: electron-builder" | Tag `v0.4.0` pointed to an old commit with a stale `package-lock.json` (102 packages, missing electron-builder tree) | Re-pointed tag to HEAD where lockfile has all 355 packages |
| `Upload release asset` 403 Forbidden | `GITHUB_TOKEN` lacked write permission | Added `permissions: contents: write` to the workflow |

The portable `.exe` is now automatically built and published to Releases on every tag push.

### Improved: Settings UI — emoji-free icons

Replaced all emoji glyphs in the Settings UI with proper Lucide React SVG icons for visual consistency and cross-platform rendering:

| Before (emoji) | After (Lucide) | Location |
|---|---|---|
| 🔴 | `<Circle>` (filled) | Record macro button |
| ● | `<Circle>` | Recording indicator |
| ⏹ | `<Square>` (filled) | Stop button |
| 📌 | `<Pin>` | Pinned section label + checkbox |
| 🎬 | `<Film>` | Animation section label |
| ⠿ | `<GripVertical>` | Drag handle |
| ＋ | `<Plus>` | Add buttons (profile, action, step) |
| × | `<X>` | Remove buttons (step, macro, rol tag) |
| ⭐ | `Star` | Default new action icon |

Also added:
- `aria-label` attributes on icon-only buttons (accessibility)
- CSS alignment classes for inline icon+text layout

---

## v0.4.0 — 2026-05-20

### New: Macro Bubble with Recorder

A dedicated "Macro" bubble in the ring (purple accent) that opens a fan of recorded macros. Click any macro to replay the keystroke sequence.

**Recording workflow (Settings → Macros):**
1. Click Record macro button
2. Type normally — keystrokes are captured in real-time with actual delays
3. Click Stop
4. Preview recorded steps → name it → Save
5. Macro appears in the ring under the Macro bubble

**Smart recording:**
- Printable characters (including `@`, `#`, special chars via AltGr) are merged into `type:` steps
- Consecutive characters typed quickly are merged into a single step (e.g. `type:hello world`)
- Shortcuts (Ctrl+C, Alt+Tab) are captured as-is
- Real delays between keystrokes are preserved

### New: Configurable Animations

Ring open/close animations are now fully configurable from Settings.

**Options:**
- **Type**: `deck` (cards from center), `pop` (bounce), `fade`, `none`
- **Speed**: 0.3x to 3x multiplier
- **Stagger**: 10ms to 150ms between each bubble
- **Enable/Disable**: toggle all animations off

### New: Pinned Actions

Actions that persist across all app profiles. Always visible in the ring regardless of active app.

- Configured from Settings (select from existing actions)
- Visual indicator: cyan border + blue dot
- Deduplicated against profile actions

### Improved: Bubble Animations

- Staggered entrance with configurable delay
- Bounce overshoot on pop
- Hover glow effect on all bubbles (not just pinned)
- Exit animations (reverse deck, pop out, fade out)

### Improved: Layout

- Larger center button (100px)
- Increased ring radius (140px) for better spacing
- Compact sub-bubble layout for Macro and Rol (fixed 55px gap)
- Labels: smaller font, max-width with ellipsis to prevent overlap

---

## v0.3.0 — 2026-05-19

### New: Macro Action Type

New action type `macro` for sequencing keystrokes with delays.

```json
{
  "label": "Signature",
  "type": "macro",
  "value": [
    { "keys": "Control+A", "delay": 50 },
    { "keys": "type:Best regards,\nNicolas", "delay": 0 }
  ]
}
```

- `keys`: shortcut combo (e.g. `Control+A`, `Tab`)
- `type:text`: types text character by character via Unicode SendInput
- `delay`: milliseconds to wait after each step
- Visual step editor in Settings UI

### New: Pinned Actions (config)

`config.pinnedActions` array — actions shown in every profile.

---

## v0.2.0 — 2026-05-18

### Breaking: Full rewrite of `main.js` for Windows

The original `main.js` was ported from macOS and relied on synchronous PowerShell calls that froze the Electron event loop.

| Issue | Cause | Fix |
|-------|-------|-----|
| App freezes on hotkey | `execSync('powershell ...')` blocks main process | Native Win32 API via `koffi` (~0ms) |
| SendKeys unreliable | PowerShell `.NET SendKeys` | `SendInput` (Win32 native) |
| Running apps list freezes | `execSync` with `Get-Process` | `EnumWindows` + `GetModuleBaseNameW` |
| Window focus not restored | PowerShell activation | `SetForegroundWindow` |

**Added dependency:** `koffi` v2.9.0 (lightweight FFI, prebuilt binaries, no build tools needed)

**Hotkey:** Changed to `Control+Alt+Space` (avoids Windows system conflicts)

### Key Recorder fix

- Fixed for Windows: detects `Win` key correctly (was mapped as `Command`)
- Tracks modifiers via Set instead of relying on `e.metaKey`
