import React, { useState } from 'react';
import { sqliteService } from '../lib/sqliteService';

interface LoginProps {
    onLogin: () => void;
}

export function Login({ onLogin }: LoginProps) {
    const [isRegistering, setIsRegistering] = useState(false);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        
        if (!email || !password || (isRegistering && !name)) return;

        setIsLoading(true);
        try {
            if (isRegistering) {
                // Registrar nuevo docente
                const newId = `docente-${Date.now()}`;
                const { error } = await sqliteService.from('docentes').insert({
                    id: newId,
                    nombre: name,
                    email: email,
                    password: password
                });

                if (error) {
                    if (error.includes('UNIQUE constraint failed')) {
                        setErrorMsg('Este correo ya está registrado.');
                    } else {
                        setErrorMsg(`Error al registrar: ${error}`);
                    }
                } else {
                    // Si se registra con éxito, auto iniciar sesión
                    onLogin();
                }
            } else {
                // Iniciar sesión
                const { data, error } = await sqliteService.query(
                    'SELECT * FROM docentes WHERE email = ? AND password = ?',
                    [email, password]
                );

                if (error) {
                    setErrorMsg('Error al conectar con la base de datos.');
                } else if (data && data.length > 0) {
                    onLogin();
                } else {
                    setErrorMsg('Correo o contraseña incorrectos.');
                }
            }
        } catch (err) {
            setErrorMsg('Ocurrió un error inesperado.');
        } finally {
            setIsLoading(false);
        }
    };

    const toggleMode = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsRegistering(!isRegistering);
        setErrorMsg('');
        setEmail('');
        setPassword('');
        setName('');
        setShowPassword(false);
    };

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            width: '100%',
            background: 'var(--bg-gradient)',
            fontFamily: "'Outfit', sans-serif"
        }}>
            <div className="glass-card" style={{
                width: '100%',
                maxWidth: '420px',
                padding: '3rem 2.5rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                background: 'rgba(30, 31, 56, 0.7)',
                borderRadius: '24px',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}>
                {/* Icon Container */}
                <div style={{
                    width: '72px',
                    height: '72px',
                    borderRadius: '20px',
                    background: 'linear-gradient(135deg, #818cf8, #c084fc)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '1.5rem',
                    boxShadow: '0 10px 25px rgba(99, 102, 241, 0.4)'
                }}>
                    <div style={{
                        width: '66px',
                        height: '66px',
                        borderRadius: '18px',
                        background: '#1e1b4b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 2C9.243 2 7 4.243 7 7V10H6C4.895 10 4 10.895 4 12V20C4 21.105 4.895 22 6 22H18C19.105 22 20 21.105 20 20V12C20 10.895 19.105 10 18 10H17V7C17 4.243 14.757 2 12 2ZM12 4C13.654 4 15 5.346 15 7V10H9V7C9 5.346 10.346 4 12 4ZM12 14C13.105 14 14 14.895 14 16C14 17.105 13.105 18 12 18C10.895 18 10 17.105 10 16C10 14.895 10.895 14 12 14Z" fill="#fbbf24"/>
                            <path d="M15 10V7C15 5.346 13.654 4 12 4V10H15Z" fill="#f59e0b"/>
                        </svg>
                    </div>
                </div>

                <h1 style={{
                    fontSize: '2rem',
                    marginBottom: '0.5rem',
                    background: 'linear-gradient(to right, #a78bfa, #c084fc)',
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    color: 'transparent',
                    textAlign: 'center',
                    fontWeight: '700'
                }}>
                    {isRegistering ? 'Crear Cuenta' : 'Bienvenido'}
                </h1>
                
                <p style={{
                    color: '#8a8d9b',
                    fontSize: '0.95rem',
                    marginBottom: '2.5rem',
                    textAlign: 'center'
                }}>
                    {isRegistering ? 'Registra tus credenciales de docente' : 'Ingresa tus credenciales para continuar'}
                </p>

                <form onSubmit={handleSubmit} style={{ width: '100%' }}>
                    {errorMsg && (
                        <div style={{
                            marginBottom: '1.5rem',
                            padding: '0.75rem 1rem',
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: '12px',
                            color: '#fca5a5',
                            fontSize: '0.875rem',
                            textAlign: 'center',
                            fontWeight: '500'
                        }}>
                            {errorMsg}
                        </div>
                    )}

                    {isRegistering && (
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{
                                display: 'block',
                                fontSize: '0.75rem',
                                fontWeight: '600',
                                color: '#94a3b8',
                                marginBottom: '0.5rem',
                                letterSpacing: '0.05em'
                            }}>
                                NOMBRE COMPLETO
                            </label>
                            <input
                                type="text"
                                placeholder="Ej: Juan Pérez"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                disabled={isLoading}
                                style={{
                                    width: '100%',
                                    padding: '0.875rem 1rem',
                                    background: 'rgba(255, 255, 255, 0.03)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    borderRadius: '12px',
                                    color: 'white',
                                    fontSize: '0.95rem',
                                    outline: 'none',
                                    transition: 'border-color 0.2s',
                                    opacity: isLoading ? 0.7 : 1
                                }}
                                onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                                onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
                            />
                        </div>
                    )}

                    <div style={{ marginBottom: '1.5rem' }}>
                        <label htmlFor="email" style={{
                            display: 'block',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            color: '#94a3b8',
                            marginBottom: '0.5rem',
                            letterSpacing: '0.05em'
                        }}>
                            CORREO ELECTRÓNICO
                        </label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            autoComplete="username"
                            placeholder="docente@ejemplo.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            disabled={isLoading}
                            style={{
                                width: '100%',
                                padding: '0.875rem 1rem',
                                background: 'rgba(255, 255, 255, 0.03)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '12px',
                                color: 'white',
                                fontSize: '0.95rem',
                                outline: 'none',
                                transition: 'border-color 0.2s',
                                opacity: isLoading ? 0.7 : 1
                            }}
                            onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                            onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
                        />
                    </div>

                    <div style={{ marginBottom: '2rem' }}>
                        <label htmlFor="password" style={{
                            display: 'block',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            color: '#94a3b8',
                            marginBottom: '0.5rem',
                            letterSpacing: '0.05em'
                        }}>
                            CONTRASEÑA
                        </label>
                        <div style={{ position: 'relative', width: '100%' }}>
                            <input
                                id="password"
                                name="password"
                                type={showPassword ? 'text' : 'password'}
                                autoComplete={isRegistering ? "new-password" : "current-password"}
                                placeholder="........"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                disabled={isLoading}
                                style={{
                                    width: '100%',
                                    padding: '0.875rem 2.5rem 0.875rem 1rem',
                                    background: 'rgba(255, 255, 255, 0.03)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    borderRadius: '12px',
                                    color: 'white',
                                    fontSize: '0.95rem',
                                    outline: 'none',
                                    transition: 'border-color 0.2s',
                                    letterSpacing: (!showPassword && password) ? '0.2em' : 'normal',
                                    opacity: isLoading ? 0.7 : 1
                                }}
                                onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                                onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                style={{
                                    position: 'absolute',
                                    right: '0.75rem',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: 'none',
                                    color: '#94a3b8',
                                    cursor: 'pointer',
                                    padding: '0.25rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'color 0.2s',
                                    outline: 'none'
                                }}
                                onMouseOver={(e) => e.currentTarget.style.color = '#a78bfa'}
                                onMouseOut={(e) => e.currentTarget.style.color = '#94a3b8'}
                                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                            >
                                {showPassword ? (
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                                        <line x1="1" y1="1" x2="23" y2="23"></line>
                                    </svg>
                                ) : (
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                        <circle cx="12" cy="12" r="3"></circle>
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="btn-primary"
                        disabled={isLoading}
                        style={{
                            width: '100%',
                            padding: '0.875rem',
                            fontSize: '1rem',
                            borderRadius: '12px',
                            background: '#6366f1',
                            marginBottom: '2rem',
                            fontWeight: '600',
                            opacity: isLoading ? 0.7 : 1,
                            cursor: isLoading ? 'not-allowed' : 'pointer'
                        }}
                    >
                        {isLoading ? (isRegistering ? 'Registrando...' : 'Verificando...') : (isRegistering ? 'Registrarse' : 'Ingresar')}
                    </button>
                </form>

                <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {!isRegistering && (
                        <a href="#" onClick={(e) => e.preventDefault()} style={{
                            color: '#94a3b8',
                            fontSize: '0.875rem',
                            textDecoration: 'underline',
                            textDecorationColor: 'rgba(148, 163, 184, 0.4)',
                            textUnderlineOffset: '4px'
                        }}>
                            ¿Olvidaste tu contraseña?
                        </a>
                    )}
                    <a href="#" onClick={toggleMode} style={{
                        color: '#a78bfa',
                        fontSize: '0.9rem',
                        fontWeight: '500',
                        textDecoration: 'none'
                    }}>
                        {isRegistering ? '¿Ya tienes cuenta? Ingresa aquí' : 'Crea tu cuenta de docente aquí'}
                    </a>
                </div>
            </div>
        </div>
    );
}
