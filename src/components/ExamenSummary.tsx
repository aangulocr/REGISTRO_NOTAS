import React, { useState, useEffect } from 'react';
import { sqliteService } from '../lib/sqliteService';

interface ExamenSummaryProps {
    seccionId: string;
    periodo: number;
    onClose: () => void;
}

interface Examen {
    id: number;
    nombre: string;
    porcentaje: number;
    puntos_totales: number;
}
interface Estudiante {
    cedula: string;
    nombre: string;
    apellidos: string;
}

export const ExamenSummary: React.FC<ExamenSummaryProps> = ({ seccionId, periodo, onClose }) => {
    const [loading, setLoading] = useState(true);
    const [seccionName, setSeccionName] = useState('');
    const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
    const [examenes, setExamenes] = useState<Examen[]>([]);
    const [gradesMap, setGradesMap] = useState<Record<string, Record<number, { nota: number; obtenido: number }>>>({});

    useEffect(() => { fetchData(); }, [seccionId, periodo]);

    async function fetchData() {
        setLoading(true);
        try {
            // 1. Nombre de la sección
            const { data: secData } = await sqliteService.query(
                'SELECT nombre FROM secciones WHERE id = ?', [seccionId]
            );
            setSeccionName(secData?.[0]?.nombre || '');

            // 2. Estudiantes
            const { data: estData } = await sqliteService.query(
                'SELECT * FROM estudiantes WHERE seccion_id = ? ORDER BY apellidos', [seccionId]
            );
            const students: Estudiante[] = estData || [];
            setEstudiantes(students);

            // 3. Exámenes
            const { data: exData } = await sqliteService.query(
                'SELECT * FROM examenes WHERE seccion_id = ? AND periodo = ? ORDER BY id',
                [seccionId, periodo]
            );
            const exams: Examen[] = exData || [];
            setExamenes(exams);

            if (exams.length > 0) {
                const exIds: number[] = exams.map(e => e.id);

                // 4. Indicadores para esos exámenes
                const { data: indData } = await sqliteService.from('indicadores_examen').selectIn('*', 'examen_id', exIds);
                const indicators = indData || [];

                // 5. Evaluaciones para esos indicadores
                const indIds: number[] = indicators.map((i: any) => i.id);
                const { data: evalData } = indIds.length > 0
                    ? await sqliteService.from('evaluaciones_examen').selectIn('*', 'indicador_id', indIds)
                    : { data: [] };
                const evaluations = evalData || [];

                // 6. Notas directas
                const { data: directData } = await sqliteService.from('notas_directas_examen').selectIn('*', 'examen_id', exIds);
                const directGrades = directData || [];

                // 7. Calcular notas por estudiante/examen
                const newGradesMap: Record<string, Record<number, { nota: number; obtenido: number }>> = {};
                students.forEach(est => {
                    newGradesMap[est.cedula] = {};
                    exams.forEach(ex => {
                        // Primero revisar si hay nota directa
                        const directGrade = (directGrades || []).find((nd: any) => 
                            String(nd.examen_id) === String(ex.id) && 
                            String(nd.estudiante_id) === String(est.cedula)
                        );
                        
                        let nota = 0;
                        if (directGrade) {
                            nota = Number(directGrade.nota);
                        } else {
                            const exInds = indicators.filter((i: any) => String(i.examen_id) === String(ex.id));
                            const studentEvals = evaluations.filter((ev: any) =>
                                String(ev.estudiante_id) === String(est.cedula) &&
                                exInds.some((i: any) => String(i.id) === String(ev.indicador_id))
                            );
                            let pointsPaid = 0;
                            studentEvals.forEach((ev: any) => { pointsPaid += ev.puntaje || 0; });
                            nota = Math.round((pointsPaid / ex.puntos_totales) * 100) || 0;
                        }
                        const obtenido = Number(((nota / 100) * ex.porcentaje).toFixed(2));
                        newGradesMap[est.cedula][ex.id] = { nota, obtenido };
                    });
                });
                setGradesMap(newGradesMap);
            }
        } catch (error) {
            console.error('Error fetching summary data:', error);
        } finally {
            setLoading(false);
        }
    }

    const handlePrint = () => { window.print(); };

    return (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '2rem' }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: '1000px', maxHeight: '90vh', overflow: 'auto', padding: '2rem', position: 'relative', background: '#1e1b4b' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }} className="no-print">
                    <h2 style={{ margin: 0 }}>Resumen de Exámenes - {seccionName} - Sem {periodo}</h2>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button onClick={handlePrint} className="btn-primary" style={{ background: 'var(--primary)' }}>🖨️ Imprimir PDF</button>
                        <button onClick={onClose} className="btn-primary" style={{ background: 'rgba(255,255,255,0.1)' }}>Cerrar</button>
                    </div>
                </div>

                <div className="only-print" style={{ display: 'none', textAlign: 'center', marginBottom: '2rem' }}>
                    <h1 style={{ color: 'black' }}>Reporte de Exámenes - MEP 2026</h1>
                    <h2 style={{ color: 'black' }}>Sección: {seccionName} - Semestre: {periodo}</h2>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '3rem' }}>Cargando resumen...</div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--glass-border)' }}>
                                    <th style={{ textAlign: 'left', padding: '1rem' }}>Estudiante</th>
                                    {examenes.map(e => (
                                        <th key={e.id} style={{ textAlign: 'center', padding: '1rem' }}>
                                            {e.nombre}
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>({e.porcentaje}%)</div>
                                        </th>
                                    ))}
                                    <th style={{ textAlign: 'center', padding: '1rem', color: 'var(--primary)' }}>TOTAL PRUEBAS (50%)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {estudiantes.map(est => {
                                    let totalPorcentaje = 0;
                                    return (
                                        <tr key={est.cedula} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            <td style={{ padding: '0.75rem 1rem' }}>{est.apellidos}, {est.nombre}</td>
                                            {examenes.map(ex => {
                                                const grade = gradesMap[est.cedula]?.[ex.id] || { nota: 0, obtenido: 0 };
                                                totalPorcentaje += grade.obtenido;
                                                return (
                                                    <td key={ex.id} style={{ textAlign: 'center', padding: '0.75rem' }}>
                                                        <div style={{ fontWeight: 600 }}>{grade.nota}%</div>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{grade.obtenido}%</div>
                                                    </td>
                                                );
                                            })}
                                            <td style={{ textAlign: 'center', padding: '0.75rem', fontWeight: 800, color: 'var(--primary)', fontSize: '1rem' }}>
                                                {totalPorcentaje.toFixed(2)}%
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                <style>{`
                    @media print {
                        @page { size: landscape; margin: 10mm; }
                        html, body { height: auto !important; overflow: visible !important; background: white !important; margin: 0 !important; padding: 0 !important; }
                        .app-layout { display: block !important; }
                        .sidebar { display: none !important; }
                        .container { padding: 0 !important; margin: 0 !important; max-width: none !important; width: 100% !important; }
                        .no-print { display: none !important; }
                        .only-print { display: block !important; }
                        .modal-overlay { position: static !important; width: 100% !important; background: white !important; padding: 0 !important; display: block !important; overflow: visible !important; }
                        .glass-card { background: white !important; border: none !important; color: black !important; width: 100% !important; max-width: 100% !important; box-shadow: none !important; padding: 0 !important; overflow: visible !important; display: block !important; backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
                        h1, h2, h3, p, div, span { color: black !important; }
                        table { width: 100% !important; border-collapse: collapse !important; color: black !important; font-size: 10pt !important; margin-top: 10px !important; table-layout: auto !important; }
                        th { border: 1px solid black !important; color: black !important; background: #f0f0f0 !important; padding: 8px !important; }
                        td { border: 1px solid black !important; color: black !important; padding: 8px !important; page-break-inside: avoid !important; }
                        tr { page-break-inside: avoid; }
                        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    }
                `}</style>
            </div>
        </div>
    );
};
