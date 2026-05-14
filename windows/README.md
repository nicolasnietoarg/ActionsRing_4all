# Actions Ring - Windows Portable

Menú radial flotante que se ejecuta desde la línea de comandos sin necesidad de instalar nada en el sistema.

## Requisitos

- **Node.js 18+** — [descargar](https://nodejs.org) (versión LTS)
- Eso es todo. No requiere permisos de administrador.

## Ejecución rápida

```
run.bat
```

O manualmente:

```
npm install
npm run dev
```

## Uso

- **Ctrl+Shift+Space** — abre el ring
- **Click en un globo** — ejecuta la acción
- **Escape** — cierra el ring
- **Click derecho en tray** → Settings — configurar acciones
- **Click derecho en tray** → Quit — cerrar

## Configuración

Editar `config/default.json` o usar la UI de Settings.

### Perfiles

Los perfiles se detectan por nombre de proceso de Windows:
- `chrome` — Google Chrome
- `msedge` — Microsoft Edge
- `Code` — VS Code
- `explorer` — File Explorer
- `OUTLOOK` — Outlook
- `notepad` — Notepad
- `Spotify` — Spotify

Para ver el nombre de proceso de una app, abrir Task Manager → Details → columna "Name".

### Tipos de acción

| Tipo | Descripción | Ejemplo |
|------|-------------|---------|
| shortcut | Envía teclas | `Control+Shift+P` |
| open | Abre programa | `notepad` |
| command | Ejecuta cmd | `start https://google.com` |
| snippet | Pega texto | `Hola {clipboard}` |
| workflow | Cadena de acciones | `[{"type":"open","value":"chrome"}]` |

### Variables en commands/snippets

- `{clipboard}` — contenido del portapapeles
- `{date}` — fecha actual
- `{time}` — hora actual
- `{app}` — app activa

### Window management

Usar tipo `command` con:
- `window:left` — ventana a la izquierda
- `window:right` — ventana a la derecha
- `window:maximize` — maximizar

## Estructura

```
windows/
├── run.bat              ← Doble click para ejecutar
├── package.json
├── config/default.json  ← Configuración
├── src/
│   ├── main/main.js     ← Proceso principal (PowerShell SendKeys)
│   ├── main/preload.js
│   ├── renderer/        ← UI del ring
│   └── settings/        ← UI de configuración
└── dist/                ← Se genera al compilar
```

## Notas

- No requiere permisos de administrador
- No instala nada en el sistema (todo queda en esta carpeta)
- Se puede copiar a un USB y ejecutar en cualquier PC con Node.js
- Los shortcuts se envían via PowerShell + .NET SendKeys
- Si un shortcut no funciona, puede ser que la app destino no acepte SendKeys (algunas apps de seguridad lo bloquean)
