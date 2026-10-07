@echo off
title Actions Ring
echo ========================================
echo   Actions Ring - Launcher de desarrollo
echo ========================================
echo.

:: Dependencias
if not exist "node_modules" (
    echo [*] Primera ejecucion - instalando dependencias...
    echo [*] Esto puede tardar unos minutos...
    npm install
    if errorlevel 1 (
        echo [!] Error instalando dependencias.
        echo [!] Asegurate de tener Node.js 20+ instalado: https://nodejs.org
        pause
        exit /b 1
    )
    echo.
)

:: Sintaxis + tests + bundles
echo [*] Verificando y compilando...
call npm run verify
if errorlevel 1 (
    echo [!] Fallo la verificacion. No se inicia la app.
    pause
    exit /b 1
)

echo.
echo [*] Iniciando Actions Ring...
echo [*] Hotkey por defecto: Ctrl+Alt+Space  (se cambia en Settings)
echo [*] Cerrar el anillo: Escape, click afuera, o click en el centro
echo [*] Salir de la app: click derecho en el icono del tray ^> Salir
echo [*] Config: %%APPDATA%%\Actions Ring\config.json
echo.
npx electron .
