const http = require('http');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { app } = require('electron');

// Forzar modo headless si se corre con Electron
if (app) {
    app.on('ready', () => {
        if (app.dock) app.dock.hide(); // macOS
    });
}

// Configuración de la base de datos (Ruta Unificada)
let homeDir;
if (app) {
    homeDir = path.join(app.getPath('userData'), '..');
} else {
    homeDir = process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + "/.local/share");
}

const dbFolder = path.join(homeDir, 'asistencia-mep');
const dbPath = path.join(dbFolder, 'asistencia.db');

// Asegurar que el directorio existe
if (!fs.existsSync(dbFolder)) {
    fs.mkdirSync(dbFolder, { recursive: true });
}

console.log('Base de datos en:', dbPath);
const db = new Database(dbPath);

// Inicializar esquema
const schemaPath = path.join(__dirname, 'local_sqlite_schema.sql');
if (fs.existsSync(schemaPath)) {
    const schema = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schema);
    console.log('Esquema inicializado correctamente.');
}

const server = http.createServer(async (req, res) => {
    // Manejar CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const { action, payload } = JSON.parse(body);

                if (action === 'db-query') {
                    const { sql, params = [] } = payload;
                    const stmt = db.prepare(sql);
                    if (sql.trim().toUpperCase().startsWith('SELECT')) {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ data: stmt.all(params), error: null }));
                    } else {
                        const result = stmt.run(params);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ data: result, error: null }));
                    }
                }
                else if (action === 'db-transaction') {
                    const { queries } = payload;
                    const executeTransaction = db.transaction((cmds) => {
                        for (const { sql, params } of cmds) {
                            db.prepare(sql).run(params);
                        }
                    });
                    try {
                        executeTransaction(queries);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true, error: null }));
                    } catch (error) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: error.message }));
                    }
                }
                else {
                    res.writeHead(404);
                    res.end('Action not found');
                }
            } catch (err) {
                res.writeHead(500);
                res.end(err.message);
            }
        });
    } else {
        res.writeHead(405);
        res.end('Method Not Allowed');
    }
});

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`\x1b[32m%s\x1b[0m`, `--- SERVIDOR API ACTIVO ---`);
    console.log(`Escuchando en http://localhost:${PORT}`);
    console.log(`Usa este servicio para conectar la aplicación web con SQLite.`);
});
