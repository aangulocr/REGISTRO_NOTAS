import React, { useState, useEffect } from 'react';
import { sqliteService } from './lib/sqliteService';

import { AttendanceTable } from './components/AttendanceTable';
import { Dashboard } from './components/Dashboard';
import { SummaryReport } from './components/SummaryReport';
import { AttendanceSummary } from './components/AttendanceSummary';
import { ToastProvider } from './components/Toast';
import { Login } from './components/Login';

import { Sidebar } from './components/Sidebar';

import { StudentsPage } from './components/StudentsPage';
import { TrabajoCotidianoPage } from './components/TrabajoCotidianoPage';
import { TareasPage } from './components/TareasPage';
import { ExamenesPage } from './components/ExamenesPage';
import { FinalReportPage } from './components/FinalReportPage';

import { getInitialDate2026, formatDateToLocal, getInitialPeriodo, getPeriodoForDate } from './lib/utils';

interface Seccion {
    id: string;
    nombre: string;
    nivel: number;
}

function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [currentView, setCurrentView] = useState<'attendance' | 'students' | 'cotidiano' | 'tareas' | 'examenes' | 'asistencia_nota' | 'reports'>('attendance');
    const [secciones, setSecciones] = useState<Seccion[]>([]);
    const [selectedSeccion, setSelectedSeccion] = useState<string | null>(null);
    const [selectedNivel, setSelectedNivel] = useState<number>(10);
    const today = new Date().toLocaleDateString('en-CA');
    const maxDate = today < '2026-11-30' ? today : '2026-11-30';
    const [selectedDate, setSelectedDate] = useState<string>(getInitialDate2026());
    const [periodo, setPeriodo] = useState<number>(getInitialPeriodo());
    const [showReport, setShowReport] = useState(false);
    const [showAttendanceSummary, setShowAttendanceSummary] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        fetchSecciones();
    }, [currentView]);

    async function fetchSecciones() {
        const { data, error } = await sqliteService.query('SELECT * FROM secciones ORDER BY nombre');
        if (error) {
            console.error('Error fetching sections:', error);
        } else {
            setSecciones(data || []);
        }
    }

    const filteredSecciones = secciones.filter(s => (s as any).nivel === selectedNivel);

    useEffect(() => {
        if (filteredSecciones.length > 0 && (!selectedSeccion || !filteredSecciones.find(s => s.id === selectedSeccion))) {
            setSelectedSeccion(filteredSecciones[0].id);
        }
    }, [selectedNivel, secciones]);

    // Auto-sincronizar semestre al cambiar la fecha seleccionada
    useEffect(() => {
        if (selectedDate) {
            setPeriodo(getPeriodoForDate(selectedDate));
        }
    }, [selectedDate]);

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const date = new Date(e.target.value + 'T00:00:00');
        const day = date.getDay(); // 0 = Domingo, 6 = Sábado
        if (day === 0 || day === 6) {
            alert('Por favor selecciona un día entre lunes y viernes.');
            setRefreshKey(prev => prev + 1); // Reset input if invalid
            return;
        }
        if (e.target.value > today) {
            alert('No puedes registrar asistencia para fechas futuras.');
            return;
        }
        setSelectedDate(e.target.value);
    };

    const handleAttendanceSave = () => {
        setRefreshKey(prev => prev + 1);
    };

    const handleDeleteSeccion = async (id: string, nombre: string) => {
        if (!confirm(`¿Estás seguro de eliminar la sección "${nombre}"? \n\n¡ESTA ACCIÓN ES PERMANENTE e incluye a todos sus estudiantes, notas y asistencia!`)) {
            return;
        }

        const { error } = await sqliteService.from('secciones').delete('id', id);
        if (error) {
            alert(`Error al eliminar sección: ${error}`);
        } else {
            console.log('Sección eliminada');
            fetchSecciones();
            if (selectedSeccion === id) {
                setSelectedSeccion(null);
            }
        }
    };

    return (
        <ToastProvider>
            {!isAuthenticated ? (
                <Login onLogin={() => setIsAuthenticated(true)} />
            ) : (
                <div className="app-layout">
                    <Sidebar
                    currentView={currentView}
                    onViewChange={setCurrentView}
                    periodo={periodo}
                    onPeriodoChange={setPeriodo}
                    onLogout={() => setIsAuthenticated(false)}
                />
                <main className="container" style={{ paddingBottom: '5rem' }}>
                    {currentView === 'attendance' ? (
                        <>
                            {selectedSeccion && <Dashboard key={`${selectedSeccion}-${periodo}-${refreshKey}`} seccionId={selectedSeccion} periodo={periodo} />}

                            <div className="grid" style={{ gridTemplateColumns: 'minmax(250px, 1fr) 3fr' }}>
                                <aside className="grid">
                                    <section className="glass-card" style={{ padding: '1.5rem' }}>
                                        <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Filtros</h2>

                                        <div style={{ marginBottom: '1.5rem' }}>
                                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Fecha (2026)</label>
                                            <input
                                                type="date"
                                                key={refreshKey}
                                                min="2026-02-01"
                                                max={maxDate}
                                                defaultValue={selectedDate}
                                                onChange={handleDateChange}
                                                className="glass-card"
                                                style={{
                                                    width: '100%',
                                                    padding: '0.75rem',
                                                    background: 'rgba(0,0,0,0.02)',
                                                    color: 'var(--text-main)',
                                                    border: '1px solid var(--glass-border)',
                                                    borderRadius: '8px',
                                                    outline: 'none'
                                                }}
                                            />
                                        </div>

                                        <div style={{ marginBottom: '1.5rem' }}>
                                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Nivel Educativo</label>
                                            <div style={{ display: 'flex', gap: '1rem', background: 'rgba(0,0,0,0.02)', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                                                    <input
                                                        type="radio"
                                                        name="nivel"
                                                        value={10}
                                                        checked={selectedNivel === 10}
                                                        onChange={() => setSelectedNivel(10)}
                                                    />
                                                    Décimo
                                                </label>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                                                    <input
                                                        type="radio"
                                                        name="nivel"
                                                        value={11}
                                                        checked={selectedNivel === 11}
                                                        onChange={() => setSelectedNivel(11)}
                                                    />
                                                    Undécimo
                                                </label>
                                            </div>
                                        </div>

                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Sección</label>
                                            <div className="grid" style={{ gap: '0.5rem' }}>
                                                {filteredSecciones.map(s => (
                                                    <div key={s.id} style={{ display: 'flex', gap: '0.5rem' }}>
                                                        <button
                                                            onClick={() => setSelectedSeccion(s.id)}
                                                            className="btn-primary"
                                                            style={{
                                                                background: selectedSeccion === s.id ? 'var(--primary)' : 'rgba(0,0,0,0.03)',
                                                                color: selectedSeccion === s.id ? 'white' : 'var(--text-main)',
                                                                textAlign: 'left',
                                                                padding: '0.75rem',
                                                                border: selectedSeccion === s.id ? 'none' : '1px solid var(--glass-border)',
                                                                flex: 1
                                                            }}
                                                        >
                                                            {s.nombre}
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeleteSeccion(s.id, s.nombre);
                                                            }}
                                                            style={{
                                                                background: 'none',
                                                                border: 'none',
                                                                color: 'var(--danger)',
                                                                cursor: 'pointer',
                                                                fontSize: '1rem',
                                                                padding: '0.5rem',
                                                                opacity: 0.6,
                                                                transition: 'opacity 0.2s'
                                                            }}
                                                            onMouseOver={e => e.currentTarget.style.opacity = '1'}
                                                            onMouseOut={e => e.currentTarget.style.opacity = '0.6'}
                                                            title="Eliminar Sección"
                                                        >
                                                            🗑️
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => setShowReport(true)}
                                            className="btn-primary"
                                            style={{
                                                width: '100%',
                                                marginTop: '2rem',
                                                background: 'rgba(0,0,0,0.03)',
                                                color: 'var(--text-main)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '0.5rem',
                                                border: '1px solid var(--glass-border)'
                                            }}
                                        >
                                            📊 Generar Resumen
                                        </button>

                                        <button
                                            onClick={() => setShowAttendanceSummary(true)}
                                            className="btn-primary"
                                            style={{
                                                width: '100%',
                                                marginTop: '1rem',
                                                background: 'rgba(0, 86, 179, 0.1)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '0.5rem',
                                                border: '1px solid var(--primary)',
                                                color: 'var(--primary)',
                                                fontWeight: 'bold'
                                            }}
                                        >
                                            💯 Nota Asistencia (5%)
                                        </button>
                                    </section>
                                </aside>

                                <div className="glass-card" style={{ padding: '2rem' }}>
                                    {selectedSeccion ? (
                                        <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                                                <h2 style={{ fontSize: '1.5rem' }}>
                                                    {secciones.find(s => s.id === selectedSeccion)?.nombre}
                                                </h2>
                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Lista de Estudiantes</div>
                                                    <div style={{ fontWeight: 600 }}>{formatDateToLocal(selectedDate)}</div>
                                                </div>
                                            </div>

                                            <AttendanceTable
                                                seccionId={selectedSeccion}
                                                fecha={selectedDate}
                                                periodo={periodo}
                                                onSave={handleAttendanceSave}
                                            />
                                        </div>
                                    ) : (
                                        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                                            Selecciona una sección y fecha para comenzar.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : currentView === 'students' ? (
                        <StudentsPage />
                    ) : currentView === 'cotidiano' ? (
                        <TrabajoCotidianoPage periodo={periodo} />
                    ) : currentView === 'tareas' ? (
                        <TareasPage periodo={periodo} />
                    ) : currentView === 'asistencia_nota' ? (
                        <div style={{ paddingTop: '2rem' }}>
                            {selectedSeccion && (
                                <AttendanceSummary
                                    seccionId={selectedSeccion}
                                    periodo={periodo}
                                    onClose={() => setCurrentView('attendance')}
                                />
                            )}
                        </div>
                    ) : currentView === 'reports' ? (
                        <FinalReportPage periodo={periodo} />
                    ) : (
                        <ExamenesPage periodo={periodo} />
                    )}

                    {showReport && selectedSeccion && (
                        <SummaryReport
                            seccionId={selectedSeccion}
                            periodo={periodo}
                            onClose={() => setShowReport(false)}
                        />
                    )}

                    {showAttendanceSummary && selectedSeccion && (
                        <AttendanceSummary
                            seccionId={selectedSeccion}
                            periodo={periodo}
                            onClose={() => setShowAttendanceSummary(false)}
                        />
                    )}
                </main>
            </div>
            )}
        </ToastProvider>
    );
}

export default App;
