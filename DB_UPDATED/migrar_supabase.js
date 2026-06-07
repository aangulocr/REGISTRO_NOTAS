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
const SUPABASE_DB_URL = 'postgresql://postgres:rumenFila%2310@db.frkscfrpmtungywqgrvf.supabase.co:5432/postgres';

// Configuración de la base de datos (Ruta Unificada)
let homeDir;
if (process.env.APPDATA) {
    homeDir = process.env.APPDATA;
} else {
    homeDir = process.platform === 'darwin' 
        ? path.join(process.env.HOME, 'Library', 'Preferences') 
        : path.join(process.env.HOME, '.local', 'share');
}

const dbFolder = path.join(homeDir, 'asistencia-mep');
const SQLITE_DB_PATH = path.join(dbFolder, 'asistencia.db');

// Asegurar que el directorio existe
if (!fs.existsSync(dbFolder)) {
    fs.mkdirSync(dbFolder, { recursive: true });
}

// NOTA: secciones, docentes y estudiantes se migran de forma especial (con remapeo de IDs)
// estados_asistencia se maneja localmente y no se migra.
const TABLES_DATA_ONLY = [
    'trabajos_cotidianos',
    'indicadores',
    'evaluaciones_cotidiano',
    'tareas',
    'indicadores_tarea',
    'evaluaciones_tarea',
    'examenes',
    'indicadores_examen',
    'evaluaciones_examen',
    'notas_directas_examen',
    'notas_directas_cotidiano',
    'notas_directas_tarea'
];

function normalizeDate(val, col) {
    if (val instanceof Date) {
        if (col === 'fecha') {
            // Ajustar por zona horaria: Supabase devuelve UTC, aplicamos offset de CR (-6h)
            // Para fechas que son exactamente medianoche UTC, sumarle 12h para obtener la fecha local correcta
            const adjusted = new Date(val.getTime() + 6 * 60 * 60 * 1000);
            const y = adjusted.getFullYear();
            const m = String(adjusted.getMonth() + 1).padStart(2, '0');
            const d = String(adjusted.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }
        return val.toISOString();
    }
    if (typeof val === 'boolean') return val ? 1 : 0;
    if (val !== null && typeof val === 'object') return JSON.stringify(val);
    return val;
}

async function run() {
    console.log('Iniciando proceso de Backup y Migración CORREGIDO...\n');

    const pgClient = new Client({
        connectionString: SUPABASE_DB_URL,
        ssl: { rejectUnauthorized: false }
    });

    const backupData = {};

    try {
        console.log('1. Conectando a Supabase (PostgreSQL)...');
        await pgClient.connect();

        // Obtener todas las tablas necesarias
        const allTables = ['secciones', 'estudiantes', 'configuracion_diaria', 'control_asistencia', ...TABLES_DATA_ONLY];
        for (const table of allTables) {
            console.log(`   - Descargando tabla: ${table}...`);
            try {
                const res = await pgClient.query(`SELECT * FROM ${table}`);
                backupData[table] = res.rows;
                console.log(`     -> ${res.rows.length} registros`);
            } catch (err) {
                console.warn(`     [!] No se pudo leer ${table}: ${err.message}`);
                backupData[table] = [];
            }
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFileName = `backup_supabase_${timestamp}.json`;
        const backupFilePath = path.join(__dirname, backupFileName);
        fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2));
        console.log(`\n2. Backup guardado: ${backupFilePath}`);

    } catch (err) {
        console.error('Error conectando a Supabase:', err.message);
        process.exit(1);
    } finally {
        await pgClient.end();
    }

    // ==========================================
    // MIGRAR A SQLITE LOCAL
    // ==========================================
    console.log('\n3. Iniciando migración inteligente a SQLite...');
    console.log(`   -> Ruta local: ${SQLITE_DB_PATH}`);

    let sqliteDb;
    try {
        sqliteDb = new Database(SQLITE_DB_PATH);
        sqliteDb.pragma('foreign_keys = OFF');

        // PASO 1: Obtener el mapa de secciones LOCAL (nombre -> id local)
        const seccionesLocales = sqliteDb.prepare('SELECT id, nombre FROM secciones').all();
        const mapNombreToLocalId = {};
        seccionesLocales.forEach(s => { mapNombreToLocalId[s.nombre] = s.id; });
        console.log('\n   Secciones locales encontradas:', Object.keys(mapNombreToLocalId).join(', '));

        // PASO 2: Construir mapa de UUID de Supabase -> ID local
        const mapSupabaseUUIDToLocalId = {};
        const seccionesSupabase = backupData['secciones'] || [];
        seccionesSupabase.forEach(s => {
            const localId = mapNombreToLocalId[s.nombre];
            if (localId) {
                mapSupabaseUUIDToLocalId[s.id] = localId;
            } else {
                console.warn(`   [!] Sección "${s.nombre}" de Supabase no tiene equivalente local`);
            }
        });
        console.log(`   Mapa de ${Object.keys(mapSupabaseUUIDToLocalId).length} secciones Supabase -> Local creado`);

        const executeTransaction = sqliteDb.transaction(() => {

            // PASO 3: Migrar estudiantes remapeando seccion_id
            console.log('\n   - Migrando estudiantes...');
            sqliteDb.prepare('DELETE FROM estudiantes').run();
            const insertEst = sqliteDb.prepare(`
                INSERT OR IGNORE INTO estudiantes (cedula, nombre, apellidos, email, seccion_id)
                VALUES (?, ?, ?, ?, ?)
            `);
            for (const est of (backupData['estudiantes'] || [])) {
                const localSeccionId = mapSupabaseUUIDToLocalId[est.seccion_id];
                if (!localSeccionId) {
                    console.warn(`     [!] Estudiante ${est.cedula} tiene seccion_id desconocido: ${est.seccion_id}`);
                    continue;
                }
                insertEst.run(est.cedula, est.nombre, est.apellidos, est.email, localSeccionId);
            }

            // PASO 4: Migrar configuracion_diaria remapeando seccion_id
            console.log('   - Migrando configuracion_diaria...');
            sqliteDb.prepare('DELETE FROM configuracion_diaria').run();
            const insertCfg = sqliteDb.prepare(`
                INSERT OR IGNORE INTO configuracion_diaria (id, seccion_id, fecha, periodo, lecciones_totales, observaciones, observacion_clase)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            let cfgOk = 0, cfgSkip = 0;
            for (const cfg of (backupData['configuracion_diaria'] || [])) {
                const localSeccionId = mapSupabaseUUIDToLocalId[cfg.seccion_id];
                if (!localSeccionId) { cfgSkip++; continue; }
                const lecciones = Math.max(1, Math.min(4, Number(cfg.lecciones_totales) || 4));
                const periodo = [1, 2].includes(Number(cfg.periodo)) ? Number(cfg.periodo) : 1;
                const fecha = normalizeDate(cfg.fecha, 'fecha');
                insertCfg.run(cfg.id, localSeccionId, fecha, periodo, lecciones, cfg.observaciones || null, cfg.observacion_clase || null);
                cfgOk++;
            }
            console.log(`     -> ${cfgOk} registros migrados, ${cfgSkip} omitidos`);

            // PASO 5: Migrar control_asistencia remapeando seccion_id
            console.log('   - Migrando control_asistencia...');
            sqliteDb.prepare('DELETE FROM control_asistencia').run();
            const insertAsis = sqliteDb.prepare(`
                INSERT OR IGNORE INTO control_asistencia (id, estudiante_id, seccion_id, fecha, periodo, estado_id, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            let asisOk = 0, asisSkip = 0;
            for (const asis of (backupData['control_asistencia'] || [])) {
                const localSeccionId = mapSupabaseUUIDToLocalId[asis.seccion_id];
                if (!localSeccionId) { asisSkip++; continue; }
                const fecha = normalizeDate(asis.fecha, 'fecha');
                const periodo = [1, 2].includes(Number(asis.periodo)) ? Number(asis.periodo) : 1;
                const estadoId = Number(asis.estado_id) || 1;
                const createdAt = asis.created_at ? normalizeDate(asis.created_at, 'created_at') : null;
                insertAsis.run(asis.id, asis.estudiante_id, localSeccionId, fecha, periodo, estadoId, createdAt);
                asisOk++;
            }
            console.log(`     -> ${asisOk} registros migrados, ${asisSkip} omitidos`);

            // PASO 6: Migrar tablas de evaluaciones (no tienen seccion_id directo en muchas tablas)
            for (const table of TABLES_DATA_ONLY) {
                const rows = backupData[table] || [];
                if (rows.length === 0) continue;

                sqliteDb.prepare(`DELETE FROM ${table}`).run();
                const columns = Object.keys(rows[0]);
                const placeholders = columns.map(() => '?').join(', ');
                const insertStmt = sqliteDb.prepare(`INSERT OR IGNORE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`);

                let count = 0;
                for (const row of rows) {
                    const values = columns.map(col => {
                        let val = row[col];
                        // Remapear seccion_id si la tabla lo tiene
                        if (col === 'seccion_id' && val) {
                            val = mapSupabaseUUIDToLocalId[val] || val;
                        }
                        return normalizeDate(val, col);
                    });
                    try {
                        insertStmt.run(values);
                        count++;
                    } catch (e) {
                        // Ignorar errores de constraint
                    }
                }
                console.log(`   - ${table}: ${count} registros`);
            }
        });

        executeTransaction();
        sqliteDb.pragma('foreign_keys = ON');

        // Verificación final
        console.log('\n=== VERIFICACIÓN FINAL ===');
        const asisTest = sqliteDb.prepare("SELECT COUNT(*) as c FROM control_asistencia WHERE fecha = '2026-05-05'").get();
        const cfgTest = sqliteDb.prepare("SELECT * FROM configuracion_diaria WHERE fecha = '2026-05-05'").all();
        console.log(`Asistencia del 05-05: ${asisTest.c} registros`);
        console.log(`Config del 05-05: ${JSON.stringify(cfgTest.map(r => ({seccion: r.seccion_id, obs: r.observaciones?.substring(0,50)})))}`);

        console.log('\n✅ Migración completada con éxito. La base de datos local está actualizada.');

    } catch (err) {
        console.error('Error durante la migración a SQLite:', err);
    } finally {
        if (sqliteDb) sqliteDb.close();
    }
}

run();
