import React, { useState, useEffect } from 'react';
import { sqliteService } from '../lib/sqliteService';
import { useToast } from './Toast';
import { CotidianoSummary } from './CotidianoSummary';

interface Trabajo {
    id: number;
    nombre: string;
    seccion_id: string;
    periodo: number;
}
interface Indicador {
    id: number;
    trabajo_id: number;
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

export const TrabajoCotidianoPage: React.FC<Props> = ({ periodo }) => {
    const [secciones, setSecciones] = useState<any[]>([]);
    const [selectedSeccion, setSelectedSeccion] = useState<string>('');
    const [trabajos, setTrabajos] = useState<Trabajo[]>([]);
    const [selectedTrabajo, setSelectedTrabajo] = useState<string>('');
    const [indicadores, setIndicadores] = useState<Indicador[]>([]);
    const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
    const [evaluaciones, setEvaluaciones] = useState<Record<string, Record<string, number>>>({}); // cedula -> indicador_id -> puntaje
    const [notasFinalesDirectas, setNotasFinalesDirectas] = useState<Record<string, string>>({});
    const [isLoadingData, setIsLoadingData] = useState(false);  // Solo para la tabla de evaluaciones
    const [isSaving, setIsSaving] = useState(false);             // Solo para guardar/crear
    const [showManager, setShowManager] = useState(false);
    const [showSummary, setShowSummary] = useState(false);
    const { showToast } = useToast();

    // Estado del formulario de nueva rúbrica
    const [editNombre, setEditNombre] = useState('');
    const [editIndicadores, setEditIndicadores] = useState<{ titulo: string; d0: string; d1: string; d2: string; d3: string }[]>([]);

    useEffect(() => { fetchInitialData(); }, []);
    useEffect(() => {
        if (selectedSeccion) {
            fetchTrabajos(selectedSeccion);
            fetchEstudiantes(selectedSeccion);
        }
    }, [selectedSeccion, periodo]);
    useEffect(() => {
        let isMounted = true;
        if (selectedTrabajo) {
            fetchIndicadoresAndEvaluations(selectedTrabajo, isMounted);
        } else {
            setIndicadores([]);
            setEvaluaciones({});
        }
        return () => { isMounted = false; };
    }, [selectedTrabajo]);

    async function fetchInitialData() {
        const { data } = await sqliteService.query('SELECT * FROM secciones ORDER BY nombre');
        setSecciones(data || []);
        if (data && data.length > 0) setSelectedSeccion(data[0].id);
    }

    async function fetchTrabajos(seccionId: string) {
        const { data } = await sqliteService.query(
            'SELECT * FROM trabajos_cotidianos WHERE seccion_id = ? AND periodo = ? ORDER BY id',
            [seccionId, periodo]
        );
        setTrabajos(data || []);
        if (data && data.length > 0) setSelectedTrabajo(String(data[0].id));
        else setSelectedTrabajo('');
    }

    async function fetchEstudiantes(seccionId: string) {
        const { data } = await sqliteService.query(
            'SELECT * FROM estudiantes WHERE seccion_id = ? ORDER BY apellidos',
            [seccionId]
        );
        setEstudiantes(data || []);
    }

    async function fetchIndicadoresAndEvaluations(trabajoId: string, isMounted = true) {
        setIsLoadingData(true);

        try {
            const { data: indData } = await sqliteService.query(
                'SELECT * FROM indicadores WHERE trabajo_id = ? ORDER BY orden',
                [parseInt(trabajoId)]
            );
            if (!isMounted) return;
            setIndicadores(indData || []);

            const indIds: number[] = (indData || []).map((i: Indicador) => i.id);
            
            // Load direct grades
            const { data: directNotesData } = await sqliteService.from('notas_directas_cotidiano').selectWhere('*', 'trabajo_id', parseInt(trabajoId));
            if (isMounted) {
                const directNotesMap: Record<string, string> = {};
                (directNotesData || []).forEach((n: any) => {
                    directNotesMap[n.estudiante_id] = String(n.nota);
                });
                setNotasFinalesDirectas(directNotesMap);
            }

            if (indIds.length > 0) {
                const { data: evalData } = await sqliteService.from('evaluaciones_cotidiano').selectIn('*', 'indicador_id', indIds);
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

    const calculateNota = (estudianteId: string) => {
        // Si hay nota final directa, usarla
        const notaDirectaStr = notasFinalesDirectas[estudianteId];
        if (notaDirectaStr !== undefined && notaDirectaStr !== '') {
            return Math.max(0, Math.min(100, parseFloat(notaDirectaStr) || 0));
        }
        if (indicadores.length === 0) return 0;
        const studentEvals = evaluaciones[estudianteId] || {};
        const points = indicadores.reduce((acc, ind) => acc + (studentEvals[String(ind.id)] || 0), 0);
        const maxPoints = indicadores.length * 3;
        return Math.round((points / maxPoints) * 100) || 0;
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

    async function saveEvaluations() {
        setIsSaving(true);
        try {
            const upsertData: Record<string, any>[] = [];
            estudiantes.forEach(est => {
                const estEvals = evaluaciones[est.cedula] || {};
                indicadores.forEach(ind => {
                    if (estEvals[ind.id] !== undefined) {
                        upsertData.push({
                            estudiante_id: est.cedula,
                            indicador_id: ind.id,
                            puntaje: estEvals[ind.id]
                        });
                    }
                });
            });

            if (upsertData.length > 0) {
                const { success, error } = await sqliteService.from('evaluaciones_cotidiano').upsert(
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
                        id: `dn-tc-${selectedTrabajo}-${cedula}`,
                        trabajo_id: parseInt(selectedTrabajo),
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
                    `DELETE FROM notas_directas_cotidiano WHERE trabajo_id = ? AND estudiante_id IN (${studentsToClear.map(() => '?').join(',')})`,
                    [parseInt(selectedTrabajo), ...studentsToClear]
                );
            }

            if (directNotesData.length > 0) {
                const { success, error } = await sqliteService.from('notas_directas_cotidiano').upsert(
                    directNotesData,
                    { onConflict: 'id' }
                );
                if (!success) throw new Error(error || 'Error al guardar notas directas');
            }

            showToast('Evaluaciones guardadas', 'success');
        } catch (error: any) {
            showToast(`Error: ${error.message}`, 'error');
        } finally {
            setIsSaving(false);
        }
    }

    const handleNewTrabajo = () => {
        setEditNombre('');
        setEditIndicadores([{ titulo: '', d0: '', d1: '', d2: '', d3: '' }]);
        setShowManager(true);
    };

    const addIndicatorField = () => {
        if (editIndicadores.length < 5) {
            setEditIndicadores([...editIndicadores, { titulo: '', d0: '', d1: '', d2: '', d3: '' }]);
        }
    };

    async function createTrabajo() {
        if (!editNombre) return;
        setIsSaving(true);
        try {
            // 1. Insertar trabajo y obtener su ID
            const { data: nuevoTrabajo, error: tcError } = await sqliteService.from('trabajos_cotidianos').insertReturning({
                nombre: editNombre,
                seccion_id: selectedSeccion,
                periodo: periodo
            });
            if (tcError || !nuevoTrabajo) throw new Error(tcError || 'No se pudo crear el trabajo');

            // 2. Insertar indicadores
            const indsData = editIndicadores.map((ind, idx) => ({
                trabajo_id: nuevoTrabajo.id,
                titulo: ind.titulo,
                orden: idx + 1,
                desc_0: ind.d0,
                desc_1: ind.d1,
                desc_2: ind.d2,
                desc_3: ind.d3
            }));

            const { success: indSuccess, error: indError } = await sqliteService.transaction(
                indsData.map(ind => ({
                    sql: 'INSERT INTO indicadores (trabajo_id, titulo, orden, desc_0, desc_1, desc_2, desc_3) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    params: [ind.trabajo_id, ind.titulo, ind.orden, ind.desc_0, ind.desc_1, ind.desc_2, ind.desc_3]
                }))
            );
            if (!indSuccess) throw new Error(indError || 'Error al insertar indicadores');

            showToast('Trabajo Cotidiano creado', 'success');
            setShowManager(false);
            fetchTrabajos(selectedSeccion);
        } catch (error: any) {
            showToast(`Error: ${error.message}`, 'error');
        } finally {
            setIsSaving(false);
        }
    }

    async function handleDeleteTrabajo() {
        if (!selectedTrabajo) return;
        if (!confirm('¿Estás seguro de eliminar este trabajo cotidiano y todas sus notas?')) return;
        const { error } = await sqliteService.from('trabajos_cotidianos').delete('id', parseInt(selectedTrabajo));
        if (error) {
            showToast(`Error al eliminar: ${error}`, 'error');
        } else {
            showToast('Trabajo eliminado correctamente', 'success');
            fetchTrabajos(selectedSeccion);
        }
    }

    return (
        <div className="cotidiano-page">
            <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Trabajo Cotidiano</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Evaluación por rúbrica analítica y descriptores.</p>
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
                    <button onClick={handleNewTrabajo} className="btn-primary" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid var(--glass-border)' }}>
                        ➕ Nuevo Trabajo
                    </button>
                </div>
            </header>

            {!showManager ? (
                <div className="evaluation-view">
                    <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3rem', flex: 1, marginRight: '2rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <label style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Trabajo:</label>
                                <select
                                    value={selectedTrabajo}
                                    onChange={e => setSelectedTrabajo(e.target.value)}
                                    className="glass-card"
                                    style={{ padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.05)', color: 'white', border: 'none' }}
                                >
                                    {trabajos.map(t => <option key={t.id} value={t.id} style={{ background: '#1e1b4b' }}>{t.nombre}</option>)}
                                    {trabajos.length === 0 && <option value="">No hay trabajos creados</option>}
                                </select>
                            </div>
                            {selectedTrabajo && (
                                <div style={{ display: 'flex', gap: '2.5rem', fontSize: '0.9rem' }}>
                                    <div style={{ color: 'var(--primary)' }}><strong>Puntos Totales:</strong> {indicadores.length * 3}</div>
                                </div>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button onClick={saveEvaluations} disabled={isSaving || !selectedTrabajo} className="btn-primary">
                                {isSaving ? '⌛ Guardando...' : '💾 Guardar Notas'}
                            </button>
                            {selectedTrabajo && (
                                <button
                                    onClick={handleDeleteTrabajo}
                                    className="btn-primary"
                                    style={{ background: 'var(--danger)', opacity: 0.8 }}
                                >
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
                    {!isLoadingData && selectedTrabajo && (
                        <div className="glass-card" style={{ overflowX: 'auto', padding: '0' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--glass-border)' }}>
                                        <th style={{ textAlign: 'left', padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)', position: 'sticky', left: 0, zIndex: 10, background: '#111827', minWidth: '200px' }}>Estudiante</th>
                                        <th style={{ textAlign: 'center', padding: '0.5rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>M/M</th>
                                        {indicadores.map((ind, idx) => (
                                            <th key={ind.id} style={{ textAlign: 'center', padding: '0.5rem 0.2rem', fontSize: '0.7rem', width: '45px', minWidth: '45px', maxWidth: '45px' }} title={ind.titulo}>
                                                I{idx + 1}
                                                <div style={{ fontSize: '0.55rem', fontWeight: 400, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '40px' }}>
                                                    {ind.titulo}
                                                </div>
                                            </th>
                                        ))}
                                        <th style={{ textAlign: 'center', padding: '0.5rem', fontSize: '0.7rem', color: '#facc15', fontWeight: 700 }}>NOTA FINAL</th>
                                        <th style={{ textAlign: 'center', padding: '0.5rem', fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 700 }}>CALIF.</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {estudiantes.map(est => {
                                        const initials = `${est.nombre.charAt(0)}${est.apellidos.charAt(0)}`.toUpperCase();
                                        const nota = calculateNota(est.cedula);
                                        const studentEvals = evaluaciones[est.cedula] || {};
                                        const allAreThree = indicadores.length > 0 && indicadores.every(ind => studentEvals[ind.id] === 3);
                                        const notaDirecta = notasFinalesDirectas[est.cedula] ?? '';
                                        const tieneNotaDirecta = notaDirecta !== '';
                                        return (
                                            <tr key={est.cedula} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: tieneNotaDirecta ? 'rgba(250,204,21,0.03)' : 'transparent' }}>
                                                <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', position: 'sticky', left: 0, zIndex: 5, background: tieneNotaDirecta ? '#1a180e' : '#111827', whiteSpace: 'nowrap', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem' }}>{initials}</div>
                                                        <div>{est.nombre} {est.apellidos}</div>
                                                    </div>
                                                </td>
                                                <td style={{ textAlign: 'center', padding: '0.25rem' }}>
                                                    <button
                                                        onClick={() => handleToggleAllScores(est.cedula)}
                                                        style={{ fontSize: '8px', padding: '4px 6px', borderRadius: '6px', background: allAreThree ? 'var(--danger)' : 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                                                    >
                                                        {allAreThree ? 'MIN' : 'MAX'}
                                                    </button>
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
                                                        title="Nota Final Directa (sobreescribe rúbrica)"
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
                                                <td style={{ textAlign: 'center', fontWeight: 700, color: nota >= 70 ? 'var(--primary)' : 'var(--danger)', fontSize: '0.85rem' }}>
                                                    {nota}%
                                                </td>
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
                        <h2>Configurar Rúbrica de Trabajo Cotidiano</h2>
                        <button onClick={() => setShowManager(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>✕ Cancelar</button>
                    </div>

                    <div style={{ marginBottom: '2rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Nombre del Trabajo (ej. TC1 - Funciones Lógicas)</label>
                        <input
                            type="text"
                            value={editNombre}
                            onChange={e => setEditNombre(e.target.value)}
                            className="glass-card"
                            style={{ width: '100%', padding: '1rem', background: 'rgba(255,255,255,0.05)', color: 'white', border: 'none' }}
                            placeholder="Nombre descriptivo..."
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        {editIndicadores.map((ind, idx) => (
                            <div key={idx} className="glass-card" style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.02)' }}>
                                <div style={{ marginBottom: '1rem', fontWeight: 600, color: 'var(--primary)' }}>Indicador I{idx + 1}</div>
                                <input
                                    type="text"
                                    placeholder="Título del indicador..."
                                    value={ind.titulo}
                                    onChange={e => { const n = [...editIndicadores]; n[idx].titulo = e.target.value; setEditIndicadores(n); }}
                                    className="glass-card"
                                    style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', background: 'rgba(255,255,255,0.05)', color: 'white', border: 'none' }}
                                />
                                <div className="grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                                    <div>
                                        <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>0 - No presenta evidencia</label>
                                        <textarea value={ind.d0} onChange={e => { const n = [...editIndicadores]; n[idx].d0 = e.target.value; setEditIndicadores(n); }} className="glass-card" style={{ width: '100%', height: '60px', padding: '0.5rem', background: 'rgba(255,255,255,0.02)', color: 'white', border: 'none', fontSize: '0.8rem' }} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>1 - Aún no logrado (Reconoce...)</label>
                                        <textarea value={ind.d1} onChange={e => { const n = [...editIndicadores]; n[idx].d1 = e.target.value; setEditIndicadores(n); }} className="glass-card" style={{ width: '100%', height: '60px', padding: '0.5rem', background: 'rgba(255,255,255,0.02)', color: 'white', border: 'none', fontSize: '0.8rem' }} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>2 - En proceso (Infiere...)</label>
                                        <textarea value={ind.d2} onChange={e => { const n = [...editIndicadores]; n[idx].d2 = e.target.value; setEditIndicadores(n); }} className="glass-card" style={{ width: '100%', height: '60px', padding: '0.5rem', background: 'rgba(255,255,255,0.02)', color: 'white', border: 'none', fontSize: '0.8rem' }} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>3 - Logrado (Aplica...)</label>
                                        <textarea value={ind.d3} onChange={e => { const n = [...editIndicadores]; n[idx].d3 = e.target.value; setEditIndicadores(n); }} className="glass-card" style={{ width: '100%', height: '60px', padding: '0.5rem', background: 'rgba(255,255,255,0.02)', color: 'white', border: 'none', fontSize: '0.8rem' }} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
                        {editIndicadores.length < 5 && (
                            <button onClick={addIndicatorField} className="btn-primary" style={{ background: 'rgba(255,255,255,0.1)' }}>
                                ➕ Añadir Indicador
                            </button>
                        )}
                        <button onClick={createTrabajo} disabled={isSaving} className="btn-primary">
                            {isSaving ? '⌛ Creando...' : '✅ Finalizar y Crear Rúbrica'}
                        </button>
                    </div>
                </div>
            )}

            {showSummary && selectedSeccion && (
                <CotidianoSummary
                    seccionId={selectedSeccion}
                    periodo={periodo}
                    onClose={() => setShowSummary(false)}
                />
            )}
        </div>
    );
};
