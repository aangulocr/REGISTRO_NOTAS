@echo off
title Sincronizar Base de Datos en la Nube (Supabase)
color 0A

echo ======================================================================
echo          MIGRACION Y RESPALDO: Supabase (Nube) a SQLite (Local)
echo ======================================================================
echo.
echo ADVERTENCIA: 
echo Esto borrara su base de datos local y la reemplazara exactamente 
echo con los registros que se encuentren en la nube (Supabase).
echo.
echo Presione cualquier tecla para aceptar e iniciar la sincronizacion...
pause >nul
echo.

:: Navegar a la raiz del proyecto donde esta instalado Electron y npm
cd /d "%~dp0.."

:: Forzar a Electron a comportarse como Node.js estandar pero con su motor local
set ELECTRON_RUN_AS_NODE=1

:: Ejecutar el script usando NPX
call npx electron "%~dp0migrar_supabase.js"

echo.
echo ======================================================================
echo El proceso ha terminado. Presione cualquier tecla para cerrar.
echo ======================================================================
pause >nul
