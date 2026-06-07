# Sistema de Control de Asistencia y Notas - MEP 2026 (Versión de Escritorio SQLite3)

Este proyecto es una aplicación nativa de escritorio diseñada para automatizar la gestión administrativa de los docentes bajo la normativa MEP 2026. A diferencia de las versiones en la nube, esta versión es **100% Offline** y se conecta a una base de datos local SQLite3 para garantizar máxima velocidad, disponibilidad sin internet y privacidad total de los datos de los estudiantes.

## Ubicación de la Base de Datos Local
Todos los registros (estudiantes, notas, asistencia y usuarios) se guardan de forma permanente y automática en su propia computadora. 

### En Windows:
El archivo se ubica en: `C:\Users\[TuUsuario]\AppData\Roaming\asistencia-mep\asistencia.db`
*(Acceso rápido: `Win + R` -> `%APPDATA%\asistencia-mep`)*

### En Linux (Mint/Ubuntu):
El archivo se ubica en: `~/.local/share/asistencia-mep/asistencia.db`
*(Acceso rápido: Abrir carpeta personal -> `Ctrl + H` para ver archivos ocultos -> `.local/share/asistencia-mep`)*

---

## Ejecución e Instalación

### Para usuarios de Windows:
1. **Instalación Nativa**: Ejecute el instalador `.exe` ubicado en `out\make\squirrel.windows\x64\`.
2. **Inicio Rápido (Desarrollo)**: Ejecute el archivo `INICIAR_APP.bat` en la carpeta raíz.

### Para usuarios de Linux Mint:
1. **Permisos**: La primera vez, otorgue permisos de ejecución a los scripts:
   ```bash
   chmod +x INICIAR_APP.sh
   chmod +x DB_UPDATED/SINCRONIZAR_NUBE.sh
   ```
2. **Iniciar Aplicación**: Ejecute el script de inicio:
   ```bash
   ./INICIAR_APP.sh
   ```

---

## Sincronización con la Nube (Backup y Migración)

Si necesita descargar sus datos desde la nube (Supabase) hacia esta versión local de escritorio:

*   **En Windows**: Ejecute el archivo `DB_UPDATED\SINCRONIZAR_NUBE.bat`.
*   **En Linux Mint**: Ejecute el script `./DB_UPDATED/SINCRONIZAR_NUBE.sh`.

Este proceso limpiará su base de datos local y descargará una copia idéntica de sus registros desde Supabase. Además, se generará automáticamente un archivo de respaldo `backup_supabase_[FECHA].json` en la carpeta `DB_UPDATED`.

---

## ¿Cómo transferir los datos a otra computadora?
1. **Instale** la aplicación en el nuevo equipo.
2. **Copie** el archivo `asistencia.db` desde la ubicación original (ver sección arriba) y **péguelo** en la misma ruta de la nueva computadora.


---

### Modo Desarrollador (Para Programadores)
Si desea modificar el código fuente de esta aplicación:
1. Instale las dependencias: `npm install`
2. Para probar visualmente en su navegador: `npm run web`
3. Para probar la ventana de escritorio: `npm run start`
4. Para compilar y generar un nuevo instalador `.exe`: `npm run make`
