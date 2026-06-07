#!/bin/bash

# Script de sincronización para Linux Mint / Ubuntu
# MIGRACIÓN Y RESPALDO: Supabase (Nube) a SQLite (Local)

echo "======================================================================"
echo "         MIGRACIÓN Y RESPALDO: Supabase (Nube) a SQLite (Local)"
echo "======================================================================"
echo ""
echo "ADVERTENCIA:"
echo "Esto borrará su base de datos local y la reemplazará exactamente"
echo "con los registros que se encuentren en la nube (Supabase)."
echo ""
read -p "Presione [Enter] para aceptar e iniciar la sincronización..."
echo ""

# Navegar a la raíz del proyecto (un nivel arriba de donde está este script)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/.."

# Ejecutar el script usando Node.js directamente (ya que migrar_supabase.js es un script de node)
# Si se requiere usar el electron bundle, se puede usar npx electron.
# Sin embargo, como es un script de migración de datos, node es suficiente si están las dependencias.

echo "Iniciando migración..."
node "$SCRIPT_DIR/migrar_supabase.js"

echo ""
echo "======================================================================"
echo "El proceso ha terminado. Presione [Enter] para cerrar."
echo "======================================================================"
read -p ""
