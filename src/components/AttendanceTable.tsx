import React, { useEffect, useState } from 'react';
import { sqliteService } from '../lib/sqliteService';
import { useToast } from './Toast';

interface Estudiante {
    cedula: string;
    nombre: string;
    apellidos: string;
}

interface Props {
    seccionId: string;
    fecha: string;
    periodo: number;
    onSave?: () => void;
}

type LessonStatus = 'P' | 'A' | 'T' | 'J';

export function AttendanceTable({ seccionId, fecha, periodo, onSave }: Props) {
    const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
    const [asistencias, setAsistencias] = useState<Record<string, LessonStatus[]>>({});
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [leccionesTotales, setLeccionesTotales] = useState<number>(4);
    const [observaciones, setObservaciones] = useState<string>('');
    const [observacionClase, setObservacionClase] = useState<string>('');
    const { showToast } = useToast();

    const lessonColors: Record<LessonStatus, string> = {
        P: '#22c55e',
        A: '#ef4444',
        T: '#f59e0b',
        J: '#3b82f6'
    };

    const mapStateToLessons = (stateId: number): LessonStatus[] => {
        switch (stateId) {
            case 1: return ['P', 'P', 'P', 'P'];
            case 2: return ['A', 'A', 'A', 'A'];
            case 3: return ['A', 'P', 'P', 'P'];
            case 4: return ['A', 'A', 'P', 'P'];
            case 5: return ['A', 'A', 'A', 'P'];
            case 6: return ['T', 'P', 'P', 'P'];
            case 7: return ['P', 'P', 'T', 'P'];
            case 8: return ['A', 'T', 'P', 'P'];
            case 9: return ['A', 'A', 'T', 'P'];
            case 10: return ['A', 'A', 'A', 'T'];
            case 11: return ['P', 'A', 'P', 'P'];
            case 12: return ['J', 'J', 'J', 'J'];
            default: return ['P', 'P', 'P', 'P'];
        }
    };

    const mapLessonsToState = (lessons: LessonStatus[]): number => {
        const s = lessons.join('');
        if (s === 'PPPP') return 1;
        if (s === 'AAAA') return 2;
        if (s === 'APPP') return 3;
        if (s === 'AAPP') return 4;
        if (s === 'AAAP') return 5;
        if (s === 'TPPP') return 6;
        if (s === 'PPTP') return 7;
        if (s === 'ATPP') return 8;
        if (s === 'AATP') return 9;
        if (s === 'AAAT') return 10;
        if (s === 'JJJJ') return 12;
        if (lessons.some(l => l === 'A')) return 11;
        if (lessons.some(l => l === 'J')) return 12;
        return 1;
    };

    useEffect(() => {
        loadData();
    }, [seccionId, fecha, periodo]);

    async function loadData() {
        setLoading(true);
        try {
            // 1. Load configuration (lessons per day)
            const { data: configData } = await sqliteService.query(
                'SELECT * FROM configuracion_diaria WHERE seccion_id = ? AND fecha = ? AND periodo = ?',
                [seccionId, fecha, periodo]
            );

            if (configData && configData.length > 0) {
                setLeccionesTotales(configData[0].lecciones_totales);
                setObservaciones(configData[0].observaciones || '');
                setObservacionClase(configData[0].observacion_clase || '');
            } else {
                setLeccionesTotales(4);
                setObservaciones('');
                setObservacionClase('');
            }

            // 2. Load students
            const { data: studentsData } = await sqliteService.query(
                'SELECT * FROM estudiantes WHERE seccion_id = ? ORDER BY apellidos',
                [seccionId]
            );

            // 3. Load attendance
            const { data: attendanceData } = await sqliteService.query(
                'SELECT * FROM control_asistencia WHERE seccion_id = ? AND fecha = ? AND periodo = ?',
                [seccionId, fecha, periodo]
            );

            const attendanceMap: Record<string, LessonStatus[]> = {};
            if (attendanceData) {
                (attendanceData as any[]).forEach((r) => {
                    attendanceMap[r.estudiante_id] = mapStateToLessons(r.estado_id);
                });
            }

            if (studentsData) {
                const castedStudents = studentsData as Estudiante[];
                setEstudiantes(castedStudents);
                castedStudents.forEach(st => {
                    if (!attendanceMap[st.cedula]) {
                        attendanceMap[st.cedula] = ['P', 'P', 'P', 'P'];
                    }
                });
            }

            setAsistencias(attendanceMap);
        } catch (err) {
            console.error('Error loading data:', err);
        } finally {
            setLoading(false);
        }
    }

    const handleLessonToggle = (cedula: string, lessonIdx: number) => {
        const statuses: LessonStatus[] = ['P', 'A', 'T', 'J'];
        setAsistencias(prev => {
            const current = [...prev[cedula]];
            const currentIndex = statuses.indexOf(current[lessonIdx]);
            current[lessonIdx] = statuses[(currentIndex + 1) % statuses.length];
            return { ...prev, [cedula]: current };
        });
    };

    const handleGeneralToggle = (cedula: string) => {
        setAsistencias(prev => {
            const isPresent = prev[cedula].every(l => l === 'P');
            return {
                ...prev,
                [cedula]: isPresent ? ['A', 'A', 'A', 'A'] : ['P', 'P', 'P', 'P']
            };
        });
    };

    async function handleSave() {
        setIsSaving(true);
        try {
            const queries = [
                {
                    sql: `INSERT INTO configuracion_diaria (seccion_id, fecha, periodo, lecciones_totales, observaciones, observacion_clase) 
                          VALUES (?, ?, ?, ?, ?, ?)
                          ON CONFLICT(seccion_id, fecha, periodo) DO UPDATE SET 
                          lecciones_totales = excluded.lecciones_totales,
                          observaciones = excluded.observaciones,
                          observacion_clase = excluded.observacion_clase`,
                    params: [seccionId, fecha, periodo, leccionesTotales, observaciones, observacionClase]
                }
            ];

            estudiantes.forEach(est => {
                queries.push({
                    sql: `INSERT INTO control_asistencia (estudiante_id, seccion_id, fecha, periodo, estado_id) 
                          VALUES (?, ?, ?, ?, ?)
                          ON CONFLICT(estudiante_id, fecha, periodo) DO UPDATE SET 
                          estado_id = excluded.estado_id`,
                    params: [est.cedula, seccionId, fecha, periodo, mapLessonsToState(asistencias[est.cedula])]
                });
            });

            const { success, error: transError } = await sqliteService.transaction(queries);
            if (!success) throw new Error(transError || 'Error al guardar');

            showToast('Asistencia y configuración guardadas correctamente', 'success');
            if (onSave) onSave();
        } catch (error: any) {
            console.error('Error saving:', error);
            showToast(`Error: ${error.message}`, 'error');
        } finally {
            setIsSaving(false);
        }
    }

    if (loading) return <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Cargando lista...</div>;

    return (
        <div className="attendance-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div className="glass-card" style={{ padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <label style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600 }}>Lecciones Impartidas hoy:</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {[1, 2, 3, 4].map(num => (
                            <button
                                key={num}
                                onClick={() => setLeccionesTotales(num)}
                                style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    background: leccionesTotales === num ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                                    color: 'white',
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {num}
                            </button>
                        ))}
                    </div>
                </div>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="btn-primary"
                    style={{
                        padding: '0.75rem 2rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        opacity: isSaving ? 0.7 : 1
                    }}
                >
                    {isSaving ? '⌛ Guardando...' : '💾 Guardar Asistencia'}
                </button>
            </div>

            <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.75rem' }}>
                    OBSERVACIÓN (Clase o Grupo):
                </label>
                <textarea
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    placeholder="Escriba aquí cualquier observación relevante sobre la sección o la lección de hoy..."
                    style={{
                        width: '100%',
                        minHeight: '80px',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '8px',
                        padding: '0.75rem',
                        color: 'white',
                        fontSize: '0.9rem',
                        resize: 'vertical',
                        outline: 'none',
                        transition: 'border-color 0.2s'
                    }}
                    onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                    onBlur={(e) => e.target.style.borderColor = 'var(--glass-border)'}
                />
            </div>

            <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--glass-border)' }}>
                            <th style={{ textAlign: 'left', padding: '1rem 1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Cédula</th>
                            <th style={{ textAlign: 'left', padding: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Nombre del Estudiante</th>
                            <th style={{ textAlign: 'center', padding: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Estado General</th>
                            <th style={{ textAlign: 'center', padding: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>L1</th>
                            {leccionesTotales >= 2 && <th style={{ textAlign: 'center', padding: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>L2</th>}
                            {leccionesTotales >= 3 && <th style={{ textAlign: 'center', padding: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>L3</th>}
                            {leccionesTotales >= 4 && <th style={{ textAlign: 'center', padding: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>L4</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {estudiantes.map((est) => {
                            const currentLessons = asistencias[est.cedula] || ['P', 'P', 'P', 'P'];
                            const isPresent = currentLessons.every(l => l === 'P');
                            const initials = `${est.nombre.charAt(0)}${est.apellidos.charAt(0)}`.toUpperCase();

                            return (
                                <tr key={est.cedula} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>{est.cedula}</td>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <div style={{
                                                width: '32px',
                                                height: '32px',
                                                borderRadius: '50%',
                                                background: 'rgba(99, 102, 241, 0.1)',
                                                border: '1px solid rgba(99, 102, 241, 0.2)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '0.75rem',
                                                fontWeight: 600,
                                                color: 'var(--primary)'
                                            }}>{initials}</div>
                                            <div style={{ fontWeight: 500 }}>{est.nombre} {est.apellidos}</div>
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                                        <div
                                            onClick={() => handleGeneralToggle(est.cedula)}
                                            style={{
                                                width: '60px',
                                                height: '28px',
                                                background: isPresent ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
                                                borderRadius: '14px',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                padding: '0 4px',
                                                cursor: 'pointer',
                                                transition: 'all 0.3s ease',
                                                position: 'relative'
                                            }}
                                        >
                                            <div style={{
                                                width: '20px',
                                                height: '20px',
                                                background: 'white',
                                                borderRadius: '50%',
                                                transform: isPresent ? 'translateX(32px)' : 'translateX(0)',
                                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '10px'
                                            }}>{isPresent ? '✓' : ''}</div>
                                            <span style={{
                                                position: 'absolute',
                                                left: isPresent ? '8px' : '26px',
                                                fontSize: '9px',
                                                fontWeight: 700,
                                                color: isPresent ? 'white' : 'var(--danger)',
                                                pointerEvents: 'none'
                                            }}>
                                                {isPresent ? 'PRES' : 'AUSEN'}
                                            </span>
                                        </div>
                                    </td>
                                    {[0, 1, 2, 3].slice(0, leccionesTotales).map(idx => (
                                        <td key={idx} style={{ padding: '1rem', textAlign: 'center' }}>
                                            <button
                                                onClick={() => handleLessonToggle(est.cedula, idx)}
                                                style={{
                                                    padding: '0.4rem 0.8rem',
                                                    borderRadius: '8px',
                                                    background: 'rgba(255,255,255,0.05)',
                                                    border: `1px solid ${lessonColors[currentLessons[idx]]}44`,
                                                    color: lessonColors[currentLessons[idx]],
                                                    fontSize: '0.85rem',
                                                    fontWeight: 700,
                                                    cursor: 'pointer',
                                                    minWidth: '40px',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                {currentLessons[idx]} ⌄
                                            </button>
                                        </td>
                                    ))}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                <footer style={{ padding: '1.2rem 1.5rem', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        Mostrando <strong>{estudiantes.length}</strong> estudiantes de la sección.
                    </div>
                    <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: lessonColors.P }}></div>
                            P = Presente
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: lessonColors.A }}></div>
                            A = Ausente
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: lessonColors.T }}></div>
                            T = Tardía
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: lessonColors.J }}></div>
                            J = Justificada
                        </div>
                    </div>
                </footer>
            </div>
        </div>
    );
}

