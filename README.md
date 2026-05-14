# Actions Ring

Menú radial flotante para macOS que muestra acciones contextuales según la app activa. Se activa con un hotkey global y permite ejecutar shortcuts, abrir apps, correr comandos, pegar snippets y encadenar workflows.

## Stack

- **Electron 31** — ventana transparente overlay + tray icon
- **React 18** — renderer del ring y settings
- **esbuild** — bundler (build en <100ms)
- **Lucide React** — iconos SVG minimalistas (tree-shaked)
- **osascript** — envío de keystrokes via System Events
- **electron-builder** — empaquetado como .app/.dmg

## Estructura

```
actions-ring/
├── config/default.json      # Configuración: hotkey, perfiles, acciones, rolProfiles
├── src/
│   ├── main/
│   │   ├── main.js          # Main process: overlay, tray, IPC, executeAction
│   │   └── preload.js       # Context bridge: ring + settings APIs
│   ├── renderer/
│   │   ├── index.html       # Ring UI styles (navy bubbles, cyan icons, floating labels)
│   │   └── index.jsx        # Ring component con Rol system
│   ├── settings/
│   │   ├── index.html       # Settings styles (macOS native, dark mode support)
│   │   └── index.jsx        # Settings UI: perfiles, acciones, clipboard history
│   └── native/
│       └── sendkeys.swift   # (No usado actualmente) CGEvent key sender
├── bin/sendkeys             # Binario compilado de sendkeys.swift (no usado)
├── dist/
│   ├── renderer.js          # Bundle del ring (~308KB)
│   └── settings.js          # Bundle de settings (~315KB)
├── ring.png                 # Icono de la app
├── tray-icon.png            # Icono del tray (44px)
└── package.json             # Scripts + electron-builder config
```

## Scripts

```bash
npm run dev      # Build + ejecutar en desarrollo
npm run build    # Solo build de renderer + settings
npm run pack     # Build + empaquetar como .app (en dist/mac/)
npm run dist     # Build + generar .dmg instalable
```

## Cómo funciona

### Ring (overlay)
1. Hotkey (`Cmd+Shift+Space`) → detecta app activa → muestra ring centrado en cursor
2. Bubbles en círculo con acciones del perfil activo
3. Bubble "Rol" → click abre perfiles configurados → click en perfil muestra sus acciones
4. Click en acción → oculta ring → activa app destino → ejecuta acción
5. Escape o hotkey de nuevo → cierra

### Tipos de acción
| Tipo | Descripción | Ejemplo de value |
|------|-------------|-----------------|
| `shortcut` | Envía keystroke via osascript | `Command+Shift+P` |
| `open` | Abre una app | `Google Chrome` |
| `command` | Ejecuta shell command | `screencapture -ic` |
| `snippet` | Copia texto y pega | `Saludos,\n{clipboard}` |
| `workflow` | Encadena acciones (JSON array) | `[{"type":"open","value":"Chrome"}]` |
| `profile` | Navega a otro perfil en el ring | `Spotify` |

### Variables dinámicas (en command y snippet)
- `{clipboard}` — contenido actual del clipboard
- `{date}` — fecha actual
- `{time}` — hora actual
- `{datetime}` — ISO timestamp
- `{app}` — app activa cuando se abrió el ring

### Window management
Usar tipo `command` con valores especiales:
- `window:left` — ventana a mitad izquierda
- `window:right` — ventana a mitad derecha
- `window:maximize` — maximizar

### Rol system
`config.rolProfiles` es un array de nombres de perfiles que aparecen como sub-menú en el bubble "Rol". Permite acceder a acciones de otras apps sin cambiar de contexto.

## Settings UI
- **Sidebar**: perfiles + herramientas (clipboard history)
- **Acciones**: tabla con drag & drop para reordenar
- **Edición**: click en acción → panel de edición con key recorder para shortcuts
- **Agregar perfil**: dropdown con apps abiertas actualmente
- **Tema**: auto dark/light según sistema

## Permisos requeridos (macOS)
**System Settings → Privacy & Security → Accessibility:**
- Agregar `Electron.app` desde `node_modules/electron/dist/`
- (En producción, agregar `Actions Ring.app`)

Sin este permiso, los shortcuts tipo `shortcut` no funcionan. Los tipos `command` y `open` sí funcionan sin permisos.

## Problemas conocidos

### Repaint en ventanas transparentes
Electron con `transparent: true` tiene un bug donde el compositor de Chromium no repinta áreas transparentes al quitar elementos del DOM. Esto afecta al sistema de Rol: los sub-bubbles no desaparecen visualmente aunque React los quite del DOM.

**Workaround actual**: se usa `display: none` via inline style en vez de conditional rendering. Funciona parcialmente.

**Solución definitiva**: cambiar a ventana no-transparente con fondo semi-opaco, o usar `will-change: transform` en los elementos.

### Timing de keystrokes
Después de ocultar el overlay, se espera 200ms antes de enviar el keystroke para que la app destino recupere el foco. Si un shortcut no funciona, puede necesitar más delay.

### Bundle size
Con tree-shaking de Lucide: ~308KB. Sin tree-shaking: ~1.4MB. Si se agregan nuevos iconos al config, hay que importarlos explícitamente en `renderer/index.jsx` y `settings/index.jsx`.

## Próximos pasos posibles
- [ ] Fix definitivo del repaint para Rol (probar `will-change` o ventana no-transparente)
- [ ] Animación de cierre de bubbles
- [ ] Auto-update (electron-updater)
- [ ] Quick notes (input flotante)
- [ ] Hotkey por perfil
- [ ] Búsqueda de iconos en Settings (picker de Lucide)
- [ ] Export/import de configuración
- [ ] Sync de config via iCloud
