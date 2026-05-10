import Database from 'better-sqlite3';
import path from 'path';

const APPDATA = process.env.APPDATA || process.env.HOME;
const db = new Database(path.join(APPDATA, 'asistencia-mep', 'asistencia.db'));

console.log('=== SECCIONES en SQLite local ===');
const secciones = db.prepare('SELECT id, nombre FROM secciones').all();
console.log(JSON.stringify(secciones, null, 2));

db.close();
