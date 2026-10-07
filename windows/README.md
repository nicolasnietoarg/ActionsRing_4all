# Actions Ring — Windows

Menú radial flotante de acciones. Se abre con un hotkey global, muestra acciones según la app que tengas al frente y las ejecuta al instante.

## Instalación

| Opción | Archivo | Notas |
|--------|---------|-------|
| **Instalador** | `ActionsRing-Setup-<version>.exe` | Recomendado. Permite elegir carpeta, crea accesos directos y se instala solo para tu usuario (no pide permisos de administrador). |
| **Portable** | `ActionsRing-Portable-<version>.exe` | Sin instalar, se puede llevar en un USB. |

Descarga en [Releases](https://github.com/nicolasnietoarg/ActionsRing_4all/releases/latest). No hace falta Node.js para usar los `.exe`.

> Windows SmartScreen va a avisar que el editor es desconocido porque el ejecutable no está firmado. **Más información → Ejecutar de todas formas.**

## Uso

| Acción | Cómo |
|--------|------|
| Abrir el anillo | `Ctrl+Alt+Space` (configurable), o click en el ícono del tray |
| Ejecutar una acción | Click en la burbuja |
| Cerrar el anillo | `Escape`, click en el centro, click fuera de las burbujas, o pasar a otra ventana |
| Configurar | Click derecho en el tray → Settings |
| Salir | Click derecho en el tray → Salir |

## Configuración

Vive en:

```
%APPDATA%\Actions Ring\config.json
```

Se llega desde **tray → Abrir carpeta de configuración** o desde el botón del mismo nombre en Settings.

- Al actualizar la app, tu configuración se mantiene.
- Al desinstalar, **tampoco se borra**: si querés empezar de cero, borrá esa carpeta a mano.
- Si venías de una versión anterior (que guardaba el config junto al `.exe`), la primera ejecución lo migra sola.
- Si el archivo queda corrupto, se respalda como `config.json.bad-<timestamp>` y la app arranca con los defaults en lugar de no abrir.

El `config/default.json` del repositorio son **solo los defaults que se publican**. Tu configuración personal nunca se escribe ahí, así que no hay riesgo de commitearla.

## Funcionalidades

### Perfiles por aplicación

El anillo detecta la app al frente y muestra sus acciones. Los perfiles se identifican por el nombre del proceso de Windows, y el match **no distingue mayúsculas**:

`chrome`, `msedge`, `Code`, `explorer`, `OUTLOOK`, `notepad`, `Spotify`…

Para averiguar el nombre de un proceso: Administrador de tareas → Detalles → columna "Nombre". O usá **Settings → Agregar perfil**, que lista las apps abiertas.

### Acciones fijadas (pinned)

Aparecen en todos los perfiles. Se eligen en Settings de la lista de acciones existentes, y se guardan **por referencia**: si después renombrás o editás la acción original, la fijada acompaña el cambio.

Se distinguen con borde y punto cian.

### Rol

Burbuja que abre un abanico con los perfiles de otras apps. Al ejecutar una acción desde ahí, la app destino se trae al frente primero (y si no está abierta, se intenta lanzar).

### Grabador de macros

**Settings → Macros → Grabar macro**, tipeás la secuencia, **Parar**, le das un nombre y **Guardar**. Después se ejecuta desde la burbuja violeta "Macro".

- Los caracteres imprimibles seguidos se agrupan en un solo paso `type:`.
- Los atajos (`Ctrl+C`, `Alt+Tab`) se graban tal cual.
- Se conservan las pausas reales entre teclas.
- Si un paso usa una tecla que no se puede reproducir, Settings lo marca con un aviso en lugar de dejarlo fallar en silencio.

> ⚠️ Las macros se guardan en texto plano. Si grabás una contraseña, queda legible para cualquiera que tenga acceso a tu perfil de Windows.

### Animaciones

Configurables en Settings: tipo de entrada y salida (`deck`, `pop`, `fade`, `none`), velocidad (0.3x–3x), separación entre burbujas (10–150 ms) y un interruptor general.

### Tipos de acción

| Tipo | Qué hace | Ejemplo |
|------|----------|---------|
| `shortcut` | Envía teclas | `Control+Shift+P` |
| `open` | Abre una app, archivo, carpeta o URL | `notepad`, `C:\apps\x.exe`, `https://...` |
| `command` | Ejecuta un comando de shell | `wt -d .` |
| `snippet` | Pega texto (y restaura el portapapeles) | `Hola {clipboard}` |
| `macro` | Secuencia de teclas | `[{"keys":"Control+A","delay":50}]` |
| `workflow` | Encadena acciones | `[{"type":"open","value":"chrome"}]` |
| `profile` | Salta a otro perfil | `Spotify` |

Teclas soportadas en `shortcut` y en los pasos de macro: letras, números, `F1`–`F12`, navegación, `AltGr`, modificadores izquierdo/derecho y teclas multimedia (`MediaPlayPause`, `VolumeUp`…).

### Variables

Disponibles en `command`, `snippet` y en los pasos `type:` de una macro:

`{clipboard}`, `{date}`, `{time}`, `{datetime}`, `{app}`

Lo que se interpola se sanea según el destino: en una URL se codifica, y en un comando de shell se neutralizan los metacaracteres. Así un portapapeles con `& comando` no ejecuta nada que no quisieras.

### Gestión de ventanas

Acción de tipo `command` con:

- `window:left` — ancla la ventana a la izquierda
- `window:right` — a la derecha
- `window:maximize` — maximiza

## Desarrollo

Requiere **Node.js 20+**.

```bash
cd windows
npm install
npm run dev        # verifica, compila y levanta la app
```

O doble click en `run.bat`.

| Comando | Qué hace |
|---------|----------|
| `npm test` | Tests de la lógica del proceso principal (teclas, config, variables, macros) |
| `npm run check:main` | Chequeo de sintaxis del main y los preload |
| `npm run verify` | `check:main` + `test` + compilación de los bundles |
| `npm run build` | Solo compila los bundles de renderer y settings |
| `npm run dev` | `verify` + levanta Electron |
| `npm run dist` | Instalador NSIS + portable |
| `npm run dist:nsis` | Solo el instalador |
| `npm run dist:portable` | Solo el portable |

Los `.exe` quedan en `windows/dist/`. El CI los construye y publica en Releases con cada tag `v*`.

## Estructura

```
windows/
├── run.bat                      ← Launcher de desarrollo
├── package.json
├── config/default.json          ← Defaults que se publican (NO es tu config)
├── src/
│   ├── main/
│   │   ├── main.js              ← Proceso principal, Win32 vía koffi
│   │   ├── keys.js              ← Mapeo de teclas y structs INPUT (módulo puro)
│   │   ├── config-schema.js     ← Normalización de config y acciones fijadas (módulo puro)
│   │   ├── variables.js         ← Variables, saneo y planificación de comandos (módulo puro)
│   │   ├── preload-ring.js      ← Puente del anillo
│   │   └── preload-settings.js  ← Puente de Settings
│   ├── renderer/                ← UI del anillo (React + Lucide)
│   └── settings/                ← UI de Settings (React + Lucide)
├── test/run-tests.js            ← Tests (node puro, sin dependencias)
├── dist/                        ← Generado por el build
└── CHANGES.md
```

Los tres módulos del main marcados como "puros" no dependen de Electron ni de koffi: por eso se pueden testear con `node` directamente, sin levantar la app.

## Notas técnicas

- Teclas enviadas con `SendInput` de Win32 (nativo, sin PowerShell).
- App activa detectada con `GetForegroundWindow` + `GetModuleBaseNameW` (~0 ms).
- Dependencia nativa: `koffi` (binarios precompilados, no requiere toolchain).
- Instancia única: un segundo arranque abre Settings en lugar de competir por el hotkey.
- `Escape` se registra como atajo global **solo mientras el anillo está abierto**, para no secuestrarlo del resto del sistema.
- Si el hotkey configurado es inválido o lo tiene tomado otra app, se cae al default (`Ctrl+Alt+Space`) en lugar de quedarse sin ninguno.
- El historial de portapapeles vive solo en memoria (máx. 20 items) y se puede vaciar desde Settings.
