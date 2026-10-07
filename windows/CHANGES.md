# Windows Port - Changelog

## v0.5.0 — 2026-10-07

Corrección de bugs, limpieza de código e instalador. Sin pérdida de funcionalidad: todos los tipos de acción, perfiles, Rol, macros, pinned y animaciones siguen funcionando igual.

### Seguridad

| Tema | Antes | Ahora |
|------|-------|-------|
| **Credencial en el config publicado** | La macro `LAN` del `config/default.json` tipeaba una contraseña, partida en dos pasos `type:` (por eso se salvó de la limpieza de v0.4.1) | Se eliminó del config publicado. La configuración de cada usuario vive en `%APPDATA%` y nunca se commitea |
| **Inyección de comandos** | `{clipboard}` se interpolaba crudo en `exec(..., {shell:'cmd.exe'})`. Un portapapeles con `x & calc` ejecutaba comandos | Lo interpolado se sanea según el destino: se codifica para URL o se neutralizan los metacaracteres de `cmd.exe`. Las URLs se abren con `shell.openExternal`, sin shell |
| **`Escape` secuestrado a nivel SO** | Se registraba como atajo global permanente, así que Escape dejaba de funcionar en el resto de las aplicaciones mientras la app corría | Se registra solo mientras el anillo está abierto, y la ventana lo maneja localmente |
| **Privilegio del preload** | Un solo preload exponía la API de configuración también a la ventana del anillo | Preload separado por ventana (`preload-ring.js` / `preload-settings.js`) |
| **Historial de portapapeles** | No había forma de vaciarlo | Botón para vaciarlo en Settings → Clipboard |

### Bugs corregidos

| # | Problema | Causa |
|---|----------|-------|
| 1 | Un hotkey inválido dejaba la app **sin ningún hotkey hasta reiniciar** | `save-config` hacía `unregisterAll()` y después `register()` sin `try/catch`: el accelerator inválido tiraba excepción dentro del handler de IPC. Ahora se captura y se cae al default |
| 2 | Escribir en Settings reescribía el JSON completo y volvía a registrar el hotkey global **en cada tecla** | Faltaba debounce. Ahora el estado local se actualiza al instante y el disco se escribe agrupado (400 ms) |
| 3 | Un `config.json` corrupto dejaba la app **sin arrancar y sin forma de recuperarse** | `loadConfig` sin `try/catch` y antes de crear el tray. Ahora se respalda como `.bad-<timestamp>` y se arranca con los defaults |
| 4 | La versión portable **crasheaba en ubicaciones de solo lectura** (USB protegido, Program Files) | Escribía el config junto al `.exe`. Ahora va a `%APPDATA%\Actions Ring\config.json`, con migración automática |
| 5 | Dos instancias competían por el hotkey y por el archivo de config | No había `requestSingleInstanceLock()`. El segundo arranque ahora abre Settings |
| 6 | **AltGr no hacía nada** en una macro | `altgraph` no estaba en `VK_MAP`, así que el paso se ejecutaba como no-op en silencio. Se mapeó a `VK_RMENU` y se sumaron teclas multimedia y modificadores derechos |
| 7 | El grabador podía producir pasos que el reproductor no sabía ejecutar | Sin validación. Ahora Settings avisa qué paso tiene teclas no reproducibles |
| 8 | Las pausas de las macros grabadas quedaban **corridas un paso** | El grabador guardaba la pausa *previa* al paso y el reproductor la aplicaba *después*. Se unificó en "espera después del paso" |
| 9 | Un `delay: 0` explícito se convertía en 50 ms | `step.delay || 50`. Ahora el 0 se respeta |
| 10 | Una tecla sin mapeo presionaba los modificadores y perdía la tecla principal | `VK_MAP[k] \|\| 0` sin validar. Ahora el combo no se envía y se loguea |
| 11 | Un perfil sin acciones dejaba una **ventana invisible de 700×700 comiéndose los clicks** | El renderer devolvía `null` pero la ventana quedaba visible. Ahora muestra un aviso |
| 12 | Un click fuera de las burbujas no hacía nada; pasar a otra ventana dejaba el anillo colgado arriba de todo | Faltaban la capa de cierre y el handler de `blur` |
| 13 | El anillo quedaba **cortado** en los bordes de pantalla o en un monitor secundario | `setPosition` sin acotar. Ahora se limita al área de trabajo de la pantalla bajo el cursor |
| 14 | Abrir el anillo antes de que cargara el renderer mostraba una ventana en blanco | El mensaje IPC se perdía. Ahora se difiere hasta que el renderer avisa que está listo |
| 15 | Renombrar una acción dejaba su copia fijada **desactualizada** | `pinnedActions` guardaba copias completas. Ahora guarda ids; las configs viejas se migran y lo que no se pueda resolver se conserva inline |
| 16 | `Chrome` vs `chrome` caía al perfil default en silencio | El match era exacto. Ahora es case-insensitive |
| 17 | Un `snippet` **pisaba el portapapeles para siempre** | No se restauraba. Ahora se devuelve el contenido anterior y no se contamina el historial |
| 18 | Cerrar Settings durante una grabación dejaba el hotkey **desregistrado para siempre** | `start-recording` liberaba el hotkey y nadie lo volvía a registrar. Se maneja en el evento `closed` y en el `beforeunload` |
| 19 | Un emoji se escribía a medias | `typeText` iteraba caracteres y mandaba solo la mitad alta del par surrogate. Ahora recorre unidades de código UTF-16 |
| 20 | Un `\n` en un `type:` se mandaba como unicode 10 y muchas apps lo ignoraban | Ahora `\n` y `\t` se envían como teclas Enter y Tab reales |
| 21 | `dwExtraInfo` del struct `INPUT` se escribía en el offset 20 | Va en el 24 (x64). Era inocuo porque el buffer venía en cero, pero quedaba mal documentado |
| 22 | La animación de salida cortaba las últimas burbujas | La duración se calculaba solo con `actions.length`, ignorando las burbujas Rol y Macro |
| 23 | Una búsqueda con espacios rompía la query de la acción Google | `{clipboard}` no se codificaba para URL |

### Limpieza

- Eliminado código muerto: `makeKeyInput()`, el estado de grabación del main (`recordBuffer`, `recordLastTime`, `recording`) que nunca se llenaba y hacía que `stop-recording` devolviera siempre `[]`, los handlers IPC `save-macro` / `delete-macro` / `get-macros` que la UI no usaba, `get-theme` sin consumidores y un `require('child_process')` duplicado.
- La sección de Macros se renderizaba **dos veces** (en cada perfil y en Herramientas). Ahora solo en Herramientas → Macros.
- `main.js` se dividió: la lógica pura salió a `keys.js`, `config-schema.js` y `variables.js`, que no dependen de Electron ni de koffi.
- Estilos inline del renderer movidos a CSS.

### Nuevo

- **Instalador NSIS** (`ActionsRing-Setup-*.exe`): elección de carpeta, accesos directos, instalación por usuario sin pedir admin, y no borra la configuración al desinstalar. El portable se sigue publicando.
- **Suite de tests** (`npm test`): 40 casos sobre teclas, normalización de config, acciones fijadas, variables y timing de macros. Sin dependencias, corre con node puro.
- `npm run verify`: sintaxis + tests + compilación. Lo corre también `run.bat` antes de levantar la app.
- CI: corre los tests, publica instalador y portable, y permite ejecución manual desde la pestaña Actions.
- Tray: "Abrir anillo", "Abrir carpeta de configuración" y click simple para abrir el anillo.
- Hotkey configurable con grabador de teclas (antes era un campo de texto libre) y aviso si la combinación no es válida.
- Teclas nuevas soportadas: `AltGr`, modificadores derechos (`RControl`, `RShift`, `RAlt`), `CapsLock`, `NumLock`, `Pause`, y multimedia (`MediaPlayPause`, `MediaNextTrack`, `VolumeUp`, `VolumeDown`, `VolumeMute`).

### Cambios de comportamiento a tener en cuenta

- La configuración se movió a `%APPDATA%\Actions Ring\config.json`. La primera ejecución migra la que tenías junto al `.exe`.
- El hotkey de los defaults publicados es `Control+Alt+Space` (coincide con la documentación). Si ya tenías uno configurado, se respeta.
- El tipo de acción `profile` vuelve a mostrarse en el anillo: el renderer lo filtraba y nunca aparecía, aunque estaba documentado.

---

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
