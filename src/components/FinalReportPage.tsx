import React, { useState, useEffect } from 'react';
import { sqliteService } from '../lib/sqliteService';
import { useToast } from './Toast';

// ─── Tipos locales ───────────────────────────────────────────────────────────
interface Seccion { id: string; nombre: string; nivel: number; }
interface Estudiante { cedula: string; nombre: string; apellidos: string; }
interface TrabajoCotidiano { id: number; seccion_id: string; periodo: number; }
interface Tarea { id: number; seccion_id: string; porcentaje: number; puntos_totales: number; periodo: number; }
interface Examen { id: number; seccion_id: string; porcentaje: number; puntos_totales: number; periodo: number; }
interface ConfigDiaria { fecha: string; periodo: number; lecciones_totales: number; }
interface AttRow { estudiante_id: string; fecha: string; periodo: number; estado_id: number; peso_ausencia: number; es_justificada: number; }

interface ConsolidatedStudent {
    cedula: string;
    nombreCompleto: string;
    cotidiano: string;
    tareas: string;
    examenes: string;
    asistencia: string;
    total: string;
}

interface Props {
    periodo: number;
}

export const FinalReportPage: React.FC<Props> = ({ periodo }) => {
    const [secciones, setSecciones] = useState<Seccion[]>([]);
    const [selectedSeccion, setSelectedSeccion] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState<'semester' | 'annual'>('semester');
    const [reportData, setReportData] = useState<ConsolidatedStudent[]>([]);
    const { showToast } = useToast();

    useEffect(() => { fetchInitialData(); }, []);
    useEffect(() => {
        if (selectedSeccion) fetchReportData(selectedSeccion);
    }, [selectedSeccion, periodo, viewMode]);

    async function fetchInitialData() {
        const { data } = await sqliteService.query('SELECT * FROM secciones ORDER BY nombre');
        setSecciones(data || []);
        if (data && data.length > 0) setSelectedSeccion(data[0].id);
    }

    async function fetchReportData(seccionId: string) {
        setLoading(true);
        try {
            // 1. Estudiantes
            const { data: estData } = await sqliteService.query(
                'SELECT * FROM estudiantes WHERE seccion_id = ? ORDER BY apellidos', [seccionId]
            );
            const students: Estudiante[] = estData || [];

            const periodsToFetch = viewMode === 'semester' ? [periodo] : [1, 2];
            const periodPlaceholders = periodsToFetch.map(() => '?').join(', ');

            // 2. Datos de evaluación por período
            const { data: tcData } = await sqliteService.query(
                `SELECT * FROM trabajos_cotidianos WHERE seccion_id = ? AND periodo IN (${periodPlaceholders})`,
                [seccionId, ...periodsToFetch]
            );
            const { data: tarData } = await sqliteService.query(
                `SELECT * FROM tareas WHERE seccion_id = ? AND periodo IN (${periodPlaceholders})`,
                [seccionId, ...periodsToFetch]
            );
            const { data: exData } = await sqliteService.query(
                `SELECT * FROM examenes WHERE seccion_id = ? AND periodo IN (${periodPlaceholders})`,
                [seccionId, ...periodsToFetch]
            );
            const { data: attData } = await sqliteService.query(
                `SELECT ca.estudiante_id, ca.fecha, ca.periodo, ca.estado_id,
                        ea.peso_ausencia, ea.es_justificada
                 FROM control_asistencia ca
                 JOIN estados_asistencia ea ON ca.estado_id = ea.id
                 WHERE ca.seccion_id = ? AND ca.periodo IN (${periodPlaceholders})`,
                [seccionId, ...periodsToFetch]
            );
            const { data: configData } = await sqliteService.query(
                `SELECT fecha, periodo, lecciones_totales FROM configuracion_diaria WHERE seccion_id = ? AND periodo IN (${periodPlaceholders})`,
                [seccionId, ...periodsToFetch]
            );

            // IDs para consultas
            const tcIds: number[] = (tcData || []).map((t: any) => t.id);
            const tarIds: number[] = (tarData || []).map((t: any) => t.id);
            const exIds: number[] = (exData || []).map((e: any) => e.id);

            // 3. Notas Directas
            const { data: directTCData } = await sqliteService.from('notas_directas_cotidiano').selectIn('*', 'trabajo_id', tcIds);
            const { data: directTarData } = await sqliteService.from('notas_directas_tarea').selectIn('*', 'tarea_id', tarIds);
            const { data: directExData } = await sqliteService.from('notas_directas_examen').selectIn('*', 'examen_id', exIds);

            // 4. Indicadores y evaluaciones de cotidiano
            const tcIndDataResult = tcIds.length > 0
                ? await sqliteService.from('indicadores').selectIn('id, trabajo_id', 'trabajo_id', tcIds)
                : { data: [] };
            const tcIndData = tcIndDataResult.data || [];
            const tcIndIds: number[] = tcIndData.map((i: any) => i.id);
            const { data: tcEvalData } = tcIndIds.length > 0
                ? await sqliteService.from('evaluaciones_cotidiano').selectIn('*', 'indicador_id', tcIndIds)
                : { data: [] };

            // 5. Indicadores y evaluaciones de tareas
            const tarIndDataResult = tarIds.length > 0
                ? await sqliteService.from('indicadores_tarea').selectIn('id, tarea_id', 'tarea_id', tarIds)
                : { data: [] };
            const tarIndData = tarIndDataResult.data || [];
            const tarIndIds: number[] = tarIndData.map((i: any) => i.id);
            const { data: tarEvalData } = tarIndIds.length > 0
                ? await sqliteService.from('evaluaciones_tarea').selectIn('*', 'indicador_id', tarIndIds)
                : { data: [] };

            // 6. Indicadores y evaluaciones de exámenes
            const exIndDataResult = exIds.length > 0
                ? await sqliteService.from('indicadores_examen').selectIn('id, examen_id', 'examen_id', exIds)
                : { data: [] };
            const exIndData = exIndDataResult.data || [];
            const exIndIds: number[] = exIndData.map((i: any) => i.id);
            const { data: exEvalData } = exIndIds.length > 0
                ? await sqliteService.from('evaluaciones_examen').selectIn('*', 'indicador_id', exIndIds)
                : { data: [] };

            // Mapa de configuraciones: "fecha-periodo" -> lecciones_totales
            const configMap: Record<string, number> = {};
            (configData || []).forEach((c: any) => {
                configMap[`${c.fecha}-${c.periodo}`] = c.lecciones_totales;
            });

            // 7. Calcular consolidado por estudiante
            const getGradesForPeriod = (est: Estudiante, p: number) => {
                // Cotidiano (35%)
                const currentTCs = (tcData || []).filter((t: any) => t.periodo === p);
                let tcAverage = 0;
                if (currentTCs.length > 0) {
                    let sumOfPercentages = 0;
                    currentTCs.forEach((tc: any) => {
                        // Revisar si hay nota directa
                        const directGrade = (directTCData || []).find((nd: any) => 
                            String(nd.trabajo_id) === String(tc.id) && 
                            String(nd.estudiante_id) === String(est.cedula)
                        );
                        
                        if (directGrade) {
                            sumOfPercentages += Number(directGrade.nota);
                        } else {
                            const tcInds = (tcIndData || []).filter((i: any) => String(i.trabajo_id) === String(tc.id)).map((i: any) => String(i.id));
                            if (tcInds.length > 0) {
                                const studentEvals = (tcEvalData || []).filter((ev: any) =>
                                    String(ev.estudiante_id) === String(est.cedula) && tcInds.includes(String(ev.indicador_id))
                                );
                                const points = studentEvals.reduce((acc: number, curr: any) => acc + (curr.puntaje || 0), 0);
                                sumOfPercentages += (points / (tcInds.length * 3)) * 100;
                            }
                        }
                    });
                    tcAverage = (sumOfPercentages / currentTCs.length) || 0;
                }
                const tcObtained = (tcAverage / 100) * 35;

                // Tareas (variable %)
                let tarObtained = 0;
                (tarData || []).filter((t: any) => t.periodo === p).forEach((tar: any) => {
                    // Revisar si hay nota directa
                    const directGrade = (directTarData || []).find((nd: any) => 
                        String(nd.tarea_id) === String(tar.id) && 
                        String(nd.estudiante_id) === String(est.cedula)
                    );
                    
                    if (directGrade) {
                        tarObtained += (Number(directGrade.nota) / 100) * tar.porcentaje;
                    } else {
                        const inds = (tarIndData || []).filter((i: any) => String(i.tarea_id) === String(tar.id)).map((i: any) => String(i.id));
                        const evals = (tarEvalData || []).filter((ev: any) =>
                            String(ev.estudiante_id) === String(est.cedula) && inds.includes(String(ev.indicador_id))
                        );
                        const points = evals.reduce((acc: number, curr: any) => acc + (curr.puntaje || 0), 0);
                        tarObtained += (points / tar.puntos_totales) * tar.porcentaje;
                    }
                });

                // Exámenes (variable %)
                let exObtained = 0;
                (exData || []).filter((e: any) => e.periodo === p).forEach((ex: any) => {
                    // Revisar si hay nota directa
                    const directGrade = (directExData || []).find((nd: any) => 
                        String(nd.examen_id) === String(ex.id) && 
                        String(nd.estudiante_id) === String(est.cedula)
                    );
                    
                    if (directGrade) {
                        exObtained += (Number(directGrade.nota) / 100) * ex.porcentaje;
                    } else {
                        const inds = (exIndData || []).filter((i: any) => String(i.examen_id) === String(ex.id)).map((i: any) => String(i.id));
                        const evals = (exEvalData || []).filter((ev: any) =>
                            String(ev.estudiante_id) === String(est.cedula) && inds.includes(String(ev.indicador_id))
                        );
                        const points = evals.reduce((acc: number, curr: any) => acc + (curr.puntaje || 0), 0);
                        exObtained += (points / ex.puntos_totales) * ex.porcentaje;
                    }
                });

                // Asistencia (5%)
                const studentAtt = (attData || []).filter((a: any) => a.estudiante_id === est.cedula && a.periodo === p);
                const currentConfigs = (configData || []).filter((c: any) => c.periodo === p);
                const uniqueDates = Array.from(new Set(currentConfigs.map((c: any) => c.fecha)));
                let totalProgrammed = 0;
                uniqueDates.forEach((d: any) => { totalProgrammed += configMap[`${d}-${p}`] || 4; });

                let totalWeight = 0;
                studentAtt.forEach((att: any) => {
                    if (!att.es_justificada) {
                        const lessonsToday = configMap[`${att.fecha}-${p}`] || 4;
                        let weight = att.peso_ausencia || 0;
                        if (lessonsToday < 4 && weight > 0) {
                            weight = (weight / 4) * lessonsToday;
                        }
                        totalWeight += weight;
                    }
                });
                const flooredAbsences = Math.floor(totalWeight);
                const absPercent = totalProgrammed > 0 ? (flooredAbsences / totalProgrammed) * 100 : 0;
                let attObtained = 0;
                if (absPercent < 10) attObtained = 5;
                else if (absPercent < 20) attObtained = 4;
                else if (absPercent < 30) attObtained = 3;
                else if (absPercent < 40) attObtained = 2;
                else if (absPercent < 50) attObtained = 1;

                return { tcObtained, tarObtained, exObtained, attObtained, total: tcObtained + tarObtained + exObtained + attObtained };
            };

            const consolidated: ConsolidatedStudent[] = students.map(est => {
                if (viewMode === 'semester') {
                    const g = getGradesForPeriod(est, periodo);
                    return {
                        cedula: est.cedula,
                        nombreCompleto: `${est.apellidos} ${est.nombre}`,
                        cotidiano: g.tcObtained.toFixed(2),
                        tareas: g.tarObtained.toFixed(2),
                        examenes: g.exObtained.toFixed(2),
                        asistencia: g.attObtained.toFixed(2),
                        total: g.total.toFixed(2)
                    };
                } else {
                    const g1 = getGradesForPeriod(est, 1);
                    const g2 = getGradesForPeriod(est, 2);
                    const annualTotal = (g1.total + g2.total) / 2;
                    return {
                        cedula: est.cedula,
                        nombreCompleto: `${est.apellidos} ${est.nombre}`,
                        cotidiano: ((g1.tcObtained + g2.tcObtained) / 2).toFixed(2),
                        tareas: ((g1.tarObtained + g2.tarObtained) / 2).toFixed(2),
                        examenes: ((g1.exObtained + g2.exObtained) / 2).toFixed(2),
                        asistencia: ((g1.attObtained + g2.attObtained) / 2).toFixed(2),
                        total: annualTotal.toFixed(2)
                    };
                }
            });

            setReportData(consolidated);
        } catch (error: any) {
            console.error('Error fetching report data:', error);
            showToast(`Error: ${error.message}`, 'error');
        } finally {
            setLoading(false);
        }
    }

    const downloadCSV = () => {
        if (reportData.length === 0) return;
        const headers = ['CEDULA', 'NOMBRE COMPLETO', 'COTIDIANO', 'TAREAS', 'EXAMENES', 'ASISTENCIA', 'TOTAL'];
        const csvContent = [
            headers.join(','),
            ...reportData.map(row => [
                row.cedula,
                `"${row.nombreCompleto}"`,
                row.cotidiano, row.tareas, row.examenes, row.asistencia, row.total
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.setAttribute('href', URL.createObjectURL(blob));
        link.setAttribute('download', `Reporte_Final_${secciones.find(s => s.id === selectedSeccion)?.nombre || 'Seccion'}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrint = () => { window.print(); };
    const filteredData = reportData.filter(row =>
        row.nombreCompleto.toLowerCase().includes(searchQuery.toLowerCase()) ||
        row.cedula.includes(searchQuery)
    );

    return (
        <div className="report-page">
            <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
                        {viewMode === 'semester' ? `Reporte Final de Notas - Semestre ${periodo}` : 'Reporte Consolidado Anual'}
                    </h1>
                    <p style={{ color: 'var(--text-muted)' }}>
                        {viewMode === 'semester' ? 'Consolidado académico semestral (Base 100%).' : 'Promedio ponderado de ambos semestres (50% cada uno).'}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }} className="no-print">
                    <div className="glass-card" style={{ display: 'flex', padding: '0.25rem', gap: '0.25rem' }}>
                        <button onClick={() => setViewMode('semester')} style={{ padding: '0.5rem 1rem', borderRadius: '6px', background: viewMode === 'semester' ? 'var(--primary)' : 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontSize: '0.9rem' }}>Vista Semestral</button>
                        <button onClick={() => setViewMode('annual')} style={{ padding: '0.5rem 1rem', borderRadius: '6px', background: viewMode === 'annual' ? 'var(--primary)' : 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontSize: '0.9rem' }}>Vista Anual</button>
                    </div>
                    <select
                        value={selectedSeccion}
                        onChange={e => setSelectedSeccion(e.target.value)}
                        className="glass-card"
                        style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.05)', color: 'white', border: 'none' }}
                    >
                        {secciones.map(s => <option key={s.id} value={s.id} style={{ background: '#1e1b4b' }}>{s.nombre}</option>)}
                    </select>
                    <button onClick={downloadCSV} className="btn-primary" style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', border: '1px solid #22c55e' }}>
                        📥 Exportar Excel (CSV)
                    </button>
                    <button onClick={handlePrint} className="btn-primary">🖨️ Imprimir PDF</button>
                </div>
            </header>

            <div className="glass-card no-print" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
                <input
                    type="text"
                    placeholder="Buscar por nombre o cédula..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{ width: '100%', background: 'none', border: 'none', color: 'white', fontSize: '1rem', padding: '0.5rem' }}
                />
            </div>

            <div className="only-print" style={{ display: 'none', textAlign: 'center', marginBottom: '2rem' }}>
                <h1 style={{ color: 'black' }}>Reporte Final de Calificaciones - MEP 2026</h1>
                <h2 style={{ color: 'black' }}>Sección: {secciones.find(s => s.id === selectedSeccion)?.nombre}</h2>
                <p style={{ color: 'black' }}>Fecha: {new Date().toLocaleDateString()}</p>
            </div>

            <div className="glass-card" style={{ padding: '0', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '2px solid var(--glass-border)', background: 'rgba(255,255,255,0.02)' }}>
                            <th style={{ textAlign: 'left', padding: '1rem' }}>CÉDULA</th>
                            <th style={{ textAlign: 'left', padding: '1rem' }}>NOMBRE COMPLETO</th>
                            <th style={{ textAlign: 'center', padding: '1rem' }}>COTIDIANO (35%)</th>
                            <th style={{ textAlign: 'center', padding: '1rem' }}>TAREAS (10%)</th>
                            <th style={{ textAlign: 'center', padding: '1rem' }}>EXÁMENES (50%)</th>
                            <th style={{ textAlign: 'center', padding: '1rem' }}>ASISTENCIA (5%)</th>
                            <th style={{ textAlign: 'center', padding: '1rem', color: 'var(--primary)', fontWeight: 800 }}>TOTAL (100%)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={7} style={{ textAlign: 'center', padding: '3rem' }}>Generando consolidado...</td></tr>
                        ) : filteredData.length === 0 ? (
                            <tr><td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No se encontraron registros.</td></tr>
                        ) : filteredData.map(row => (
                            <tr key={row.cedula} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <td style={{ padding: '1rem' }}>{row.cedula}</td>
                                <td style={{ padding: '1rem', fontWeight: 600 }}>{row.nombreCompleto}</td>
                                <td style={{ textAlign: 'center', padding: '1rem' }}>{row.cotidiano}%</td>
                                <td style={{ textAlign: 'center', padding: '1rem' }}>{row.tareas}%</td>
                                <td style={{ textAlign: 'center', padding: '1rem' }}>{row.examenes}%</td>
                                <td style={{ textAlign: 'center', padding: '1rem' }}>{row.asistencia}%</td>
                                <td style={{ textAlign: 'center', padding: '1rem', fontWeight: 800, color: Number(row.total) >= 70 ? 'var(--primary)' : 'var(--danger)', fontSize: '1.1rem' }}>
                                    {row.total}%
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <style>{`
                @media print {
                    @page { size: landscape; margin: 10mm; }
                    html, body { height: auto !important; overflow: visible !important; background: white !important; margin: 0 !important; padding: 0 !important; }
                    .app-layout { display: block !important; }
                    .sidebar { display: none !important; }
                    .container { padding: 0 !important; margin: 0 !important; max-width: none !important; width: 100% !important; }
                    .no-print { display: none !important; }
                    .only-print { display: block !important; }
                    .report-page { position: static !important; width: 100% !important; padding: 0 !important; background: white !important; display: block !important; overflow: visible !important; }
                    .glass-card { background: white !important; border: none !important; color: black !important; box-shadow: none !important; overflow: visible !important; display: block !important; backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
                    table { width: 100% !important; border-collapse: collapse !important; color: black !important; table-layout: auto !important; }
                    th, td { border: 1px solid black !important; padding: 8px !important; color: black !important; page-break-inside: avoid !important; }
                    th { background: #f0f0f0 !important; }
                    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                }
            `}</style>
        </div>
    );
};
