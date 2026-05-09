const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// Configuración de la base de datos (Ruta Unificada)
const dbFolder = path.join(app.getPath('userData'), '..', 'asistencia-mep');
if (!fs.existsSync(dbFolder)) {
    fs.mkdirSync(dbFolder, { recursive: true });
}
const dbPath = path.join(dbFolder, 'asistencia.db');
const db = new Database(dbPath);

// Inicializar esquema
const schema = fs.readFileSync(path.join(__dirname, 'local_sqlite_schema.sql'), 'utf8');
db.exec(schema);

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 850,
        title: 'Registro de Notas MEP 2026',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            preload: path.join(__dirname, 'preload.cjs') // Opcional pero recomendado
        }
    });

    const isDev = process.env.NODE_ENV === 'development';

    if (isDev) {
        win.loadURL('http://localhost:5173');
        // win.webContents.openDevTools(); // Descomentar para debug
    } else {
        win.loadFile(path.join(__dirname, 'dist', 'index.html'));
    }
}

// Handlers para IPC (El "Puente" hacia React)
ipcMain.handle('db-query', async (event, { sql, params = [] }) => {
    try {
        const stmt = db.prepare(sql);
        if (sql.trim().toUpperCase().startsWith('SELECT')) {
            return { data: stmt.all(params), error: null };
        } else {
            const result = stmt.run(params);
            return { data: result, error: null };
        }
    } catch (error) {
        console.error('Database Error:', error);
        return { data: null, error: error.message };
    }
});

// --- Servidor de API para acceso externo (Navegador) ---
const http = require('http');

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
        res.end();
    }
});

server.listen(3001, () => {
    console.log('Registro de Notas - API Server activo en http://localhost:3001');
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});