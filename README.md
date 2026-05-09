# Sistema de Control de Asistencia y Notas - MEP 2026 (Versión de Escritorio SQLite3)

Este proyecto es una aplicación nativa de escritorio diseñada para automatizar la gestión administrativa de los docentes bajo la normativa MEP 2026. A diferencia de las versiones en la nube, esta versión es **100% Offline** y se conecta a una base de datos local SQLite3 para garantizar máxima velocidad, disponibilidad sin internet y privacidad total de los datos de los estudiantes.

## Ubicación de la Base de Datos Local
Todos los registros (estudiantes, notas, asistencia y usuarios) se guardan de forma permanente y automática en su propia computadora. 
El archivo físico de la base de datos se llama **`asistencia.db`** y se ubica en la siguiente ruta oculta de Windows:
`C:\Users\[TuUsuario]\AppData\Roaming\asistencia-mep\asistencia.db` 

*(Truco rápido: Presione la tecla `Windows + R`, escriba `%APPDATA%\asistencia-mep` y presione Enter para abrir la carpeta directamente).*

## Instalación Oficial de la Aplicación (.exe)

Para instalar el programa de forma nativa en su Windows como cualquier otro programa:
1. **Localizar el Instalador**: Dentro del código fuente de este proyecto, navegue hasta la ruta: `out\make\squirrel.windows\x64\`.
2. **Instalar**: Haga doble clic en el archivo ejecutable (`.exe`). El sistema instalará la aplicación y creará accesos directos en su escritorio y menú de inicio de forma silenciosa.
3. **Iniciar Sesión**: Abra la aplicación. Si es la primera vez, utilice la opción inferior para crear su cuenta de docente.

## ¿Cómo transferir la aplicación y los datos a otra computadora?

Si cambia de equipo, formatea la PC, o quiere trabajar desde una laptop distinta, siga estos pasos:
1. **Paso 1 (La App)**: Copie el instalador `.exe` (generado en `out\make\...`) a su nueva computadora mediante una llave maya o correo, e instale el programa.
2. **Paso 2 (Los Datos)**: Vaya a su computadora vieja, abra la carpeta `%APPDATA%\asistencia-mep` y copie el archivo **`asistencia.db`**. Péguelo exactamente en la misma ruta dentro de la nueva computadora. ¡Al abrir la aplicación tendrá su información idéntica!

## Notas Importantes (Backup y Migración en la Nube)

* **Sincronización (Nube Supabase -> Local SQLite):**
  Si usted utilizaba la versión antigua de esta app conectada a la nube (Supabase) y necesita bajar esos datos a esta versión local de escritorio, se ha creado un script especializado. Este proceso limpiará su base local y descargará la copia exacta de sus tablas desde la nube.
  Para ejecutarlo, abra **PowerShell** en la carpeta principal del proyecto (`REGISTRO_NOTAS`) y pegue exactamente el siguiente comando:
  ```powershell
  $env:ELECTRON_RUN_AS_NODE=1; npx electron DB_UPDATED/migrar_supabase.js
  ```
* **Backups Automáticos de Seguridad:**
  Al ejecutar el script de migración anterior, el sistema genera automáticamente un respaldo de seguridad con todo el código descargado. Este respaldo es un archivo en formato JSON y se almacena bajo el nombre `backup_supabase_[FECHA].json` exactamente en la carpeta **`DB_UPDATED`**.

---

### Modo Desarrollador (Para Programadores)
Si desea modificar el código fuente de esta aplicación:
1. Instale las dependencias: `npm install`
2. Para probar visualmente en su navegador: `npm run web`
3. Para probar la ventana de escritorio: `npm run start`
4. Para compilar y generar un nuevo instalador `.exe`: `npm run make`
