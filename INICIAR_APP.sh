#!/bin/bash

# Registro de Notas MEP 2026 - Script de Inicio para Linux Mint
echo ""
echo " ====================================================="
echo "   Registro de Notas MEP 2026 - Sistema Docente"
echo " ====================================================="
echo ""

# Navegar a la carpeta del script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Verificar que node_modules exista
if [ ! -d "node_modules" ]; then
    echo " [!] Dependencias no instaladas. Ejecutando npm install..."
    echo ""
    npm install
    if [ $? -ne 0 ]; then
        echo ""
        echo " [ERROR] Falló la instalación de dependencias."
        read -p "Presione [Enter] para salir..."
        exit 1
    fi
fi

echo " [1/2] Iniciando servidor Vite (React)..."
npm run dev &
VITE_PID=$!

# Esperar que Vite levante en el puerto 5173
echo " [*] Esperando que Vite esté listo en puerto 5173..."
while ! curl -s http://localhost:5173 > /dev/null; do
    sleep 2
done

echo " [OK] Vite listo!"
echo ""
echo " [2/2] Iniciando Electron..."
echo ""

# Lanzar Electron en modo desarrollo
export NODE_ENV=development
npx electron .

# Al cerrar Electron, matar el proceso Vite
echo ""
echo " [*] Cerrando servidor Vite..."
kill $VITE_PID 2>/dev/null

echo " [OK] App cerrada correctamente."
sleep 2
