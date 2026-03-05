import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import './AppLayout.css';

export default function AppLayout() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();

    const handleLanguageChange = (e) => {
        i18n.changeLanguage(e.target.value);
    };

    const handleLogout = () => {
        logout();
        navigate('/login', { replace: true });
    };

    const fullName = user ? `${user.firstName} ${user.lastName}` : '';
    const roleLabel = user?.role === 'PROFESSOR' ? 'Profesor' : 'Estudiante';
    const roleBadgeClass = user?.role === 'PROFESSOR' ? 'badge--profesor' : 'badge--alumno';

    return (
        <div className="app-layout">
            <header className="app-header">
                <div className="app-header__brand">
                    <div className="app-header__logo">
                        <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
                            <rect width="40" height="40" rx="8" fill="white" fillOpacity="0.15" />
                            <path d="M20 8L34 16V24L20 32L6 24V16L20 8Z" stroke="white" strokeWidth="2" strokeLinejoin="round" />
                            <path d="M20 8V20M6 16L20 20M34 16L20 20" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                    </div>
                    <div className="app-header__title">
                        <span className="app-header__system-name">{t('header.title')}</span>
                        <span className="app-header__system-desc">Sistema de Corrección Digital</span>
                    </div>
                </div>

                <nav className="app-header__nav">
                    <div className="app-header__user">
                        <div className="user-avatar" aria-hidden="true">
                            {user?.firstName?.[0]}{user?.lastName?.[0]}
                        </div>
                        <div className="user-info">
                            <span className="user-info__name">{fullName}</span>
                            <span className={`user-info__badge ${roleBadgeClass}`}>{roleLabel}</span>
                        </div>
                    </div>
                    <select
                        className="i18n-selector"
                        value={i18n.language.split('-')[0]}
                        onChange={handleLanguageChange}
                        style={{ background: 'transparent', color: 'white', border: 'none', marginRight: '1rem', cursor: 'pointer' }}
                    >
                        <option value="es" style={{ color: 'black' }}>Español</option>
                        <option value="en" style={{ color: 'black' }}>English</option>
                    </select>

                    <button className="btn-logout" onClick={handleLogout} title={t('header.logout')}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                            <polyline points="16 17 21 12 16 7" />
                            <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                        <span>{t('header.logout')}</span>
                    </button>
                </nav>
            </header>

            <main className="app-main">
                <Outlet />
            </main>

            <footer className="app-footer">
                <p>© 2025 Universidad · Sistema de Corrección Digital de Exámenes</p>
            </footer>
        </div>
    );
}
