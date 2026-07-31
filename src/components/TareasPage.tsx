import React, { useState, useEffect } from 'react';
import { sqliteService } from '../lib/sqliteService';
import { useToast } from './Toast';
import { TareaSummary } from './TareaSummary';
import { formatDateToLocal } from '../lib/utils';

interface Tarea {
    id: number;
    nombre: string;
    seccion_id: string;
    porcentaje: number;
    puntos_totales: number;
    periodo: number;
}
interface IndicadorTarea {
    id: number;
    tarea_id: number;
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

export const TareasPage: React.FC<Props> = ({ periodo }) => {
    const [secciones, setSecciones] = useState<any[]>([]);
    const [selectedSeccion, setSelectedSeccion] = useState<string>('');
    const [tareas, setTareas] = useState<Tarea[]>([]);
    const [selectedTarea, setSelectedTarea] = useState<string>('');
    const [indicadores, setIndicadores] = useState<IndicadorTarea[]>([]);
    const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
    const [evaluaciones, setEvaluaciones] = useState<Record<string, Record<string, number>>>({});
    const [notasFinalesDirectas, setNotasFinalesDirectas] = useState<Record<string, string>>({});
    const [isLoadingData, setIsLoadingData] = useState(false);  // Solo para la tabla de evaluaciones
    const [isSaving, setIsSaving] = useState(false);             // Solo para guardar/crear
    const [showManager, setShowManager] = useState(false);
    const [showSummary, setShowSummary] = useState(false);
    const { showToast } = useToast();

    const [editNombre, setEditNombre] = useState('');
    const [editPorcentaje, setEditPorcentaje] = useState<number>(2.5);
    const [editPuntosTotales, setEditPuntosTotales] = useState<number>(10);
    const [editIndicadores, setEditIndicadores] = useState<{ titulo: string; d0: string; d1: string; d2: string; d3: string }[]>([]);

    useEffect(() => { fetchInitialData(); }, []);
    useEffect(() => {
        if (selectedSeccion) {
            fetchTareas(selectedSeccion);
            fetchEstudiantes(selectedSeccion);
        }
    }, [selectedSeccion, periodo]);
    useEffect(() => {
        let isMounted = true;
        if (selectedTarea) {
            fetchIndicadoresAndEvaluations(selectedTarea, isMounted);
        } else {
            setIndicadores([]);
            setEvaluaciones({});
        }
        return () => { isMounted = false; };
    }, [selectedTarea]);

    async function fetchInitialData() {
        const { data } = await sqliteService.query('SELECT * FROM secciones ORDER BY nombre');
        setSecciones(data || []);
        if (data && data.length > 0) setSelectedSeccion(data[0].id);
    }

    async function fetchTareas(seccionId: string) {
        const { data } = await sqliteService.query(
            'SELECT * FROM tareas WHERE seccion_id = ? AND periodo = ? ORDER BY id',
            [seccionId, periodo]
        );
        setTareas(data || []);
        if (data && data.length > 0) setSelectedTarea(String(data[0].id));
        else setSelectedTarea('');
    }

    async function fetchEstudiantes(seccionId: string) {
        const { data } = await sqliteService.query(
            'SELECT * FROM estudiantes WHERE seccion_id = ? ORDER BY apellidos',
            [seccionId]
        );
        setEstudiantes(data || []);
    }

    async function fetchIndicadoresAndEvaluations(tareaId: string, isMounted = true) {
        setIsLoadingData(true);
        try {
            const { data: indData } = await sqliteService.query(
                'SELECT * FROM indicadores_tarea WHERE tarea_id = ? ORDER BY orden',
                [parseInt(tareaId)]
            );
            if (!isMounted) return;
            setIndicadores(indData || []);

            const indIds: number[] = (indData || []).map((i: IndicadorTarea) => i.id);
            
            // Load direct grades
            const { data: directNotesData } = await sqliteService.from('notas_directas_tarea').selectWhere('*', 'tarea_id', parseInt(tareaId));
            if (isMounted) {
                const directNotesMap: Record<string, string> = {};
                (directNotesData || []).forEach((n: any) => {
                    directNotesMap[n.estudiante_id] = String(n.nota);
                });
                setNotasFinalesDirectas(directNotesMap);
            }

            if (indIds.length > 0) {
                const { data: evalData } = await sqliteService.from('evaluaciones_tarea').selectIn('*', 'indicador_id', indIds);
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

        // Si el usuario cambia manualmente un indicador, eliminamos el override de nota directa
        if (notasFinalesDirectas[estudianteId]) {
            setNotasFinalesDirectas(prev => {
                const updated = { ...prev };
                delete updated[estudianteId];
                return updated;
            });
        }
    };

    const handleNotaFinalDirecta = (estudianteId: string, value: string) => {
        // Validar que la nota esté entre 0 y 100
        let val = value;
        if (value !== '') {
            const num = parseFloat(value);
            if (isNaN(num)) val = '';
            else if (num < 0) val = '0';
            else if (num > 100) val = '100';
            else val = String(num);
        }

        setNotasFinalesDirectas(prev => ({ ...prev, [estudianteId]: val }));
        
        // If a direct note is entered, clear the indicator scores to avoid confusion
        if (val !== '') {
            setEvaluaciones(prev => {
                const updated = { ...(prev[estudianteId] || {}) };
                indicadores.forEach(ind => {
                    updated[String(ind.id)] = 0;
                });
                return { ...prev, [estudianteId]: updated };
            });
        }
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

        // Al usar el botón MAX/MIN, también eliminamos el override de nota directa
        if (notasFinalesDirectas[estudianteId]) {
            setNotasFinalesDirectas(prev => {
                const updated = { ...prev };
                delete updated[estudianteId];
                return updated;
            });
        }
    };

    const calculateGrades = (estudianteId: string) => {
        const currentTarea = tareas.find(t => String(t.id) === selectedTarea);
        if (!currentTarea) return { nota: 0, obtenido: 0 };

        // Si hay nota final directa, usarla
        const notaDirectaStr = notasFinalesDirectas[estudianteId];
        if (notaDirectaStr !== undefined && notaDirectaStr !== '') {
            const notaDirecta = Math.max(0, Math.min(100, parseFloat(notaDirectaStr) || 0));
            const obtenido = Number(((notaDirecta / 100) * currentTarea.porcentaje).toFixed(2));
            return { nota: notaDirecta, obtenido };
        }

        if (indicadores.length === 0) return { nota: 0, obtenido: 0 };
        const studentEvals = evaluaciones[estudianteId] || {};
        const points = indicadores.reduce((acc, ind) => acc + (studentEvals[String(ind.id)] || 0), 0);
        const nota = Math.round((points / currentTarea.puntos_totales) * 100) || 0;
        const obtenido = Number(((nota / 100) * currentTarea.porcentaje).toFixed(2));
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
                const { success, error } = await sqliteService.from('evaluaciones_tarea').upsert(
                    upsertData,
                    { onConflict: 'estudiante_id, indicador_id' }
                );
                if (!success) throw new Error(error || 'Error al guardar evaluaciones');
            }

            // Save direct grades
            const directNotesData: any[] = [];
            Object.entries(notasFinalesDirectas).forEach(([cedula, nota]) => {
                if (nota !== '') {
                    directNotesData.push({
                        id: `dn-t-${selectedTarea}-${cedula}`,
                        tarea_id: parseInt(selectedTarea),
                        estudiante_id: cedula,
                        nota: parseFloat(nota)
                    });
                }
            });

            // Delete direct notes that were cleared
            const studentsToClear = estudiantes
                .filter(est => !notasFinalesDirectas[est.cedula] || notasFinalesDirectas[est.cedula] === '')
                .map(est => est.cedula);
            
            if (studentsToClear.length > 0) {
                await sqliteService.query(
                    `DELETE FROM notas_directas_tarea WHERE tarea_id = ? AND estudiante_id IN (${studentsToClear.map(() => '?').join(',')})`,
                    [parseInt(selectedTarea), ...studentsToClear]
                );
            }

            if (directNotesData.length > 0) {
                const { success, error } = await sqliteService.from('notas_directas_tarea').upsert(
                    directNotesData,
                    { onConflict: 'id' }
                );
                if (!success) throw new Error(error || 'Error al guardar notas directas');
            }

            showToast('Evaluaciones de tarea guardadas', 'success');
        } catch (error: any) {
            showToast(`Error: ${error.message}`, 'error');
        } finally { setIsSaving(false); }
    }

    const handleNewTarea = () => {
        setEditNombre('');
        setEditPorcentaje(2.5);
        setEditPuntosTotales(10);
        setEditIndicadores([{ titulo: '', d0: '', d1: '', d2: '', d3: '' }, { titulo: '', d0: '', d1: '', d2: '', d3: '' }]);
        setShowManager(true);
    };

    async function createTarea() {
        if (!editNombre) return;
        setIsSaving(true);
        try {
            // 1. Insertar tarea y obtener ID
            const localDate = new Date().toLocaleDateString('en-CA');
            const { data: nuevaTarea, error: tError } = await sqliteService.from('tareas').insertReturning({
                nombre: editNombre,
                seccion_id: selectedSeccion,
                porcentaje: editPorcentaje,
                puntos_totales: editPuntosTotales,
                periodo: periodo,
                fecha: localDate
            });
            if (tError || !nuevaTarea) throw new Error(tError || 'No se pudo crear la tarea');

            // 2. Insertar indicadores en transacción
            const { success, error: indError } = await sqliteService.transaction(
                editIndicadores.map((ind, idx) => ({
                    sql: 'INSERT INTO indicadores_tarea (tarea_id, titulo, orden, desc_0, desc_1, desc_2, desc_3) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    params: [nuevaTarea.id, ind.titulo, idx + 1, ind.d0, ind.d1, ind.d2, ind.d3]
                }))
            );
            if (!success) throw new Error(indError || 'Error al insertar indicadores');

            showToast('Tarea creada correctamente', 'success');
            setShowManager(false);
            fetchTareas(selectedSeccion);
        } catch (error: any) {
            showToast(`Error: ${error.message}`, 'error');
        } finally { setIsSaving(false); }
    }

    async function handleDeleteTarea() {
        if (!selectedTarea) return;
        if (!confirm('¿Estás seguro de eliminar esta tarea y todas sus notas?')) return;
        const { error } = await sqliteService.from('tareas').delete('id', parseInt(selectedTarea));
        if (error) {
            showToast(`Error al eliminar: ${error}`, 'error');
        } else {
            showToast('Tarea eliminada correctamente', 'success');
            fetchTareas(selectedSeccion);
        }
    }

    return (
        <div className="tareas-page">
            <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Tareas</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Calificación de tareas con rúbrica y porcentaje personalizado.</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <select
                        value={selectedSeccion}
                        onChange={e => setSelectedSeccion(e.target.value)}
                        className="glass-card"
                        style={{ height: '44px', padding: '0.5rem 1rem', background: 'rgba(0,0,0,0.02)', color: 'var(--text-main)', border: '1px solid var(--glass-border)', outline: 'none' }}
                    >
                        {secciones.map(s => <option key={s.id} value={s.id} style={{ background: 'var(--glass-bg)', color: 'var(--text-main)' }}>{s.nombre}</option>)}
                    </select>
                    <button onClick={() => setShowSummary(true)} className="btn-primary" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid var(--glass-border)' }}>
                        📊 Resumen de Notas
                    </button>
                    <button onClick={handleNewTarea} className="btn-primary" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid var(--glass-border)' }}>
                        ➕ Nueva Tarea
                    </button>
                </div>
            </header>

            {!showManager ? (
                <div className="evaluation-view">
                    <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3rem', flex: 1, marginRight: '2rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <label style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Seleccionar Tarea:</label>
                                <select
                                    value={selectedTarea}
                                    onChange={e => setSelectedTarea(e.target.value)}
                                    className="glass-card"
                                    style={{ height: '44px', padding: '0.5rem 1rem', background: 'rgba(0,0,0,0.02)', color: 'var(--text-main)', border: '1px solid var(--glass-border)', outline: 'none' }}
                                >
                                    {tareas.map(t => <option key={t.id} value={t.id} style={{ background: 'var(--glass-bg)', color: 'var(--text-main)' }}>{t.nombre} ({t.porcentaje}%) - {formatDateToLocal((t as any).fecha)}</option>)}
                                    {tareas.length === 0 && <option value="">No hay tareas creadas</option>}
                                </select>
                            </div>
                            {selectedTarea && (
                                <div style={{ display: 'flex', gap: '2.5rem', fontSize: '0.9rem' }}>
                                    <div style={{ color: 'var(--primary)' }}><strong>Puntos Totales:</strong> {tareas.find(t => String(t.id) === selectedTarea)?.puntos_totales}</div>
                                    <div style={{ color: 'var(--primary)' }}><strong>Valor:</strong> {tareas.find(t => String(t.id) === selectedTarea)?.porcentaje}%</div>
                                </div>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button onClick={saveEvaluations} disabled={isSaving || !selectedTarea} className="btn-primary">
                                {isSaving ? '⌛ Guardando...' : '💾 Guardar Notas'}
                            </button>
                            {selectedTarea && (
                                <button onClick={handleDeleteTarea} className="btn-primary" style={{ background: 'var(--danger)', opacity: 0.8 }}>
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
                    {!isLoadingData && selectedTarea && (
                        <div className="glass-card" style={{ overflowX: 'auto', padding: '0' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: 'rgba(0,0,0,0.01)', borderBottom: '1px solid var(--glass-border)' }}>
                                        <th style={{ textAlign: 'left', padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)', position: 'sticky', left: 0, zIndex: 10, background: 'var(--glass-bg)', minWidth: '200px' }}>Estudiante</th>
                                        <th style={{ textAlign: 'center', padding: '0.5rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>M/M</th>
                                        {indicadores.map((ind, idx) => (
                                            <th key={ind.id} style={{ textAlign: 'center', padding: '0.5rem 0.2rem', fontSize: '0.7rem', width: '45px', minWidth: '45px', maxWidth: '45px' }} title={ind.titulo}>
                                                I{idx + 1}
                                                <div style={{ fontSize: '0.55rem', fontWeight: 400, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '40px' }}>{ind.titulo}</div>
                                            </th>
                                        ))}
                                        <th style={{ textAlign: 'center', padding: '0.5rem', fontSize: '0.7rem', color: '#ca8a04', fontWeight: 700 }}>NOTA FINAL</th>
                                        <th style={{ textAlign: 'center', padding: '0.5rem', fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 700 }}>CALIF.</th>
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
                                            <tr key={est.cedula} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: tieneNotaDirecta ? 'rgba(250,204,21,0.05)' : 'transparent' }}>
                                                <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', position: 'sticky', left: 0, zIndex: 5, background: tieneNotaDirecta ? '#fef9c3' : 'var(--glass-bg)', color: 'var(--text-main)', whiteSpace: 'nowrap', borderRight: '1px solid rgba(0,0,0,0.05)' }}>{est.apellidos}, {est.nombre}</td>
                                                <td style={{ textAlign: 'center', padding: '0.25rem' }}>
                                                    <button onClick={() => handleToggleAllScores(est.cedula)} style={{ fontSize: '10px', minHeight: '44px', padding: '0.25rem 0.5rem', borderRadius: '8px', background: allAreThree ? 'var(--danger)' : 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>{allAreThree ? 'MIN' : 'MAX'}</button>
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
                                                                    width: '48px',
                                                                    height: '44px',
                                                                    textAlign: 'center',
                                                                    background: 'rgba(0,0,0,0.03)',
                                                                    border: '1px solid var(--glass-border)',
                                                                    borderRadius: '8px',
                                                                    color: 'var(--text-main)',
                                                                    fontSize: '1rem',
                                                                    fontWeight: 700,
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
                                                        title="Nota Final Directa (sobreescribe rúbrica)"
                                                        style={{
                                                            width: '54px',
                                                            height: '44px',
                                                            textAlign: 'center',
                                                            background: tieneNotaDirecta ? 'rgba(250,204,21,0.15)' : 'rgba(0,0,0,0.03)',
                                                            border: `1px solid ${tieneNotaDirecta ? '#ca8a04' : 'var(--glass-border)'}`,
                                                            borderRadius: '8px',
                                                            color: tieneNotaDirecta ? '#ca8a04' : 'var(--text-main)',
                                                            fontSize: '1rem',
                                                            fontWeight: 700,
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
                        <h2>Nueva Tarea</h2>
                        <button onClick={() => setShowManager(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}>✕ Cancelar</button>
                    </div>

                    <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
                        <div style={{ gridColumn: 'span 2' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Nombre de la Tarea</label>
                            <input type="text" value={editNombre} onChange={e => setEditNombre(e.target.value)} className="glass-card" style={{ width: '100%', height: '44px', padding: '0.75rem 1rem', background: 'rgba(0,0,0,0.02)', color: 'var(--text-main)', border: '1px solid var(--glass-border)' }} placeholder="Ej: Tarea 1 - Investigación" />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Valor Porcentual (%)</label>
                            <input type="number" step="0.5" value={editPorcentaje} onChange={e => setEditPorcentaje(parseFloat(e.target.value))} className="glass-card" style={{ width: '100%', height: '44px', padding: '0.75rem 1rem', background: 'rgba(0,0,0,0.02)', color: 'var(--text-main)', border: '1px solid var(--glass-border)' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Puntos Totales</label>
                            <input type="number" value={editPuntosTotales} onChange={e => setEditPuntosTotales(parseInt(e.target.value))} className="glass-card" style={{ width: '100%', height: '44px', padding: '0.75rem 1rem', background: 'rgba(0,0,0,0.02)', color: 'var(--text-main)', border: '1px solid var(--glass-border)' }} />
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {editIndicadores.map((ind, idx) => (
                            <div key={idx} className="glass-card" style={{ padding: '1.5rem', background: 'rgba(0,0,0,0.01)' }}>
                                <div style={{ marginBottom: '1rem', fontWeight: 600, color: 'var(--primary)' }}>Indicador I{idx + 1}</div>
                                <input type="text" placeholder="Título del indicador..." value={ind.titulo} onChange={e => { const n = [...editIndicadores]; n[idx].titulo = e.target.value; setEditIndicadores(n); }} className="glass-card" style={{ width: '100%', height: '44px', padding: '0.75rem', marginBottom: '1rem', background: 'rgba(0,0,0,0.02)', color: 'var(--text-main)', border: '1px solid var(--glass-border)' }} />
                                <div className="grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                                    {[0, 1, 2, 3].map(level => (
                                        <div key={level}>
                                            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Nivel {level}</label>
                                            <textarea value={(ind as any)[`d${level}`]} onChange={e => { const n = [...editIndicadores]; (n[idx] as any)[`d${level}`] = e.target.value; setEditIndicadores(n); }} className="glass-card" style={{ width: '100%', height: '50px', padding: '0.5rem', background: 'rgba(0,0,0,0.02)', color: 'var(--text-main)', border: '1px solid var(--glass-border)', fontSize: '0.8rem' }} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
                        {editIndicadores.length < 5 && <button onClick={() => setEditIndicadores([...editIndicadores, { titulo: '', d0: '', d1: '', d2: '', d3: '' }])} className="btn-primary" style={{ background: 'rgba(255,255,255,0.1)' }}>➕ Añadir Indicador</button>}
                        <button onClick={createTarea} disabled={isSaving} className="btn-primary">{isSaving ? '⌛ Creando...' : '✅ Crear Tarea y Rúbrica'}</button>
                    </div>
                </div>
            )}

            {showSummary && selectedSeccion && (
                <TareaSummary
                    seccionId={selectedSeccion}
                    periodo={periodo}
                    onClose={() => setShowSummary(false)}
                />
            )}
        </div>
    );
};
