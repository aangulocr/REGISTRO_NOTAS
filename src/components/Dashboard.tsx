import React, { useEffect, useState } from 'react';
import { sqliteService } from '../lib/sqliteService';
import { Database } from '../types/database'; // Mantener por tipos si es necesario

interface Props {
    seccionId: string;
    periodo: number;
}

export function Dashboard({ seccionId, periodo }: Props) {
    const [stats, setStats] = useState({
        leccionesProgramadas: 0,
        ausenciasPromedio: 0,
        porcentaje: 0
    });

    useEffect(() => {
        calculateStats();
    }, [seccionId, periodo]);

    async function calculateStats() {
        // 1. Get student count
        const { data: studentData } = await sqliteService.query(
            'SELECT COUNT(*) as count FROM estudiantes WHERE seccion_id = ?',
            [seccionId]
        );
        const totalStudents = studentData?.[0]?.count || 1;

        // 2. Get attendance records with JOIN
        const { data: attendanceData } = await sqliteService.query(
            `SELECT ca.fecha, ca.estado_id, ea.peso_ausencia 
             FROM control_asistencia ca 
             JOIN estados_asistencia ea ON ca.estado_id = ea.id 
             WHERE ca.seccion_id = ? AND ca.periodo = ?`,
            [seccionId, periodo]
        );

        // 3. Get daily configurations
        const { data: configData } = await sqliteService.query(
            'SELECT fecha, lecciones_totales FROM configuracion_diaria WHERE seccion_id = ? AND periodo = ?',
            [seccionId, periodo]
        );

        const configMap: Record<string, number> = {};
        configData?.forEach((c: any) => {
            configMap[c.fecha] = c.lecciones_totales;
        });

        // Calculate unique dates with records to get "Total Programmed Lessons"
        const typedAttendance = attendanceData as Database['public']['Tables']['control_asistencia']['Row'][] | null;
        const uniqueDates = Array.from(new Set(typedAttendance?.map(a => a.fecha) || []));
        let leccionesProgramadas = 0;
        uniqueDates.forEach(date => {
            leccionesProgramadas += configMap[date] || 4;
        });

        let sumAbsenceWeights = 0;
        typedAttendance?.forEach((r: any) => {
            const lessonsToday = configMap[r.fecha] || 4;
            let peso = r.estados_asistencia?.peso_ausencia || 0;
            if (peso > 0) {
                // Scale weight proportionally to today's lessons
                peso = (peso / 4) * lessonsToday;
                sumAbsenceWeights += peso;
            }
        });

        const ausenciasPromedio = sumAbsenceWeights / totalStudents;
        const porcentaje = leccionesProgramadas > 0 ? (ausenciasPromedio / leccionesProgramadas) * 100 : 0;

        setStats({
            leccionesProgramadas,
            ausenciasPromedio: parseFloat(ausenciasPromedio.toFixed(2)),
            porcentaje: parseFloat(porcentaje.toFixed(2))
        });
    }

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
            <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Lecciones Programadas</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats.leccionesProgramadas}</div>
            </div>
            <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Ausencias Promedio</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--danger)' }}>{stats.ausenciasPromedio}</div>
            </div>
            <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center', borderLeft: '4px solid var(--primary)' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Indice de Ausentismo</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats.porcentaje}%</div>
            </div>
        </div>
    );
}
