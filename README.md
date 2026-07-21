# Actions Ring

Floating radial action menu for macOS & Windows. Context-aware shortcuts, app profiles, macro recorder, snippets, workflows, clipboard history, and cross-app controls via a customizable bubble ring overlay. Activate with a hotkey, execute actions instantly.

![Actions Ring](ring.png)

## Platforms

| Platform | Folder | Hotkey | Status |
|----------|--------|--------|--------|
| macOS (Apple Silicon) | `/` (root) | `Cmd+Shift+Space` | v0.1.0 |
| Windows (Portable) | `/windows` | `Ctrl+Alt+Space` | v0.4.0 |

## Download

**Windows:** [Download portable .exe from Releases](https://github.com/nicolasnietoarg/ActionsRing_4all/releases/latest)

**macOS:** Download `.dmg` from [Releases](https://github.com/nicolasnietoarg/ActionsRing_4all/releases/tag/v0.1.0)

## Run from Source

### Requirements
- Node.js 20+ ([download](https://nodejs.org))

### Windows
```bash
cd windows
npm install
npm run dev
```
Or double-click `windows/run.bat`.

### macOS
```bash
npm install
npm run dev
```

## Features

### Core
- **Context-aware profiles** — detects active app, shows relevant actions
- **Rol system** — access other app profiles without switching context
- **Clipboard history** — last 20 items, click to paste
- **Window management** — snap left/right/maximize
- **Settings UI** — drag & drop reorder, key recorder, Lucide icons throughout, dark theme

### Macros (Windows v0.4.0+)
- **Macro recorder** — record keystrokes in real-time with actual delays
- **Smart text detection** — consecutive characters merged into `type:` steps
- **Macro bubble** — dedicated ring bubble with expandable fan of saved macros
- **AltGr support** — special characters (`@`, `#`, etc.) captured correctly

### Pinned Actions (Windows v0.4.0+)
- Actions that persist across all app profiles
- Select from existing actions in Settings
- Visual indicator (cyan border + blue dot)

### Configurable Animations (Windows v0.4.0+)
- **Entrance/Exit types:** deck (cards from center), pop (bounce), fade, none
- **Speed:** 0.3x to 3x multiplier
- **Stagger:** 10ms to 150ms between bubbles
- **Toggle:** enable/disable all animations

### Action Types

| Type | Description | Example |
|------|-------------|---------|
| `shortcut` | Send keystrokes | `Control+Shift+P` / `Command+Shift+P` |
| `open` | Launch app | `Google Chrome` / `notepad` |
| `command` | Shell command | `start https://google.com` |
| `snippet` | Paste text | `Hello {clipboard}` |
| `macro` | Keystroke sequence | `[{"keys":"Control+A","delay":50}]` |
| `workflow` | Chain actions | `[{"type":"open","value":"chrome"}]` |
| `profile` | Navigate to profile | `Spotify` |

### Dynamic Variables
- `{clipboard}` — current clipboard content
- `{date}` — current date
- `{time}` — current time
- `{datetime}` — ISO timestamp
- `{app}` — active app when ring was opened

## Stack

| Component | macOS | Windows |
|-----------|-------|---------|
| Runtime | Electron 31 | Electron 31 |
| UI | React 18 | React 18 |
| Bundler | esbuild | esbuild |
| Icons | Lucide React | Lucide React |
| Keystrokes | osascript (System Events) | Win32 SendInput (koffi FFI) |
| App detection | NSWorkspace | GetForegroundWindow + GetModuleBaseNameW |
| Packaging | electron-builder (.dmg) | electron-builder (portable .exe) |

## Structure

```
ActionsRing_4all/
├── config/default.json          # macOS config
├── src/                         # macOS source
│   ├── main/main.js
│   ├── renderer/
│   └── settings/
├── windows/                     # Windows source (independent)
│   ├── config/default.json
│   ├── src/main/main.js         # Win32 API via koffi
│   ├── src/renderer/
│   ├── src/settings/
│   ├── CHANGES.md
│   └── README.md
├── BACKPORT_TO_MACOS.md         # Guide to port Windows features to macOS
└── .github/workflows/           # CI: builds portable .exe on tag push
```

## Building

### Portable .exe (automatic)

The portable exe is built automatically by GitHub Actions when you push a tag:

```bash
git tag v0.4.1
git push origin v0.4.1
```

The `.exe` appears in [Releases](https://github.com/nicolasnietoarg/ActionsRing_4all/releases) within ~3 minutes.

### Build locally

```bash
cd windows
npm run dist        # portable .exe
npm run dist:nsis   # installer .exe (NSIS)
```

### MSI installer (planned)

MSI packaging for enterprise deployment (Intune/GPO/SCCM) is planned. Requires:
- WiX Toolset 3.x on the build machine
- Moving writable config from `process.execPath` to `%APPDATA%` (already identified)
- Code signing certificate (recommended to avoid SmartScreen warnings)

See roadmap below.

## Security

### Config file

The `config/default.json` file is **user-specific** and may contain personal macros. Never commit macros that contain passwords, credentials, or sensitive text.

Best practice: keep `config/default.json` for the clean defaults you ship, and use `electron-store` or `%APPDATA%` for the user's customized config at runtime.

### Command injection

Action type `command` interpolates `{clipboard}` into shell commands. Be aware that clipboard content is untrusted input. Use `shell.openExternal()` for URLs when possible.

## macOS Permissions

**System Settings → Privacy & Security → Accessibility:**
- Add `Electron.app` (dev) or `Actions Ring.app` (production)

Required for `shortcut` type actions. `command` and `open` work without permissions.

## Roadmap

| Feature | Status | Notes |
|---------|--------|-------|
| MSI installer | 🔜 Planned | Enterprise deployment via WiX |
| Config in `%APPDATA%` | 🔜 Planned | Required for MSI, also improves portable |
| Unified codebase (macOS/Windows) | 🔜 Planned | Shared renderer + platform adapters |
| Auto-update (electron-updater) | 💡 Future | |
| Command injection hardening | 💡 Future | Escape clipboard variables |

## Contributing

See `BACKPORT_TO_MACOS.md` for porting Windows v0.4.0 features to macOS.

## License

MIT
