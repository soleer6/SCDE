import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './LoginPage.css';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!email.trim() || !password) {
            setError('Por favor, introduce tu email y contraseña.');
            return;
        }

        setLoading(true);
        try {
            const user = await login(email.trim(), password);
            // Redirect based on role
            if (user.rol === 'CORRECTOR') {
                navigate('/profesor/asignaturas', { replace: true });
            } else {
                navigate('/alumno/asignaturas', { replace: true });
            }
        } catch (err) {
            setError(err.message || 'Error al iniciar sesión. Inténtalo de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            {/* Background decoration */}
            <div className="login-bg">
                <div className="login-bg__circle login-bg__circle--1" />
                <div className="login-bg__circle login-bg__circle--2" />
                <div className="login-bg__circle login-bg__circle--3" />
            </div>

            <div className="login-container">
                {/* Branding */}
                <div className="login-brand">
                    <div className="login-brand__icon">
                        <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
                            <rect width="48" height="48" rx="12" fill="white" fillOpacity="0.15" />
                            <path d="M24 10L40 18V28L24 36L8 28V18L24 10Z" stroke="white" strokeWidth="2.5" strokeLinejoin="round" />
                            <path d="M24 10V24M8 18L24 24M40 18L24 24" stroke="white" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                    </div>
                    <div>
                        <h1 className="login-brand__name">SCDE</h1>
                        <p className="login-brand__desc">Sistema de Corrección Digital de Exámenes</p>
                    </div>
                </div>

                {/* Card */}
                <div className="login-card">
                    <div className="login-card__header">
                        <h2 className="login-card__title">Iniciar sesión</h2>
                        <p className="login-card__subtitle">Accede con tus credenciales universitarias</p>
                    </div>

                    <form className="login-form" onSubmit={handleSubmit} noValidate>
                        {error && (
                            <div className="login-error" role="alert">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="8" x2="12" y2="12" />
                                    <line x1="12" y1="16" x2="12.01" y2="16" />
                                </svg>
                                {error}
                            </div>
                        )}

                        <div className="form-group">
                            <label className="form-label" htmlFor="email">
                                Correo electrónico
                            </label>
                            <div className="input-wrapper">
                                <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                    <polyline points="22,6 12,13 2,6" />
                                </svg>
                                <input
                                    id="email"
                                    type="email"
                                    className="form-input"
                                    placeholder="usuario@uni.es"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    autoComplete="email"
                                    disabled={loading}
                                    required
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="password">
                                Contraseña
                            </label>
                            <div className="input-wrapper">
                                <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                </svg>
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    className="form-input"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    autoComplete="current-password"
                                    disabled={loading}
                                    required
                                />
                                <button
                                    type="button"
                                    className="input-toggle"
                                    onClick={() => setShowPassword((v) => !v)}
                                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                    tabIndex={-1}
                                >
                                    {showPassword ? (
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                            <line x1="1" y1="1" x2="23" y2="23" />
                                        </svg>
                                    ) : (
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                            <circle cx="12" cy="12" r="3" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className={`btn-submit ${loading ? 'btn-submit--loading' : ''}`}
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <span className="spinner spinner--sm" />
                                    Verificando...
                                </>
                            ) : (
                                'Acceder'
                            )}
                        </button>
                    </form>

                    <p className="login-card__footer-note">
                        ¿Problemas de acceso? Contacta con el soporte técnico universitario.
                    </p>
                </div>

                <p className="login-page__legal">
                    © 2025 Universidad · Sistema de Corrección Digital de Exámenes
                </p>
            </div>
        </div>
    );
}
