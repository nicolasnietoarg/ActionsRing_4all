@echo off
title Actions Ring
echo ========================================
echo   Actions Ring - Portable Launcher
echo ========================================
echo.

:: Check if node_modules exists
if not exist "node_modules" (
    echo [*] Primera ejecucion - instalando dependencias...
    echo [*] Esto puede tardar unos minutos...
    npm install
    if errorlevel 1 (
        echo [!] Error instalando dependencias.
        echo [!] Asegurate de tener Node.js instalado: https://nodejs.org
        pause
        exit /b 1
    )
    echo.
)

:: Build
echo [*] Compilando...
call npm run build
if errorlevel 1 (
    echo [!] Error en la compilacion.
    pause
    exit /b 1
)

:: Run
echo [*] Iniciando Actions Ring...
echo [*] Hotkey: Ctrl+Shift+Space
echo [*] Cerrar: Escape o click derecho en tray ^> Quit
echo.
npx electron .
