import Database from 'better-sqlite3';
import path from 'path';

const APPDATA = process.env.APPDATA || process.env.HOME;
const db = new Database(path.join(APPDATA, 'asistencia-mep', 'asistencia.db'));

db.exec(`
    CREATE TABLE IF NOT EXISTS notas_directas_examen (
        id TEXT PRIMARY KEY,
        examen_id INTEGER,
        estudiante_id TEXT,
        nota REAL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS notas_directas_cotidiano (
        id TEXT PRIMARY KEY,
        trabajo_id INTEGER,
        estudiante_id TEXT,
        nota REAL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS notas_directas_tarea (
        id TEXT PRIMARY KEY,
        tarea_id INTEGER,
        estudiante_id TEXT,
        nota REAL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
`);

console.log('Tables created successfully');
db.close();
