import React from 'react';

interface SidebarProps {
    className?: string;
    currentView: 'attendance' | 'students' | 'cotidiano' | 'tareas' | 'examenes' | 'asistencia_nota' | 'reports';
    onViewChange: (view: 'attendance' | 'students' | 'cotidiano' | 'tareas' | 'examenes' | 'asistencia_nota' | 'reports') => void;
    periodo: number;
    onPeriodoChange: (periodo: number) => void;
    onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ className, currentView, onViewChange, periodo, onPeriodoChange, onLogout }) => {
    const evaluationItems = [
        { id: 'attendance', icon: '📅', label: 'Asistencia' },
        { id: 'cotidiano', icon: '📝', label: 'Trabajo Cotidiano' },
        { id: 'tareas', icon: '📚', label: 'Tareas' },
        { id: 'examenes', icon: '✍️', label: 'Exámenes' },
    ];

    const managementItems = [
        { id: 'reports', icon: '📊', label: 'Reportes' },
        { id: 'students', icon: '👤', label: 'Estudiantes' },
    ];

    const enabledViews = ['attendance', 'asistencia_nota', 'cotidiano', 'tareas', 'examenes', 'reports', 'students'];

    const renderNavItem = (item: any) => {
        const isEnabled = enabledViews.includes(item.id);
        return (
            <button
                key={item.id}
                onClick={() => isEnabled && onViewChange(item.id as any)}
                className={`nav-item ${currentView === item.id ? 'active' : ''}`}
                style={{
                    background: 'none',
                    border: 'none',
                    width: '100%',
                    textAlign: 'left',
                    cursor: isEnabled ? 'pointer' : 'not-allowed',
                    opacity: isEnabled ? 1 : 0.5,
                    fontFamily: 'inherit',
                    fontSize: 'inherit',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.85rem 1rem',
                    borderRadius: '12px',
                    color: currentView === item.id ? 'var(--primary)' : 'var(--text-muted)',
                    transition: 'all 0.3s ease'
                }}
            >
                <span className="nav-icon" style={{ fontSize: '1.2rem' }}>{item.icon}</span>
                <span className="nav-label" style={{ fontWeight: 600 }}>{item.label}</span>
            </button>
        );
    };

    return (
        <aside className={`sidebar glass-card ${className || ''}`} style={{ display: 'flex', flexDirection: 'column', background: 'var(--glass-bg)', borderRight: '1px solid var(--glass-border)' }}>
            <div className="sidebar-header" style={{ padding: '1.5rem 1rem' }}>
                <div className="logo">
                    <span className="logo-icon" style={{ fontSize: '1.8rem' }}>📋</span>
                    <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                        <span className="logo-text" style={{ fontSize: '1.1rem', fontWeight: 800, background: 'linear-gradient(135deg, var(--primary) 0%, #1d4ed8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Registro Notas</span>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em' }}>MEP 2026</span>
                    </div>
                </div>
            </div>

            <div className="semester-selector" style={{ padding: '0 1rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', paddingLeft: '1rem' }}>
                    Periodo Académico
                </div>
                <div style={{ display: 'flex', background: 'rgba(0,0,0,0.03)', padding: '0.25rem', borderRadius: '10px', gap: '0.25rem', border: '1px solid var(--glass-border)' }}>
                    {[1, 2].map(p => (
                        <button
                            key={p}
                            onClick={() => onPeriodoChange(p)}
                            style={{
                                flex: 1,
                                padding: '0.5rem',
                                borderRadius: '8px',
                                background: periodo === p ? 'var(--primary)' : 'transparent',
                                border: 'none',
                                color: periodo === p ? 'white' : 'var(--text-main)',
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            Semestre {p}
                        </button>
                    ))}
                </div>
            </div>

            <nav className="sidebar-nav" style={{ flex: 1, padding: '0 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div className="nav-section-label" style={{ padding: '1.5rem 1rem 0.5rem', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    Docencia y Evaluación
                </div>
                {evaluationItems.map(renderNavItem)}

                <div style={{ margin: '1rem 0.75rem', height: '1px', background: 'linear-gradient(to right, transparent, var(--glass-border), transparent)', opacity: 0.5 }} />

                <div className="nav-section-label" style={{ padding: '0.5rem 1rem 0.5rem', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    Administración
                </div>
                {managementItems.map(renderNavItem)}
            </nav>


            <div className="sidebar-footer" style={{ padding: '1.5rem 1rem', borderTop: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="user-profile" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div className="user-avatar" style={{ width: '40px', height: '40px', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>👤</div>
                    <div className="user-info" style={{ display: 'flex', flexDirection: 'column' }}>
                        <span className="user-name" style={{ fontWeight: 600, fontSize: '0.9rem' }}>Profesor</span>
                        <span className="user-role" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Administrador</span>
                    </div>
                </div>
                
                {onLogout && (
                    <button 
                        onClick={onLogout}
                        style={{
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            color: '#fca5a5',
                            padding: '0.6rem',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            transition: 'all 0.2s',
                            width: '100%'
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)' }}
                        onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)' }}
                        title="Cerrar sesión y volver al login"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                            <polyline points="16 17 21 12 16 7"></polyline>
                            <line x1="21" y1="12" x2="9" y2="12"></line>
                        </svg>
                        Cerrar Sesión
                    </button>
                )}
            </div>
        </aside>
    );
};
