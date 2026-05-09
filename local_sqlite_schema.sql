-- ==========================================
-- ESQUEMA SQL PARA SQLITE (LOCAL)
-- PROYECTO: CONTROL DE ASISTENCIA Y EVALUACIÓN 2026
-- ==========================================

-- Docentes (Usuarios)
CREATE TABLE IF NOT EXISTS docentes (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL
);

-- Secciones
CREATE TABLE IF NOT EXISTS secciones (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL UNIQUE,
    nivel INTEGER NOT NULL CHECK (nivel IN (10, 11))
);

-- Estados de Asistencia
CREATE TABLE IF NOT EXISTS estados_asistencia (
    id INTEGER PRIMARY KEY,
    nombre TEXT NOT NULL,
    peso_ausencia REAL NOT NULL DEFAULT 0,
    es_justificada INTEGER DEFAULT 0 -- 0=False, 1=True
);

-- Estudiantes
CREATE TABLE IF NOT EXISTS estudiantes (
    cedula TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    apellidos TEXT NOT NULL,
    email TEXT,
    seccion_id TEXT REFERENCES secciones(id) ON DELETE CASCADE
);

-- Configuración Diaria
CREATE TABLE IF NOT EXISTS configuracion_diaria (
    id TEXT PRIMARY KEY,
    seccion_id TEXT REFERENCES secciones(id) ON DELETE CASCADE,
    fecha TEXT NOT NULL,
    periodo INTEGER NOT NULL DEFAULT 1 CHECK (periodo IN (1, 2)),
    lecciones_totales INTEGER NOT NULL DEFAULT 4 CHECK (lecciones_totales BETWEEN 0 AND 4),
    observaciones TEXT,
    observacion_clase TEXT,
    UNIQUE(seccion_id, fecha, periodo)
);

-- Registro de Asistencia
CREATE TABLE IF NOT EXISTS control_asistencia (
    id TEXT PRIMARY KEY,
    estudiante_id TEXT REFERENCES estudiantes(cedula) ON DELETE CASCADE,
    seccion_id TEXT REFERENCES secciones(id) ON DELETE CASCADE,
    fecha TEXT NOT NULL,
    periodo INTEGER NOT NULL DEFAULT 1 CHECK (periodo IN (1, 2)),
    estado_id INTEGER REFERENCES estados_asistencia(id) DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(estudiante_id, fecha, periodo)
);

-- Evaluación: Trabajo Cotidiano
CREATE TABLE IF NOT EXISTS trabajos_cotidianos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    seccion_id TEXT REFERENCES secciones(id) ON DELETE CASCADE,
    periodo INTEGER NOT NULL DEFAULT 1 CHECK (periodo IN (1, 2)),
    fecha TEXT DEFAULT CURRENT_DATE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS indicadores (
    id TEXT PRIMARY KEY,
    trabajo_id INTEGER REFERENCES trabajos_cotidianos(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    orden INTEGER NOT NULL,
    desc_0 TEXT DEFAULT 'No evidencia',
    desc_1 TEXT DEFAULT 'No logrado',
    desc_2 TEXT DEFAULT 'En proceso',
    desc_3 TEXT DEFAULT 'Logrado'
);

CREATE TABLE IF NOT EXISTS evaluaciones_cotidiano (
    id TEXT PRIMARY KEY,
    estudiante_id TEXT REFERENCES estudiantes(cedula) ON DELETE CASCADE,
    indicador_id TEXT REFERENCES indicadores(id) ON DELETE CASCADE,
    puntaje INTEGER NOT NULL DEFAULT 0 CHECK (puntaje >= 0 AND puntaje <= 3),
    UNIQUE(estudiante_id, indicador_id)
);

-- Evaluación: Tareas
CREATE TABLE IF NOT EXISTS tareas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    seccion_id TEXT REFERENCES secciones(id) ON DELETE CASCADE,
    periodo INTEGER NOT NULL DEFAULT 1 CHECK (periodo IN (1, 2)),
    porcentaje REAL NOT NULL DEFAULT 5.0,
    puntos_totales INTEGER NOT NULL DEFAULT 10,
    fecha TEXT DEFAULT CURRENT_DATE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS indicadores_tarea (
    id TEXT PRIMARY KEY,
    tarea_id INTEGER REFERENCES tareas(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    orden INTEGER NOT NULL,
    desc_0 TEXT,
    desc_1 TEXT,
    desc_2 TEXT,
    desc_3 TEXT
);

CREATE TABLE IF NOT EXISTS evaluaciones_tarea (
    id TEXT PRIMARY KEY,
    estudiante_id TEXT REFERENCES estudiantes(cedula) ON DELETE CASCADE,
    indicador_id TEXT REFERENCES indicadores_tarea(id) ON DELETE CASCADE,
    puntaje INTEGER NOT NULL DEFAULT 0 CHECK (puntaje >= 0 AND puntaje <= 3),
    UNIQUE(estudiante_id, indicador_id)
);

-- Evaluación: Exámenes
CREATE TABLE IF NOT EXISTS examenes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    seccion_id TEXT REFERENCES secciones(id) ON DELETE CASCADE,
    periodo INTEGER NOT NULL DEFAULT 1 CHECK (periodo IN (1, 2)),
    porcentaje REAL NOT NULL DEFAULT 25.0,
    puntos_totales INTEGER NOT NULL DEFAULT 30,
    fecha TEXT DEFAULT CURRENT_DATE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS indicadores_examen (
    id TEXT PRIMARY KEY,
    examen_id INTEGER REFERENCES examenes(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    orden INTEGER NOT NULL,
    desc_0 TEXT,
    desc_1 TEXT,
    desc_2 TEXT,
    desc_3 TEXT
);

CREATE TABLE IF NOT EXISTS evaluaciones_examen (
    id TEXT PRIMARY KEY,
    estudiante_id TEXT REFERENCES estudiantes(cedula) ON DELETE CASCADE,
    indicador_id TEXT REFERENCES indicadores_examen(id) ON DELETE CASCADE,
    puntaje INTEGER NOT NULL DEFAULT 0 CHECK (puntaje >= 0 AND puntaje <= 3),
    UNIQUE(estudiante_id, indicador_id)
);

-- Triggers para procesar datos de estudiantes (Mayúsculas y Correo)
CREATE TRIGGER IF NOT EXISTS tr_process_student_insert
AFTER INSERT ON estudiantes
BEGIN
    UPDATE estudiantes 
    SET nombre = UPPER(NEW.nombre),
        apellidos = UPPER(NEW.apellidos),
        email = NEW.cedula || '@est.mep.go.cr'
    WHERE cedula = NEW.cedula;
END;

CREATE TRIGGER IF NOT EXISTS tr_process_student_update
AFTER UPDATE OF cedula, nombre, apellidos ON estudiantes
BEGIN
    UPDATE estudiantes 
    SET nombre = UPPER(NEW.nombre),
        apellidos = UPPER(NEW.apellidos),
        email = NEW.cedula || '@est.mep.go.cr'
    WHERE cedula = NEW.cedula;
END;

-- Datos Iniciales
INSERT OR IGNORE INTO estados_asistencia (id, nombre, peso_ausencia, es_justificada) VALUES
(1, 'Presencia total', 0, 0),
(2, 'Ausencia total (4 lecciones)', 4, 0),
(3, 'Ausencia 1° lección', 1, 0),
(4, 'Ausencia 1° y 2° lección', 2, 0),
(5, 'Ausencia 1°, 2° y 3° lección', 3, 0),
(6, 'Tardía 1° lección', 0.5, 0),
(7, 'Tardía 3° lección', 0.5, 0),
(8, 'Ausencia 1° + Tardía 2°', 1.5, 0),
(9, 'Ausencia 1° y 2° + Tardía 3°', 2.5, 0),
(10, 'Ausencia 1°, 2° y 3° + Tardía 4°', 3.5, 0),
(11, 'Escapes (2°, 3° o 4° lección)', 1, 0),
(12, 'Justificación', 0, 1);

INSERT OR IGNORE INTO secciones (id, nombre, nivel) VALUES 
('sec-10-1', '10-1', 10), ('sec-10-2', '10-2', 10), ('sec-10-3', '10-3', 10),
('sec-11-1', '11-1', 11), ('sec-11-2', '11-2', 11), ('sec-11-3', '11-3', 11);

INSERT OR IGNORE INTO docentes (id, nombre, email, password) VALUES
('docente-1', 'Profesor Principal', 'docente@ejemplo.com', 'admin123');

-- Tablas para Notas Directas (Override)
CREATE TABLE IF NOT EXISTS notas_directas_examen (
    id TEXT PRIMARY KEY,
    examen_id INTEGER REFERENCES examenes(id) ON DELETE CASCADE,
    estudiante_id TEXT REFERENCES estudiantes(cedula) ON DELETE CASCADE,
    nota REAL CHECK (nota >= 0 AND nota <= 100),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notas_directas_cotidiano (
    id TEXT PRIMARY KEY,
    trabajo_id INTEGER REFERENCES trabajos_cotidianos(id) ON DELETE CASCADE,
    estudiante_id TEXT REFERENCES estudiantes(cedula) ON DELETE CASCADE,
    nota REAL CHECK (nota >= 0 AND nota <= 100),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notas_directas_tarea (
    id TEXT PRIMARY KEY,
    tarea_id INTEGER REFERENCES tareas(id) ON DELETE CASCADE,
    estudiante_id TEXT REFERENCES estudiantes(cedula) ON DELETE CASCADE,
    nota REAL CHECK (nota >= 0 AND nota <= 100),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
