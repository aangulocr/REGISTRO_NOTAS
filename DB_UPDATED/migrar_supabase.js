import fs from 'fs';
import path from 'path';
import pkg from 'pg';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Client } = pkg;

// ==========================================
// CONFIGURACIÓN
// ==========================================

// 1. Reemplaza esta URL con la "Connection string" (URI) de PostgreSQL de tu Supabase
// Puedes encontrarla en Supabase > Project Settings > Database > Connection string (URI)
const SUPABASE_DB_URL = 'postgresql://postgres:rumenFila%2310@db.frkscfrpmtungywqgrvf.supabase.co:5432/postgres';


// 2. Ruta de la base de datos local SQLite (Asistencia MEP 2026)
// En Windows, app.getPath('userData') apunta a AppData\Roaming\[NombreApp]
const APPDATA = process.env.APPDATA || process.env.HOME;
const SQLITE_DB_PATH = path.join(APPDATA, 'asistencia-mep', 'asistencia.db');

// Tablas a respaldar y migrar (en orden para respetar claves foráneas si fuera necesario, aunque desactivaremos las validaciones temporales)
const TABLES = [
    'docentes',
    'secciones',
    'estudiantes',
    'configuracion_diaria',
    'control_asistencia',
    'trabajos_cotidianos',
    'indicadores',
    'evaluaciones_cotidiano',
    'tareas',
    'indicadores_tarea',
    'evaluaciones_tarea',
    'examenes',
    'indicadores_examen',
    'evaluaciones_examen'
];

async function run() {
    console.log('Iniciando proceso de Backup y Migración...\n');

    if (SUPABASE_DB_URL.includes('[TU_CONTRASEÑA]')) {
        console.error('ERROR: Por favor edita este archivo y coloca la Connection String real de Supabase en SUPABASE_DB_URL.');
        process.exit(1);
    }

    const pgClient = new Client({
        connectionString: SUPABASE_DB_URL,
        ssl: { rejectUnauthorized: false } // Requerido para Supabase
    });

    const backupData = {};

    try {
        console.log('1. Conectando a Supabase (PostgreSQL)...');
        await pgClient.connect();

        for (const table of TABLES) {
            console.log(`   - Descargando tabla: ${table}...`);
            try {
                const res = await pgClient.query(`SELECT * FROM ${table}`);
                backupData[table] = res.rows;
            } catch (err) {
                console.warn(`     [!] Advertencia: No se pudo leer la tabla ${table}. ¿Existe en Supabase? Detalle: ${err.message}`);
                backupData[table] = [];
            }
        }

        // ==========================================
        // GUARDAR BACKUP LOCAL EN JSON
        // ==========================================
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFileName = `backup_supabase_${timestamp}.json`;
        const backupFilePath = path.join(__dirname, backupFileName);
        
        console.log(`\n2. Guardando backup completo en la nube a archivo local...`);
        fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2));
        console.log(`   -> Backup guardado con éxito en: ${backupFilePath}`);

    } catch (err) {
        console.error('Error durante la extracción de Supabase:', err);
        process.exit(1);
    } finally {
        await pgClient.end();
    }

    // ==========================================
    // MIGRAR A SQLITE LOCAL
    // ==========================================
    console.log('\n3. Iniciando migración a base de datos local SQLite...');
    console.log(`   -> Ruta local: ${SQLITE_DB_PATH}`);

    let sqliteDb;
    try {
        sqliteDb = new Database(SQLITE_DB_PATH);
        // Desactivar temporalmente claves foráneas para poder insertar datos sin conflictos de orden
        sqliteDb.pragma('foreign_keys = OFF');

        const executeTransaction = sqliteDb.transaction((data) => {
            for (const table of TABLES) {
                const rows = data[table];
                if (!rows || rows.length === 0) continue;

                console.log(`   - Restaurando tabla: ${table} (${rows.length} registros)...`);
                
                // Opcional: Limpiar la tabla antes de insertar
                sqliteDb.prepare(`DELETE FROM ${table}`).run();

                const columns = Object.keys(rows[0]);
                const placeholders = columns.map(() => '?').join(', ');
                const insertStmt = sqliteDb.prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`);

                for (const row of rows) {
                    // Extraer los valores en el mismo orden que las columnas
                    const values = columns.map(col => {
                        let val = row[col];
                        
                        // Saneamiento específico para respetar los CHECK constraints de la base de datos local
                        if (table === 'configuracion_diaria' && col === 'lecciones_totales') {
                            val = Math.max(1, Math.min(4, Number(val) || 4));
                        }
                        if (table === 'configuracion_diaria' && col === 'periodo') {
                            val = [1, 2].includes(Number(val)) ? Number(val) : 1;
                        }
                        if (table === 'secciones' && col === 'nivel') {
                            val = [10, 11].includes(Number(val)) ? Number(val) : 10;
                        }

                        // SQLite3 solo acepta string, number, bigint, buffer, o null
                        if (typeof val === 'boolean') return val ? 1 : 0;
                        if (val !== null && typeof val === 'object') return JSON.stringify(val);
                        return val;
                    });
                    insertStmt.run(values);
                }
            }
        });

        executeTransaction(backupData);
        
        sqliteDb.pragma('foreign_keys = ON');
        console.log('\n✅ Migración completada con éxito. La base de datos local está actualizada.');

    } catch (err) {
        console.error('Error durante la migración a SQLite:', err);
    } finally {
        if (sqliteDb) sqliteDb.close();
    }
}

run();
