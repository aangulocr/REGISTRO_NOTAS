import Database from 'better-sqlite3';
import path from 'path';

const APPDATA = process.env.APPDATA || process.env.HOME;
const db = new Database(path.join(APPDATA, 'asistencia-mep', 'asistencia.db'));

console.log('=== VERIFICACION ===');
const a = db.prepare("SELECT estudiante_id, estado_id FROM control_asistencia WHERE fecha = '2026-05-05'").all();
console.log(`Asistencias 2026-05-05:`, a);

db.close();
