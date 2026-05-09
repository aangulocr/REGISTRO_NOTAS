@echo off
title Registro de Notas MEP 2026 - Iniciando...
color 0A
cd /d "%~dp0"

echo.
echo  =====================================================
echo    Registro de Notas MEP 2026 - Sistema Docente
echo  =====================================================
echo.

:: Verificar que node_modules exista
if not exist "node_modules\" (
    echo  [!] Dependencias no instaladas. Ejecutando npm install...
    echo.
    npm install
    if errorlevel 1 (
        echo.
        echo  [ERROR] Fallo la instalacion de dependencias.
        pause
        exit /b 1
    )
)

echo  [1/2] Iniciando servidor Vite (React)...
start "Vite Dev Server" /min cmd /c "npm run dev"

:: Esperar que Vite levante en el puerto 5173
echo  [*] Esperando que Vite este listo en puerto 5173...
:WAIT_VITE
timeout /t 2 /nobreak >nul
powershell -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:5173' -UseBasicParsing -TimeoutSec 2; exit 0 } catch { exit 1 }" >nul 2>&1
if errorlevel 1 goto WAIT_VITE

echo  [OK] Vite listo!
echo.
echo  [2/2] Iniciando Electron...
echo.

:: Lanzar Electron en modo desarrollo
set NODE_ENV=development
npx electron .

:: Al cerrar Electron, matar el proceso Vite
echo.
echo  [*] Cerrando servidor Vite...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":5173"') do (
    taskkill /PID %%p /F >nul 2>&1
)

echo  [OK] App cerrada correctamente.
timeout /t 2 /nobreak >nul
