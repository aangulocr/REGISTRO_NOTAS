import React, { useEffect, useState } from 'react';
import { sqliteService } from '../lib/sqliteService';
import { formatDateToLocal } from '../lib/utils';

interface Props {
    seccionId: string;
    periodo: number;
    onClose: () => void;
}

interface StudentReport {
    cedula: string;
    nombreCompleto: string;
    fechasAusencias: string[];
    totalAusencias: number;
    porcentaje: number;
    nota: string;
}

export function SummaryReport({ seccionId, periodo, onClose }: Props) {
    const [reports, setReports] = useState<StudentReport[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        generateReport();
    }, [seccionId, periodo]);

    const getNotaAsignada = (porcentaje: number): string => {
        if (porcentaje < 10) return "5%";
        if (porcentaje < 20) return "4%";
        if (porcentaje < 30) return "3%";
        if (porcentaje < 40) return "2%";
        if (porcentaje < 50) return "1%";
        return "0%";
    };

    async function generateReport() {
        setLoading(true);
        try {
            // 1. Estudiantes
            const { data: studentsData } = await sqliteService.query(
                'SELECT * FROM estudiantes WHERE seccion_id = ? ORDER BY apellidos',
                [seccionId]
            );
            const students = studentsData as any[] || [];

            // 2. Asistencia con JOIN a estados_asistencia
            const { data: attendanceData } = await sqliteService.query(
                `SELECT ca.estudiante_id, ca.fecha, ca.estado_id,
                        ea.nombre AS estado_nombre, ea.peso_ausencia, ea.es_justificada
                 FROM control_asistencia ca
                 JOIN estados_asistencia ea ON ca.estado_id = ea.id
                 WHERE ca.seccion_id = ? AND ca.periodo = ?`,
                [seccionId, periodo]
            );
            const attendance = attendanceData as any[] || [];

            // Lecciones programadas globales de la sección en este período (fechas con asistencia * 4)
            const uniqueDates = Array.from(new Set(attendance.map(a => a.fecha)));
            const globalLeccionesProgramadas = uniqueDates.length * 4;

            // 3. Calcular por estudiante
            const studentReports: StudentReport[] = students.map(student => {
                const studentAttendance = attendance.filter(a => a.estudiante_id === student.cedula);

                let studentAbsenceWeight = 0;
                const datesWithAbsence: string[] = [];

                studentAttendance.forEach((record: any) => {
                    if (!record.es_justificada) {
                        const peso = record.peso_ausencia || 0;
                        if (peso > 0) {
                            studentAbsenceWeight += peso;
                            datesWithAbsence.push(`${formatDateToLocal(record.fecha)} (${record.estado_nombre})`);
                        }
                    }
                });

                const finalAbsenceWeight = Math.floor(studentAbsenceWeight);
                const porcentaje = globalLeccionesProgramadas > 0
                    ? (finalAbsenceWeight / globalLeccionesProgramadas) * 100
                    : 0;

                return {
                    cedula: student.cedula,
                    nombreCompleto: `${student.nombre} ${student.apellidos}`,
                    fechasAusencias: datesWithAbsence,
                    totalAusencias: finalAbsenceWeight,
                    porcentaje: parseFloat(porcentaje.toFixed(2)),
                    nota: getNotaAsignada(porcentaje)
                };
            });

            setReports(studentReports);
        } catch (error) {
            console.error('Error generating report:', error);
        } finally {
            setLoading(false);
        }
    }

    if (loading) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(8px)',
            padding: '2rem'
        }}>
            <div className="glass-card" style={{
                padding: '2rem',
                maxWidth: '1200px',
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                position: 'relative',
                animation: 'scaleIn 0.3s ease-out'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
                    <h3 style={{ margin: 0 }}>Resumen de Asistencia y Calificación - Semestre {periodo}</h3>
                    <button
                        onClick={onClose}
                        id="close-report-btn"
                        className="btn-primary"
                        style={{ padding: '0.5rem 1rem', background: 'var(--danger)' }}
                    >
                        Cerrar Resumen
                    </button>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)' }}>
                                <th style={{ textAlign: 'left', padding: '1rem' }}>Estudiante</th>
                                <th style={{ textAlign: 'left', padding: '1rem' }}>Fechas con Ausencia/Tardía</th>
                                <th style={{ textAlign: 'center', padding: '1rem' }}>Total Ausencias</th>
                                <th style={{ textAlign: 'center', padding: '1rem' }}>% Ausentismo</th>
                                <th style={{ textAlign: 'center', padding: '1rem', background: 'rgba(129, 140, 248, 0.1)' }}>Nota Sugerida</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reports.map(report => (
                                <tr key={report.cedula} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td style={{ padding: '1rem', fontWeight: 500 }}>{report.nombreCompleto}</td>
                                    <td style={{ padding: '1rem', fontSize: '0.8rem', maxWidth: '300px' }}>
                                        {report.fechasAusencias.length > 0 ? (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                                                {report.fechasAusencias.map((f, i) => (
                                                    <span key={i} style={{ background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                                                        {f}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <span style={{ color: 'var(--success)', opacity: 0.7 }}>Sin ausencias</span>
                                        )}
                                    </td>
                                    <td style={{ padding: '1rem', textAlign: 'center', color: report.totalAusencias > 0 ? 'var(--danger)' : 'inherit' }}>
                                        {report.totalAusencias}
                                    </td>
                                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                                        {report.porcentaje}%
                                    </td>
                                    <td style={{ padding: '1rem', textAlign: 'center', fontWeight: 700, color: 'var(--primary)' }}>
                                        {report.nota}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
