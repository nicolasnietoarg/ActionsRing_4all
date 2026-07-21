# Actions Ring - Windows Portable

Floating radial action menu that runs from the command line. No installation required.

## Requirements

- **Node.js 20+** — [download](https://nodejs.org) (LTS version)
- No admin permissions needed.

## Quick Start

```
run.bat
```

Or manually:

```
npm install
npm run dev
```

## Download Pre-built

Download the portable `.exe` from [Releases](https://github.com/nicolasnietoarg/ActionsRing_4all/releases/latest) — no Node.js required, just double-click.

## Usage

- **Ctrl+Alt+Space** — open the ring
- **Click a bubble** — execute the action
- **Escape** — close the ring
- **Right-click tray** → Settings — configure actions
- **Right-click tray** → Quit — exit

## Features

### Context-Aware Profiles

The ring detects the active app and shows relevant actions. Profiles are matched by Windows process name:

- `chrome` — Google Chrome
- `msedge` — Microsoft Edge
- `Code` — VS Code
- `explorer` — File Explorer
- `OUTLOOK` — Outlook
- `notepad` — Notepad
- `Spotify` — Spotify

To find an app's process name: Task Manager → Details → "Name" column.

### Pinned Actions

Actions that always appear regardless of active app. Configure in Settings by selecting from existing actions.

### Macro Recorder

Record keystroke sequences and replay them from the ring:

1. Settings → Macros → Click Record
2. Type your sequence (shortcuts + text)
3. Stop → Name it → Save
4. Access from the purple "Macro" bubble in the ring

Smart recording merges consecutive characters (e.g. typing `hello world` becomes a single `type:hello world` step).

⚠️ **Security:** Never record macros containing passwords or credentials. They are stored in plaintext in `config/default.json`.

### Configurable Animations

Ring open/close animations with options:
- **Types**: deck (cards from center), pop (bounce), fade, none
- **Speed**: 0.3x to 3x
- **Stagger**: 10ms to 150ms between bubbles
- **Toggle**: enable/disable all animations

### Action Types

| Type | Description | Example |
|------|-------------|---------|
| `shortcut` | Send keystrokes | `Control+Shift+P` |
| `open` | Launch a program | `notepad` |
| `command` | Run shell command | `start https://google.com` |
| `snippet` | Paste text | `Hello {clipboard}` |
| `macro` | Keystroke sequence | `[{"keys":"Control+A","delay":50}]` |
| `workflow` | Chain actions | `[{"type":"open","value":"chrome"}]` |

### Dynamic Variables (in commands/snippets/macros)

- `{clipboard}` — current clipboard content
- `{date}` — current date
- `{time}` — current time
- `{app}` — active app when ring was opened

### Window Management

Use type `command` with:
- `window:left` — snap window left
- `window:right` — snap window right
- `window:maximize` — maximize window

## Building

```bash
npm run dist        # portable .exe
npm run dist:nsis   # installer .exe (NSIS)
```

The CI automatically builds and publishes to GitHub Releases on every tag push (`v*`).

## Structure

```
windows/
├── run.bat              ← Double-click to run
├── package.json
├── config/default.json  ← Default configuration (shipped clean)
├── src/
│   ├── main/main.js     ← Main process (Win32 API via koffi)
│   ├── main/preload.js  ← Context bridge
│   ├── renderer/        ← Ring UI (React + Lucide icons)
│   └── settings/        ← Settings UI (React + Lucide icons)
├── dist/                ← Generated on build
└── CHANGES.md           ← Changelog
```

## Technical Notes

- Portable: nothing installed on the system, can run from USB
- No admin permissions required
- Keystrokes sent via Win32 `SendInput` (native, reliable)
- Active app detection via `GetForegroundWindow` + `GetModuleBaseNameW` (~0ms)
- No PowerShell dependency — all native via `koffi` FFI
- All UI icons use Lucide React SVG (no emoji dependencies)
- Settings UI has aria-labels on icon-only buttons for accessibility
- Dependency: `koffi` (prebuilt binaries, no build tools needed)
