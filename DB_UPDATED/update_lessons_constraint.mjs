import Database from 'better-sqlite3';
import path from 'path';

const APPDATA = process.env.APPDATA || process.env.HOME;
const SQLITE_DB_PATH = path.join(APPDATA, 'asistencia-mep', 'asistencia.db');

try {
    const db = new Database(SQLITE_DB_PATH);
    console.log('Actualizando restricción de lecciones_totales...');
    
    db.transaction(() => {
        // SQLite no permite ALTER TABLE para cambiar CHECK constraints.
        // Debemos recrear la tabla.
        
        // 1. Obtener datos actuales
        const data = db.prepare('SELECT * FROM configuracion_diaria').all();
        
        // 2. Renombrar tabla vieja
        db.prepare('ALTER TABLE configuracion_diaria RENAME TO configuracion_diaria_old').run();
        
        // 3. Crear nueva tabla con la restricción correcta
        db.prepare(`
            CREATE TABLE configuracion_diaria (
                id TEXT PRIMARY KEY,
                seccion_id TEXT REFERENCES secciones(id) ON DELETE CASCADE,
                fecha TEXT NOT NULL,
                periodo INTEGER NOT NULL DEFAULT 1 CHECK (periodo IN (1, 2)),
                lecciones_totales INTEGER NOT NULL DEFAULT 4 CHECK (lecciones_totales BETWEEN 0 AND 4),
                observaciones TEXT,
                observacion_clase TEXT,
                UNIQUE(seccion_id, fecha, periodo)
            )
        `).run();
        
        // 4. Copiar datos
        const insert = db.prepare(`
            INSERT INTO configuracion_diaria (id, seccion_id, fecha, periodo, lecciones_totales, observaciones, observacion_clase)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        for (const row of data) {
            insert.run(row.id, row.seccion_id, row.fecha, row.periodo, row.lecciones_totales, row.observaciones, row.observacion_clase);
        }
        
        // 5. Borrar tabla vieja
        db.prepare('DROP TABLE configuracion_diaria_old').run();
    })();
    
    console.log('¡Éxito! Ahora se permiten 0 lecciones.');
    db.close();
} catch (err) {
    console.error('Error al actualizar la base de datos:', err.message);
    process.exit(1);
}
