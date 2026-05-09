import React, { useState, useEffect } from 'react';
import { sqliteService } from '../lib/sqliteService';
import { useToast } from './Toast';
import { ExamenSummary } from './ExamenSummary';

interface Examen {
    id: number;
    nombre: string;
    seccion_id: string;
    porcentaje: number;
    puntos_totales: number;
    periodo: number;
}
interface IndicadorExamen {
    id: number;
    examen_id: number;
    titulo: string;
    orden: number;
    desc_0: string | null;
    desc_1: string | null;
    desc_2: string | null;
    desc_3: string | null;
}
interface Estudiante {
    cedula: string;
    nombre: string;
    apellidos: string;
    seccion_id: string;
}

interface Props {
    periodo: number;
}

export const ExamenesPage: React.FC<Props> = ({ periodo }) => {
    const [secciones, setSecciones] = useState<any[]>([]);
    const [selectedSeccion, setSelectedSeccion] = useState<string>('');
    const [examenes, setExamenes] = useState<Examen[]>([]);
    const [selectedExamen, setSelectedExamen] = useState<string>('');
    const [indicadores, setIndicadores] = useState<IndicadorExamen[]>([]);
    const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
    const [evaluaciones, setEvaluaciones] = useState<Record<string, Record<string, number>>>({});
    const [notasFinalesDirectas, setNotasFinalesDirectas] = useState<Record<string, string>>({});
    const [isLoadingData, setIsLoadingData] = useState(false);  // Solo para la tabla de evaluaciones
    const [isSaving, setIsSaving] = useState(false);             // Solo para guardar/crear
    const [showManager, setShowManager] = useState(false);
    const [showSummary, setShowSummary] = useState(false);
    const { showToast } = useToast();

    const [editNombre, setEditNombre] = useState('');
    const [editPorcentaje, setEditPorcentaje] = useState<number>(25);
    const [editPuntosTotales, setEditPuntosTotales] = useState<number>(30);
    const [editIndicadores, setEditIndicadores] = useState<{ titulo: string; d0: string; d1: string; d2: string; d3: string }[]>([]);

    useEffect(() => { fetchInitialData(); }, []);
    useEffect(() => {
        if (selectedSeccion) {
            fetchExamenes(selectedSeccion);
            fetchEstudiantes(selectedSeccion);
        }
    }, [selectedSeccion, periodo]);
    useEffect(() => {
        let isMounted = true;
        if (selectedExamen) {
            fetchIndicadoresAndEvaluations(selectedExamen, isMounted);
        } else {
            setIndicadores([]);
            setEvaluaciones({});
        }
        return () => { isMounted = false; };
    }, [selectedExamen]);

    async function fetchInitialData() {
        const { data } = await sqliteService.query('SELECT * FROM secciones ORDER BY nombre');
        setSecciones(data || []);
        if (data && data.length > 0) setSelectedSeccion(data[0].id);
    }

    async function fetchExamenes(seccionId: string) {
        const { data } = await sqliteService.query(
            'SELECT * FROM examenes WHERE seccion_id = ? AND periodo = ? ORDER BY id',
            [seccionId, periodo]
        );
        setExamenes(data || []);
        if (data && data.length > 0) setSelectedExamen(String(data[0].id));
        else setSelectedExamen('');
    }

    async function fetchEstudiantes(seccionId: string) {
        const { data } = await sqliteService.query(
            'SELECT * FROM estudiantes WHERE seccion_id = ? ORDER BY apellidos',
            [seccionId]
        );
        setEstudiantes(data || []);
    }

    async function fetchIndicadoresAndEvaluations(examenId: string, isMounted = true) {
        setIsLoadingData(true);
        try {
            const { data: indData } = await sqliteService.query(
                'SELECT * FROM indicadores_examen WHERE examen_id = ? ORDER BY orden',
                [parseInt(examenId)]
            );
            if (!isMounted) return;
            setIndicadores(indData || []);

            const indIds: number[] = (indData || []).map((i: IndicadorExamen) => i.id);
            if (indIds.length > 0) {
                const { data: evalData } = await sqliteService.from('evaluaciones_examen').selectIn('*', 'indicador_id', indIds);
                if (!isMounted) return;
                const evalMap: Record<string, Record<string, number>> = {};
                (evalData || []).forEach((ev: any) => {
                    if (!evalMap[ev.estudiante_id]) evalMap[ev.estudiante_id] = {};
                    evalMap[ev.estudiante_id][ev.indicador_id] = ev.puntaje || 0;
                });
                setEvaluaciones(evalMap);
            } else {
                setEvaluaciones({});
            }
        } finally {
            if (isMounted) setIsLoadingData(false);
        }
    }

    const handleScoreChange = (estudianteId: string, indicadorId: number, value: string) => {
        const parsed = parseInt(value);
        const score = isNaN(parsed) ? 0 : Math.max(0, Math.min(3, parsed));
        setEvaluaciones(prev => ({
            ...prev,
            [estudianteId]: { ...(prev[estudianteId] || {}), [indicadorId]: score }
        }));
    };

    const handleNotaFinalDirecta = (estudianteId: string, value: string) => {
        setNotasFinalesDirectas(prev => ({ ...prev, [estudianteId]: value }));
    };

    const handleToggleAllScores = (estudianteId: string) => {
        setEvaluaciones(prev => {
            const studentEvals = prev[estudianteId] || {};
            const allAreThree = indicadores.length > 0 && indicadores.every(ind => studentEvals[String(ind.id)] === 3);
            const newScore = allAreThree ? 0 : 3;
            const updated = { ...studentEvals };
            indicadores.forEach(ind => { updated[String(ind.id)] = newScore; });
            return { ...prev, [estudianteId]: updated };
        });
    };

    const calculateGrades = (estudianteId: string) => {
        const currentExamen = examenes.find(e => String(e.id) === selectedExamen);
        if (!currentExamen) return { nota: 0, obtenido: 0 };

        // Si hay nota final directa, usarla
        const notaDirectaStr = notasFinalesDirectas[estudianteId];
        if (notaDirectaStr !== undefined && notaDirectaStr !== '') {
            const notaDirecta = Math.max(0, Math.min(100, parseFloat(notaDirectaStr) || 0));
            const obtenido = Number(((notaDirecta / 100) * currentExamen.porcentaje).toFixed(2));
            return { nota: notaDirecta, obtenido };
        }

        if (indicadores.length === 0) return { nota: 0, obtenido: 0 };
        const studentEvals = evaluaciones[estudianteId] || {};
        const points = indicadores.reduce((acc, ind) => acc + (studentEvals[String(ind.id)] || 0), 0);
        const nota = Math.round((points / currentExamen.puntos_totales) * 100) || 0;
        const obtenido = Number(((nota / 100) * currentExamen.porcentaje).toFixed(2));
        return { nota, obtenido };
    };

    async function saveEvaluations() {
        setIsSaving(true);
        try {
            const upsertData: Record<string, any>[] = [];
            estudiantes.forEach(est => {
                const estEvals = evaluaciones[est.cedula] || {};
                indicadores.forEach(ind => {
                    if (estEvals[ind.id] !== undefined) {
                        upsertData.push({ estudiante_id: est.cedula, indicador_id: ind.id, puntaje: estEvals[ind.id] });
                    }
                });
            });

            if (upsertData.length > 0) {
                const { success, error } = await sqliteService.from('evaluaciones_examen').upsert(
                    upsertData,
                    { onConflict: 'estudiante_id, indicador_id' }
                );
                if (!success) throw new Error(error || 'Error al guardar');
            }
            showToast('Evaluaciones de examen guardadas', 'success');
        } catch (error: any) {
            showToast(`Error: ${error.message}`, 'error');
        } finally { setIsSaving(false); }
    }

    const handleNewExamen = () => {
        setEditNombre('');
        setEditPorcentaje(25);
        setEditPuntosTotales(30);
        setEditIndicadores([{ titulo: '', d0: '', d1: '', d2: '', d3: '' }, { titulo: '', d0: '', d1: '', d2: '', d3: '' }]);
        setShowManager(true);
    };

    async function createExamen() {
        if (!editNombre) return;
        setIsSaving(true);
        try {
            const { data: nuevoExamen, error: eError } = await sqliteService.from('examenes').insertReturning({
                nombre: editNombre,
                seccion_id: selectedSeccion,
                porcentaje: editPorcentaje,
                puntos_totales: editPuntosTotales,
                periodo: periodo
            });
            if (eError || !nuevoExamen) throw new Error(eError || 'No se pudo crear el examen');

            const { success, error: indError } = await sqliteService.transaction(
                editIndicadores.map((ind, idx) => ({
                    sql: 'INSERT INTO indicadores_examen (examen_id, titulo, orden, desc_0, desc_1, desc_2, desc_3) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    params: [nuevoExamen.id, ind.titulo, idx + 1, ind.d0, ind.d1, ind.d2, ind.d3]
                }))
            );
            if (!success) throw new Error(indError || 'Error al insertar indicadores');

            showToast('Examen configurado correctamente', 'success');
            setShowManager(false);
            fetchExamenes(selectedSeccion);
        } catch (error: any) {
            showToast(`Error: ${error.message}`, 'error');
        } finally { setIsSaving(false); }
    }

    async function handleDeleteExamen() {
        if (!selectedExamen) return;
        if (!confirm('¿Estás seguro de eliminar este examen y todas sus notas?')) return;
        const { error } = await sqliteService.from('examenes').delete('id', parseInt(selectedExamen));
        if (!error) {
            showToast('Examen eliminado', 'success');
            fetchExamenes(selectedSeccion);
        } else {
            showToast(`Error al eliminar: ${error}`, 'error');
        }
    }

    return (
        <div className="examenes-page">
            <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Exámenes</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Gestión y calificación de pruebas o evaluaciones sumativas.</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <select
                        value={selectedSeccion}
                        onChange={e => setSelectedSeccion(e.target.value)}
                        className="glass-card"
                        style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.05)', color: 'white', border: 'none' }}
                    >
                        {secciones.map(s => <option key={s.id} value={s.id} style={{ background: '#1e1b4b' }}>{s.nombre}</option>)}
                    </select>
                    <button onClick={() => setShowSummary(true)} className="btn-primary" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid var(--glass-border)' }}>
                        📊 Resumen de Notas
                    </button>
                    <button onClick={handleNewExamen} className="btn-primary" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid var(--glass-border)' }}>
                        ➕ Configurar Examen
                    </button>
                </div>
            </header>

            {!showManager ? (
                <div className="evaluation-view">
                    <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <label style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--primary)' }}>CALIFICAR:</label>
                                <select
                                    value={selectedExamen}
                                    onChange={e => setSelectedExamen(e.target.value)}
                                    className="glass-card"
                                    style={{ padding: '0.6rem 1.5rem', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid var(--primary)', fontSize: '1rem', fontWeight: 'bold', minWidth: '250px' }}
                                >
                                    {examenes.map(e => <option key={e.id} value={e.id} style={{ background: '#1e1b4b' }}>{e.nombre} ({e.porcentaje}%)</option>)}
                                    {examenes.length === 0 && <option value="">No hay exámenes creados</option>}
                                </select>
                            </div>
                            {selectedExamen && (
                                <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.9rem' }}>
                                    <div style={{ color: 'var(--primary)' }}><strong>Puntos Totales:</strong> {examenes.find(e => String(e.id) === selectedExamen)?.puntos_totales}</div>
                                    <div style={{ color: 'var(--primary)' }}><strong>Valor:</strong> {examenes.find(e => String(e.id) === selectedExamen)?.porcentaje}%</div>
                                </div>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button onClick={saveEvaluations} disabled={isSaving || !selectedExamen} className="btn-primary">
                                {isSaving ? '⌛ Guardando...' : '💾 Guardar Notas'}
                            </button>
                            {selectedExamen && (
                                <button onClick={handleDeleteExamen} className="btn-primary" style={{ background: 'var(--danger)', opacity: 0.8 }}>
                                    🗑️ Eliminar
                                </button>
                            )}
                        </div>
                    </div>

                    {isLoadingData && (
                        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                            ⌛ Cargando evaluaciones...
                        </div>
                    )}
                    {!isLoadingData && selectedExamen && (
                        <div className="glass-card" style={{ overflowX: 'auto', padding: '0' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--glass-border)' }}>
                                        <th style={{ textAlign: 'left', padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)', position: 'sticky', left: 0, zIndex: 10, background: '#111827', minWidth: '200px' }}>Estudiante</th>
                                        <th style={{ textAlign: 'center', padding: '0.5rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>M/M</th>
                                        {indicadores.map((ind, idx) => (
                                            <th key={ind.id} style={{ textAlign: 'center', padding: '0.5rem 0.2rem', fontSize: '0.7rem', width: '45px', minWidth: '45px', maxWidth: '45px' }} title={ind.titulo}>
                                                I{idx + 1}
                                                <div style={{ fontSize: '0.55rem', fontWeight: 400, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '40px' }}>{ind.titulo}</div>
                                            </th>
                                        ))}
                                        <th style={{ textAlign: 'center', padding: '0.5rem', fontSize: '0.7rem', color: '#facc15', fontWeight: 700 }}>DIR.</th>
                                        <th style={{ textAlign: 'center', padding: '0.5rem', fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 700 }}>NOTA</th>
                                        <th style={{ textAlign: 'center', padding: '0.5rem', fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 700 }}>%</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {estudiantes.map(est => {
                                        const { nota, obtenido } = calculateGrades(est.cedula);
                                        const studentEvals = evaluaciones[est.cedula] || {};
                                        const allAreThree = indicadores.length > 0 && indicadores.every(ind => studentEvals[ind.id] === 3);
                                        const notaDirecta = notasFinalesDirectas[est.cedula] ?? '';
                                        const tieneNotaDirecta = notaDirecta !== '';
                                        return (
                                            <tr key={est.cedula} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: tieneNotaDirecta ? 'rgba(250,204,21,0.03)' : 'transparent' }}>
                                                <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', position: 'sticky', left: 0, zIndex: 5, background: tieneNotaDirecta ? '#1a180e' : '#111827', whiteSpace: 'nowrap', borderRight: '1px solid rgba(255,255,255,0.05)' }}>{est.apellidos}, {est.nombre}</td>
                                                <td style={{ textAlign: 'center', padding: '0.25rem' }}>
                                                    <button onClick={() => handleToggleAllScores(est.cedula)} style={{ fontSize: '8px', padding: '4px 6px', borderRadius: '6px', background: allAreThree ? 'var(--danger)' : 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>{allAreThree ? 'MIN' : 'MAX'}</button>
                                                </td>
                                                {indicadores.map(ind => {
                                                    const score = evaluaciones[est.cedula]?.[String(ind.id)] ?? 0;
                                                    return (
                                                        <td key={ind.id} style={{ textAlign: 'center', padding: '0.25rem' }}>
                                                            <input
                                                                type="number"
                                                                min={0}
                                                                max={3}
                                                                value={score}
                                                                onChange={e => handleScoreChange(est.cedula, ind.id, e.target.value)}
                                                                title={`${ind.titulo} (0-3)`}
                                                                style={{
                                                                    width: '38px',
                                                                    textAlign: 'center',
                                                                    background: 'rgba(255,255,255,0.07)',
                                                                    border: '1px solid rgba(99,102,241,0.3)',
                                                                    borderRadius: '6px',
                                                                    color: 'white',
                                                                    fontSize: '0.85rem',
                                                                    fontWeight: 700,
                                                                    padding: '4px 0',
                                                                    outline: 'none'
                                                                }}
                                                            />
                                                        </td>
                                                    );
                                                })}
                                                <td style={{ textAlign: 'center', padding: '0.25rem' }}>
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        max={100}
                                                        placeholder="—"
                                                        value={notaDirecta}
                                                        onChange={e => handleNotaFinalDirecta(est.cedula, e.target.value)}
                                                        title="Nota Final Directa (sobreescribe indicadores)"
                                                        style={{
                                                            width: '46px',
                                                            textAlign: 'center',
                                                            background: tieneNotaDirecta ? 'rgba(250,204,21,0.15)' : 'rgba(255,255,255,0.05)',
                                                            border: `1px solid ${tieneNotaDirecta ? '#facc15' : 'rgba(255,255,255,0.1)'}`,
                                                            borderRadius: '6px',
                                                            color: tieneNotaDirecta ? '#facc15' : 'var(--text-muted)',
                                                            fontSize: '0.85rem',
                                                            fontWeight: 700,
                                                            padding: '4px 0',
                                                            outline: 'none'
                                                        }}
                                                    />
                                                </td>
                                                <td style={{ textAlign: 'center', fontWeight: 700, color: nota >= 70 ? 'var(--primary)' : 'var(--danger)', fontSize: '0.85rem' }}>{nota}%</td>
                                                <td style={{ textAlign: 'center', fontWeight: 700, color: nota >= 70 ? 'var(--primary)' : 'var(--danger)', fontSize: '0.85rem' }}>{obtenido}%</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            ) : (
                <div className="manager-view glass-card" style={{ padding: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                        <h2>Configurar Examen</h2>
                        <button onClick={() => setShowManager(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>✕ Cancelar</button>
                    </div>

                    <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
                        <div style={{ gridColumn: 'span 2' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Nombre del Examen</label>
                            <input type="text" value={editNombre} onChange={e => setEditNombre(e.target.value)} className="glass-card" style={{ width: '100%', padding: '1rem', background: 'rgba(255,255,255,0.05)', color: 'white', border: 'none' }} placeholder="Ej: Primer Examen Trimestral" />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Valor Porcentual (%)</label>
                            <input type="number" step="0.5" value={editPorcentaje} onChange={e => setEditPorcentaje(parseFloat(e.target.value))} className="glass-card" style={{ width: '100%', padding: '1rem', background: 'rgba(255,255,255,0.05)', color: 'white', border: 'none' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Puntos Totales</label>
                            <input type="number" value={editPuntosTotales} onChange={e => setEditPuntosTotales(parseInt(e.target.value))} className="glass-card" style={{ width: '100%', padding: '1rem', background: 'rgba(255,255,255,0.05)', color: 'white', border: 'none' }} />
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {editIndicadores.map((ind, idx) => (
                            <div key={idx} className="glass-card" style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.02)' }}>
                                <div style={{ marginBottom: '1rem', fontWeight: 600, color: 'var(--primary)' }}>Indicador I{idx + 1}</div>
                                <input type="text" placeholder="Título del indicador..." value={ind.titulo} onChange={e => { const n = [...editIndicadores]; n[idx].titulo = e.target.value; setEditIndicadores(n); }} className="glass-card" style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', background: 'rgba(255,255,255,0.05)', color: 'white', border: 'none' }} />
                                <div className="grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                                    {[0, 1, 2, 3].map(level => (
                                        <div key={level}>
                                            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Nivel {level}</label>
                                            <textarea value={(ind as any)[`d${level}`]} onChange={e => { const n = [...editIndicadores]; (n[idx] as any)[`d${level}`] = e.target.value; setEditIndicadores(n); }} className="glass-card" style={{ width: '100%', height: '50px', padding: '0.5rem', background: 'rgba(255,255,255,0.02)', color: 'white', border: 'none', fontSize: '0.8rem' }} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
                        {editIndicadores.length < 5 && <button onClick={() => setEditIndicadores([...editIndicadores, { titulo: '', d0: '', d1: '', d2: '', d3: '' }])} className="btn-primary" style={{ background: 'rgba(255,255,255,0.1)' }}>➕ Añadir Indicador</button>}
                        <button onClick={createExamen} disabled={isSaving} className="btn-primary">{isSaving ? '⌛ Guardando...' : '✅ Finalizar Configuración'}</button>
                    </div>
                </div>
            )}

            {showSummary && selectedSeccion && (
                <ExamenSummary
                    seccionId={selectedSeccion}
                    periodo={periodo}
                    onClose={() => setShowSummary(false)}
                />
            )}
        </div>
    );
};
