# Actions Ring

Menú radial flotante de acciones para macOS y Windows. Atajos según el contexto, perfiles por aplicación, grabador de macros, snippets, workflows, historial de portapapeles y controles entre apps, en un anillo de burbujas configurable. Se abre con un hotkey y ejecuta la acción al instante.

![Actions Ring](ring.png)

## Plataformas

| Plataforma | Carpeta | Hotkey por defecto | Versión |
|------------|---------|--------------------|---------|
| Windows | `/windows` | `Ctrl+Alt+Space` | v0.5.0 |
| macOS (Apple Silicon) | `/` (raíz) | `Cmd+Shift+Space` | v0.1.0 |

> El port de Windows va bastante más adelantado. macOS todavía no tiene las correcciones de v0.5.0 — ver `BACKPORT_TO_MACOS.md`.

## Descarga

**Windows** — [Releases](https://github.com/nicolasnietoarg/ActionsRing_4all/releases/latest):

| Archivo | Para qué |
|---------|----------|
| `ActionsRing-Setup-<version>.exe` | Instalador. Elegís carpeta, crea accesos directos, se instala solo para tu usuario (sin admin). |
| `ActionsRing-Portable-<version>.exe` | Portable, sin instalar. Sirve desde un USB. |

**macOS** — `.dmg` en [Releases](https://github.com/nicolasnietoarg/ActionsRing_4all/releases/tag/v0.1.0).

Ninguno de los dos está firmado: Windows SmartScreen y Gatekeeper van a pedir confirmación la primera vez.

## Correr desde el código

Requiere **Node.js 20+** ([descarga](https://nodejs.org)).

### Windows
```bash
cd windows
npm install
npm run dev
```
O doble click en `windows/run.bat`.

### macOS
```bash
npm install
npm run dev
```

## Funcionalidades

### Base
- **Perfiles por contexto** — detecta la app al frente y muestra sus acciones (match sin distinguir mayúsculas)
- **Rol** — acceso a los perfiles de otras apps sin cambiar de ventana
- **Historial de portapapeles** — últimos 20 items, click para volver a copiar
- **Gestión de ventanas** — anclar a izquierda/derecha, maximizar
- **Settings** — reordenar arrastrando, grabador de teclas, íconos Lucide, tema oscuro

### Macros (Windows v0.4.0+)
- **Grabador** — captura las teclas en tiempo real con sus pausas reales
- **Agrupado de texto** — los caracteres seguidos se juntan en un paso `type:`
- **Burbuja Macro** — abanico desplegable con las macros guardadas
- **AltGr y multimedia** — caracteres especiales y teclas de medios

### Acciones fijadas (Windows v0.4.0+)
- Visibles en todos los perfiles, se eligen de las acciones existentes
- Guardadas por referencia: editar la original actualiza la fijada
- Indicador visual (borde y punto cian)

### Animaciones configurables (Windows v0.4.0+)
- **Tipos** — `deck` (cartas desde el centro), `pop` (rebote), `fade`, `none`
- **Velocidad** — 0.3x a 3x · **Separación** — 10 a 150 ms · **Interruptor general**

### Tipos de acción

| Tipo | Qué hace | Ejemplo (Windows / macOS) |
|------|----------|---------------------------|
| `shortcut` | Envía teclas | `Control+Shift+P` / `Command+Shift+P` |
| `open` | Abre app, archivo, carpeta o URL | `notepad` / `Google Chrome` |
| `command` | Comando de shell | `wt -d .` / `screencapture -ic` |
| `snippet` | Pega texto | `Hola {clipboard}` |
| `macro` | Secuencia de teclas | `[{"keys":"Control+A","delay":50}]` |
| `workflow` | Encadena acciones | `[{"type":"open","value":"chrome"}]` |
| `profile` | Salta a otro perfil | `Spotify` |

### Variables
`{clipboard}` · `{date}` · `{time}` · `{datetime}` · `{app}`

En Windows lo interpolado se sanea según el destino: se codifica si va a una URL y se neutralizan los metacaracteres si va a un comando de shell.

## Stack

| Componente | macOS | Windows |
|------------|-------|---------|
| Runtime | Electron 31 | Electron 31 |
| UI | React 18 | React 18 |
| Bundler | esbuild | esbuild |
| Íconos | Lucide React | Lucide React |
| Teclas | osascript (System Events) | Win32 SendInput (koffi FFI) |
| Detección de app | NSWorkspace | GetForegroundWindow + GetModuleBaseNameW |
| Empaquetado | electron-builder (.dmg) | electron-builder (NSIS + portable) |

## Estructura

```
ActionsRing_4all/
├── config/default.json          # defaults macOS
├── src/                         # código macOS
│   ├── main/main.js
│   ├── renderer/
│   └── settings/
├── windows/                     # código Windows (independiente)
│   ├── config/default.json      # defaults que se publican
│   ├── src/main/
│   │   ├── main.js              # proceso principal, Win32 vía koffi
│   │   ├── keys.js              # mapeo de teclas (módulo puro)
│   │   ├── config-schema.js     # normalización de config (módulo puro)
│   │   ├── variables.js         # variables y saneo (módulo puro)
│   │   └── preload-*.js         # un puente por ventana
│   ├── src/renderer/            # UI del anillo
│   ├── src/settings/            # UI de Settings
│   ├── test/run-tests.js        # tests sin dependencias
│   ├── CHANGES.md
│   └── README.md
├── BACKPORT_TO_MACOS.md         # guía para portar las features de Windows
└── .github/workflows/           # CI: instalador + portable en cada tag
```

## Build

### Automático (recomendado)

El CI construye instalador y portable al pushear un tag:

```bash
git tag v0.5.1
git push origin v0.5.1
```

Los `.exe` aparecen en [Releases](https://github.com/nicolasnietoarg/ActionsRing_4all/releases) en ~3 minutos. También se puede disparar a mano desde la pestaña **Actions** (sin crear tag): deja los `.exe` como artefactos del run.

### Local (desde Windows)

```bash
cd windows
npm run dist           # instalador NSIS + portable
npm run dist:nsis      # solo el instalador
npm run dist:portable  # solo el portable
```

Salida en `windows/dist/`.

## Configuración

**Windows:** `%APPDATA%\Actions Ring\config.json`. Se mantiene al actualizar y al desinstalar. Si venís de una versión anterior, la primera ejecución migra el archivo que estaba junto al `.exe`. Si el JSON queda corrupto, se respalda y la app arranca con los defaults.

**macOS:** todavía `config/default.json` dentro de la app (pendiente de migrar).

El `config/default.json` del repositorio son **solo los defaults publicados**: la configuración personal nunca se escribe ahí, así que no hay riesgo de commitear macros propias.

> ⚠️ Las macros se guardan en texto plano. No grabes contraseñas ni credenciales en una macro: quedan legibles para cualquiera con acceso a tu perfil de usuario.

## Permisos en macOS

**Ajustes del sistema → Privacidad y seguridad → Accesibilidad:** agregar `Electron.app` (desarrollo) o `Actions Ring.app` (producción). Hace falta para las acciones de tipo `shortcut`; `command` y `open` funcionan sin permisos.

## Roadmap

| Feature | Estado | Notas |
|---------|--------|-------|
| Instalador Windows | ✅ Hecho | NSIS, por usuario, sin admin (v0.5.0) |
| Config en `%APPDATA%` | ✅ Hecho | Con migración automática (v0.5.0) |
| Tests | ✅ Hecho | 40 casos sobre la lógica del main (v0.5.0) |
| Backport de v0.5.0 a macOS | 🔜 Pendiente | Mismos bugs presentes en el código de macOS |
| Código unificado (macOS/Windows) | 🔜 Pendiente | Renderer compartido + adaptadores por plataforma |
| Firma de código | 💡 A futuro | Evita los avisos de SmartScreen |
| Auto-update (electron-updater) | 💡 A futuro | |
| MSI para despliegue corporativo | 💡 A futuro | Intune/GPO/SCCM, requiere WiX |

## Contribuir

Ver `BACKPORT_TO_MACOS.md` para portar las features de Windows a macOS.

Antes de un commit en `windows/`:

```bash
cd windows && npm run verify
```

## Licencia

MIT
