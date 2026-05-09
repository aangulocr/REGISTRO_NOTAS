import React, { useState, useEffect } from 'react';
import { sqliteService } from '../lib/sqliteService';
import * as XLSX from 'xlsx';
import { useToast } from './Toast';

interface Estudiante {
    cedula: string;
    nombre: string;
    apellidos: string;
    email: string;
    seccion_id: string;
}

interface Seccion {
    id: string;
    nombre: string;
    nivel: number;
}

export const StudentsPage: React.FC = () => {
    const [secciones, setSecciones] = useState<Seccion[]>([]);
    const [selectedSeccion, setSelectedSeccion] = useState<string>('');
    const [students, setStudents] = useState<Estudiante[]>([]);
    const [loading, setLoading] = useState(false);
    const [importing, setImporting] = useState(false);
    const { showToast } = useToast();

    // Manual add form state
    const [newCedula, setNewCedula] = useState('');
    const [newNombre, setNewNombre] = useState('');
    const [newApellidos, setNewApellidos] = useState('');

    useEffect(() => {
        fetchSecciones();
    }, []);

    useEffect(() => {
        if (selectedSeccion) {
            fetchStudents(selectedSeccion);
        } else {
            setStudents([]);
        }
    }, [selectedSeccion]);

    async function fetchSecciones() {
        const { data, error } = await sqliteService.query('SELECT * FROM secciones ORDER BY nombre');
        if (error) {
            showToast('Error al cargar secciones', 'error');
        } else {
            setSecciones(data || []);
            if (data && data.length > 0) {
                setSelectedSeccion(data[0].id);
            }
        }
    }

    async function fetchStudents(seccionId: string) {
        setLoading(true);
        const { data, error } = await sqliteService.query(
            'SELECT * FROM estudiantes WHERE seccion_id = ? ORDER BY apellidos',
            [seccionId]
        );

        if (error) {
            showToast('Error al cargar estudiantes', 'error');
        } else {
            setStudents(data || []);
        }
        setLoading(false);
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validar nombre del archivo (ej. 10-1.xlsx)
        const fileName = file.name.split('.')[0];
        let seccionEncontrada = secciones.find(s => s.nombre === fileName);

        if (!seccionEncontrada) {
            // Intentar inferir nivel
            const match = fileName.match(/^(10|11)-/);
            if (!match) {
                showToast(`El nombre del archivo "${file.name}" no tiene un formato válido (ej. 10-1.xlsx o 11-2.xlsx).`, 'error');
                return;
            }

            const nivelInferido = parseInt(match[1]);
            const confirmacion = confirm(`La sección "${fileName}" no existe. ¿Deseas crearla automáticamente como nivel ${nivelInferido === 10 ? 'Décimo' : 'Undécimo'} e importar los estudiantes?`);

            if (!confirmacion) return;

            setImporting(true);
            try {
                const newId = `sec-${fileName}`;
                const { error: createError } = await sqliteService.from('secciones').insert({
                    id: newId,
                    nombre: fileName,
                    nivel: nivelInferido
                });

                if (createError) throw new Error(createError);

                const { data: todasSecciones } = await sqliteService.query('SELECT * FROM secciones ORDER BY nombre');
                setSecciones(todasSecciones || []);
                seccionEncontrada = { id: newId, nombre: fileName, nivel: nivelInferido };
            } catch (error: any) {
                showToast(`Error al crear la sección: ${error.message}`, 'error');
                setImporting(false);
                return;
            }
        }

        setImporting(true);
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws) as any[];

                if (data.length === 0 || !data[0].cedula || !data[0].nombre || !data[0].apellidos) {
                    showToast('El archivo debe contener las columnas: cedula, nombre, apellidos.', 'error');
                    setImporting(false);
                    return;
                }

                if (!confirm(`Se sobreescribirán todos los estudiantes de la sección ${fileName}. ¿Deseas continuar?`)) {
                    setImporting(false);
                    return;
                }

                // Usar transacción para borrar e insertar masivamente
                const queries = [
                    { sql: 'DELETE FROM estudiantes WHERE seccion_id = ?', params: [seccionEncontrada.id] }
                ];

                data.forEach(item => {
                    queries.push({
                        sql: 'INSERT INTO estudiantes (cedula, nombre, apellidos, seccion_id) VALUES (?, ?, ?, ?)',
                        params: [String(item.cedula), String(item.nombre), String(item.apellidos), seccionEncontrada.id]
                    });
                });

                const { success, error: transError } = await sqliteService.transaction(queries);
                if (!success) throw new Error(transError || 'Error en la transacción');

                showToast(`Se han importado ${data.length} estudiantes a la sección ${fileName}.`, 'success');
                setSelectedSeccion(seccionEncontrada.id);
                fetchStudents(seccionEncontrada.id);
            } catch (error: any) {
                console.error(error);
                showToast(`Error al importar: ${error.message}`, 'error');
            } finally {
                setImporting(false);
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleAddStudent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSeccion) return;

        try {
            const { error } = await sqliteService.from('estudiantes').insert({
                cedula: newCedula,
                nombre: newNombre,
                apellidos: newApellidos,
                seccion_id: selectedSeccion
            });

            if (error) throw new Error(error);

            showToast('Estudiante agregado correctamente', 'success');
            setNewCedula('');
            setNewNombre('');
            setNewApellidos('');
            fetchStudents(selectedSeccion);
        } catch (error: any) {
            showToast(`Error: ${error.message}`, 'error');
        }
    };

    const handleDeleteStudent = async (cedula: string) => {
        if (!confirm('¿Estás seguro de eliminar este estudiante?')) return;

        try {
            const { error } = await sqliteService.from('estudiantes').delete('cedula', cedula);

            if (error) throw new Error(error);

            showToast('Estudiante eliminado', 'success');
            fetchStudents(selectedSeccion);
        } catch (error: any) {
            showToast(`Error: ${error.message}`, 'error');
        }
    };

    return (
        <div className="students-page">
            <header style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Gestión de Estudiantes</h1>
                <p style={{ color: 'var(--text-muted)' }}>Importa listas de Excel o gestiona estudiantes manualmente.</p>
            </header>

            <div className="grid" style={{ gridTemplateColumns: '1fr 2fr' }}>
                <div className="glass-card" style={{ padding: '1.5rem', height: 'fit-content' }}>
                    <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem' }}>Importar desde Excel</h2>
                    <div style={{ marginBottom: '1.5rem' }}>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                            El archivo debe llamarse como la sección (e.g. 10-1.xlsx) y contener las columnas:
                            <strong> cedula, nombre, apellidos</strong>.
                        </p>
                        <input
                            type="file"
                            accept=".xlsx, .xls"
                            onChange={handleFileUpload}
                            disabled={importing}
                            style={{ display: 'none' }}
                            id="excel-upload"
                        />
                        <label
                            htmlFor="excel-upload"
                            className="btn-primary"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem',
                                width: '100%',
                                cursor: importing ? 'wait' : 'pointer',
                                background: importing ? 'var(--glass-border)' : 'var(--primary)'
                            }}
                        >
                            {importing ? '⌛ Importando...' : '📁 Subir Archivo Excel'}
                        </label>
                    </div>

                    <hr style={{ border: 'none', borderTop: '1px solid var(--glass-border)', margin: '2rem 0' }} />

                    <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem' }}>Agregar Manualmente</h2>
                    <form onSubmit={handleAddStudent} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Cédula</label>
                            <input
                                type="text"
                                required
                                value={newCedula}
                                onChange={e => setNewCedula(e.target.value)}
                                className="glass-card"
                                style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.05)', color: 'white', border: 'none' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Nombre</label>
                            <input
                                type="text"
                                required
                                value={newNombre}
                                onChange={e => setNewNombre(e.target.value)}
                                className="glass-card"
                                style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.05)', color: 'white', border: 'none' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Apellidos</label>
                            <input
                                type="text"
                                required
                                value={newApellidos}
                                onChange={e => setNewApellidos(e.target.value)}
                                className="glass-card"
                                style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.05)', color: 'white', border: 'none' }}
                            />
                        </div>
                        <button type="submit" className="btn-primary" style={{ marginTop: '1rem' }}>
                            ➕ Agregar Estudiante
                        </button>
                    </form>
                </div>

                <div className="glass-card" style={{ padding: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h2 style={{ fontSize: '1.2rem' }}>Lista de Estudiantes</h2>
                        <select
                            value={selectedSeccion}
                            onChange={e => setSelectedSeccion(e.target.value)}
                            className="glass-card"
                            style={{ padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.05)', color: 'white', border: 'none', outline: 'none' }}
                        >
                            {secciones.map(s => (
                                <option key={s.id} value={s.id} style={{ background: '#1e1b4b' }}>{s.nombre}</option>
                            ))}
                        </select>
                    </div>

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Cargando estudiantes...</div>
                    ) : students.length > 0 ? (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                <thead>
                                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--glass-border)' }}>
                                        <th style={{ padding: '1rem' }}>Cédula</th>
                                        <th style={{ padding: '1rem' }}>Nombre Completo</th>
                                        <th style={{ padding: '1rem' }}>Correo Institucional</th>
                                        <th style={{ padding: '1rem', textAlign: 'right' }}>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {students.map(student => (
                                        <tr key={student.cedula} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            <td style={{ padding: '1rem' }}>{student.cedula}</td>
                                            <td style={{ padding: '1rem' }}>{student.apellidos}, {student.nombre}</td>
                                            <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>{student.email}</td>
                                            <td style={{ padding: '1rem', textAlign: 'right' }}>
                                                <button
                                                    onClick={() => handleDeleteStudent(student.cedula)}
                                                    style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '1.1rem' }}
                                                    title="Eliminar Estudiante"
                                                >
                                                    🗑️
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                            No hay estudiantes en esta sección.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
