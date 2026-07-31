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
            `SELECT ca.fecha, ca.estudiante_id, ca.estado_id, ea.peso_ausencia, ea.es_justificada 
             FROM control_asistencia ca 
             JOIN estados_asistencia ea ON ca.estado_id = ea.id 
             WHERE ca.seccion_id = ? AND ca.periodo = ?`,
            [seccionId, periodo]
        );

        // Calculate unique dates with records to get "Total Programmed Lessons"
        const typedAttendance = attendanceData as any[] | null;
        const uniqueDates = Array.from(new Set(typedAttendance?.map(a => a.fecha) || []));
        const leccionesProgramadas = uniqueDates.length * 4;

        // Calculate absenteeism weight per student
        const studentWeights: Record<string, number> = {};
        
        // Initialize weights for all students to make sure they are included
        const { data: allEsts } = await sqliteService.query(
            'SELECT cedula FROM estudiantes WHERE seccion_id = ?',
            [seccionId]
        );
        (allEsts || []).forEach((e: any) => {
            studentWeights[e.cedula] = 0;
        });

        typedAttendance?.forEach((r: any) => {
            if (!r.es_justificada) {
                const peso = r.peso_ausencia || 0;
                if (studentWeights[r.estudiante_id] !== undefined) {
                    studentWeights[r.estudiante_id] += peso;
                } else {
                    studentWeights[r.estudiante_id] = peso;
                }
            }
        });

        // Sum the floored weight of each student (as per rule: Math.floor(totalWeight))
        let totalFlooredAbsences = 0;
        Object.values(studentWeights).forEach(weight => {
            totalFlooredAbsences += Math.floor(weight);
        });

        const ausenciasPromedio = totalFlooredAbsences / totalStudents;
        const porcentaje = leccionesProgramadas > 0 ? (totalFlooredAbsences / (leccionesProgramadas * totalStudents)) * 100 : 0;

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
