# Sistema de Control de Asistencia y Notas - MEP 2026

Este proyecto es una aplicación web profesional diseñada para automatizar la gestión administrativa de los docentes bajo la normativa MEP 2026. Permite el control total de asistencia, evaluaciones de trabajo cotidiano, tareas, exámenes y la generación de reportes consolidados.

## Características Principales

*   **Gestión de Estudiantes**: Registro automatizado con lógica de cédula y correo institucional MEP.
*   **Asistencia Inteligente**: Control diario con lecciones variables y cálculo automático del 5% basado en la escala oficial de ausentismo del MEP.
*   **Evaluación Continua**: Módulos para Trabajo Cotidiano (35%), Tareas (10%) y Exámenes (50%) con rúbricas detalladas.
*   **Reportes Consolidados**: Generación de "sábanas" de notas finales con exportación a Excel (CSV) y vista de impresión profesional.
*   **Interfaz Premium**: Diseño moderno, responsive y optimizado para una experiencia de usuario fluida.

## Requisitos Previos

1.  **Node.js**: Debe tener instalado Node.js (versión 18 o superior recomendada). Puede descargarlo en [nodejs.org](https://nodejs.org/).
2.  **Git** (Opcional): Para clonar el repositorio.

## Pasos para la Instalación

1.  **Obtener el Código**:
    *   Si usa Git: `git clone <url-del-repositorio>`
    *   Si tiene una carpeta: Copie la carpeta completa del proyecto (excepto la carpeta `node_modules`).

2.  **Instalar Dependencias**:
    Abra una terminal en la carpeta del proyecto y ejecute:
    ```bash
    npm install
    ```

3.  **Ejecutar la Aplicación (Modo Escritorio Offline)**:
    La aplicación ahora funciona de manera 100% offline utilizando una base de datos local (SQLite3). No requiere conexión a internet ni configuración de variables de entorno (Supabase fue removido).
    
    Para iniciar la aplicación en modo desarrollo, ejecute:
    ```bash
    npm run web
    ```
    O si prefiere iniciar la versión de escritorio de Electron directamente:
    ```bash
    npm run start
    ```

5.  **Construir para Producción** (Opcional):
    Si desea generar los archivos para desplegar en un servidor real:
    ```bash
    npm run build
    ```
    Esto creará una carpeta `dist` lista para ser servida.

## Notas Importantes
* Esta es la versión de escritorio de Registro de Notas MEP 2026. Todos los datos se guardan en su computadora mediante SQLite. Para respaldos o restauración, puede utilizar la herramienta interna en la carpeta `DB_UPDATED`.
