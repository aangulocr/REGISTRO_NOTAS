import Database from 'better-sqlite3';
import path from 'path';

const APPDATA = process.env.APPDATA || process.env.HOME;
const db = new Database(path.join(APPDATA, 'asistencia-mep', 'asistencia.db'));

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables:', tables);

for (const table of tables) {
    const info = db.prepare(`PRAGMA table_info(${table.name})`).all();
    console.log(`Schema for ${table.name}:`, info);
}

db.close();
