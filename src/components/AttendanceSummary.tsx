import React, { useState, useEffect } from 'react';
import { sqliteService } from '../lib/sqliteService';

interface AttendanceSummaryProps {
    seccionId: string;
    periodo: number;
    onClose: () => void;
}

export const AttendanceSummary: React.FC<AttendanceSummaryProps> = ({ seccionId, periodo, onClose }) => {
    const [loading, setLoading] = useState(true);
    const [seccionName, setSeccionName] = useState('');
    const [estudiantes, setEstudiantes] = useState<any[]>([]);
    const [stats, setStats] = useState<Record<string, any>>({});

    useEffect(() => {
        fetchData();
    }, [seccionId, periodo]);

    async function fetchData() {
        setLoading(true);
        try {
            // 1. Get Section info
            const { data: sectionData } = await sqliteService.query('SELECT * FROM secciones WHERE id = ?', [seccionId]);
            if (sectionData && sectionData.length > 0) {
                setSeccionName(sectionData[0].nombre);
            }

            // 2. Get Students
            const { data: estData } = await sqliteService.query(
                'SELECT * FROM estudiantes WHERE seccion_id = ? ORDER BY apellidos',
                [seccionId]
            );
            const students = estData || [];
            setEstudiantes(students);

            // 3. Get Attendance Records with JOIN
            const { data: attendanceData } = await sqliteService.query(
                `SELECT ca.estudiante_id, ca.fecha, ca.estado_id, ea.peso_ausencia, ea.es_justificada 
                 FROM control_asistencia ca 
                 JOIN estados_asistencia ea ON ca.estado_id = ea.id 
                 WHERE ca.seccion_id = ? AND ca.periodo = ?`,
                [seccionId, periodo]
            );

            // 4. Calculate stats per student
            const newStats: any = {};

            // Calculate total programmed lessons for the section
            const uniqueDates = Array.from(new Set((attendanceData || []).map((a: any) => a.fecha)));
            const totalProgrammedLessons = uniqueDates.length * 4;

            students.forEach((est: any) => {
                const studentAttendance = (attendanceData || []).filter((a: any) => a.estudiante_id === est.cedula);
                let totalWeight = 0;

                studentAttendance.forEach((att: any) => {
                    // Only count unjustified absences/tardies
                    if (!att.es_justificada) {
                        totalWeight += att.peso_ausencia || 0;
                    }
                });

                const flooredAbsences = Math.floor(totalWeight);
                const absenteeismPercentage = totalProgrammedLessons > 0
                    ? (flooredAbsences / totalProgrammedLessons) * 100
                    : 0;

                let grade = 0;
                if (absenteeismPercentage < 10) grade = 5;
                else if (absenteeismPercentage < 20) grade = 4;
                else if (absenteeismPercentage < 30) grade = 3;
                else if (absenteeismPercentage < 40) grade = 2;
                else if (absenteeismPercentage < 50) grade = 1;
                else grade = 0;

                newStats[est.cedula] = {
                    totalLessons: totalProgrammedLessons,
                    totalWeight: totalWeight,
                    absenteeismPercentage: absenteeismPercentage,
                    grade: grade
                };
            });

            setStats(newStats);
        } catch (error) {
            console.error('Error fetching attendance summary:', error);
        } finally {
            setLoading(false);
        }
    }

    const handlePrint = () => { window.print(); };

    return (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '2rem' }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: '900px', maxHeight: '90vh', overflow: 'auto', padding: '2rem', position: 'relative', background: '#1e1b4b' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }} className="no-print">
                    <h2 style={{ margin: 0 }}>Cálculo de Asistencia (5%) - {seccionName} - Semestre {periodo}</h2>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button onClick={handlePrint} className="btn-primary" style={{ background: 'var(--primary)' }}>🖨️ Imprimir PDF</button>
                        <button onClick={onClose} className="btn-primary" style={{ background: 'rgba(255,255,255,0.1)' }}>Cerrar</button>
                    </div>
                </div>

                <div className="only-print" style={{ display: 'none', textAlign: 'center', marginBottom: '2rem' }}>
                    <h1 style={{ color: 'black' }}>Reporte de Evaluación de Asistencia - MEP 2026</h1>
                    <p style={{ color: 'black' }}>Sección: {seccionName} | Semestre: {periodo} | Valor: 5%</p>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '3rem' }}>Cargando datos...</div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--glass-border)' }}>
                                    <th style={{ textAlign: 'left', padding: '1rem' }}>Estudiante</th>
                                    <th style={{ textAlign: 'center', padding: '1rem' }}>Lecciones Impartidas</th>
                                    <th style={{ textAlign: 'center', padding: '1rem' }}>Peso Ausentismo (Injust.)</th>
                                    <th style={{ textAlign: 'center', padding: '1rem' }}>Ausencias (Floor)</th>
                                    <th style={{ textAlign: 'center', padding: '1rem' }}>% Ausentismo</th>
                                    <th style={{ textAlign: 'center', padding: '1rem', color: 'var(--primary)', fontWeight: 800 }}>NOTA FINAL (5%)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {estudiantes.map(est => {
                                    const s = stats[est.cedula] || { totalLessons: 0, totalWeight: 0, grade: 5 };
                                    return (
                                        <tr key={est.cedula} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            <td style={{ padding: '0.75rem 1rem' }}>{est.apellidos}, {est.nombre}</td>
                                            <td style={{ textAlign: 'center', padding: '0.75rem' }}>{s.totalLessons}</td>
                                            <td style={{ textAlign: 'center', padding: '0.75rem' }}>{s.totalWeight.toFixed(1)}</td>
                                            <td style={{ textAlign: 'center', padding: '0.75rem' }}>{Math.floor(s.totalWeight)}</td>
                                            <td style={{ textAlign: 'center', padding: '0.75rem' }}>{(s as any).absenteeismPercentage ? (s as any).absenteeismPercentage.toFixed(1) : 0}%</td>
                                            <td style={{ textAlign: 'center', padding: '0.75rem', fontWeight: 800, color: 'var(--primary)', fontSize: '1.1rem' }}>{s.grade}%</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        <div style={{ marginTop: '2rem', fontSize: '0.8rem', color: 'var(--text-muted)' }} className="no-print">
                            <p><strong>Nota:</strong> Las tardías injustificadas suman 0.5. Las ausencias justificadas (J) no se contabilizan. Se aplica MATH FLOOR al peso total antes del cálculo.</p>
                        </div>
                    </div>
                )}

                <style>{`
                    @media print {
                        @page { size: portrait; margin: 15mm; }
                        
                        html, body { 
                            height: auto !important; 
                            overflow: visible !important; 
                            background: white !important;
                            margin: 0 !important;
                            padding: 0 !important;
                        }
                        /* Reset layout for print */
                        .app-layout { display: block !important; }
                        .sidebar { display: none !important; }
                        .container { 
                            padding: 0 !important; 
                            margin: 0 !important; 
                            max-width: none !important; 
                            width: 100% !important; 
                        }

                        .modal-overlay, .modal-overlay * { visibility: visible; }
                        .modal-overlay { 
                            position: static !important; 
                            width: 100% !important; 
                            background: white !important; 
                            padding: 0 !important; 
                            display: block !important;
                            overflow: visible !important;
                        }
                        .glass-card { 
                            background: white !important; 
                            border: none !important; 
                            color: black !important; 
                            width: 100% !important; 
                            max-width: 100% !important; 
                            box-shadow: none !important; 
                            overflow: visible !important;
                            display: block !important;
                            backdrop-filter: none !important;
                            -webkit-backdrop-filter: none !important;
                        }
                        .no-print { display: none !important; }
                        .only-print { display: block !important; }
                        table { 
                            width: 100% !important; 
                            border-collapse: collapse !important; 
                            margin-top: 20px !important; 
                            table-layout: auto !important;
                        }
                        th, td { 
                            border: 1px solid black !important; 
                            padding: 8px !important; 
                            color: black !important; 
                            text-align: center;
                            page-break-inside: avoid !important;
                        }
                        th { background: #eee !important; font-weight: bold !important; }
                        td:first-child { text-align: left !important; }
                        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    }
                `}</style>
            </div>
        </div>
    );
};
