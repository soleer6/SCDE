import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/auth/AuthProvider.jsx';
import { USE_MOCK } from '../lib/api/client.js';
import { navFor, slot } from './registry.js';
import './shell.css';

const SECTIONS = ['work', 'manage', 'account'];

export default function AppShell() {
  const { session, logout } = useAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const items = navFor(session);
  const endSlots = slot('topbar.end');

  const onLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="shell">
      <header className="shell-topbar">
        <NavLink to="/" className="shell-brand">
          <span className="shell-brand__mark" aria-hidden="true">S</span>
          {t('brand')}
        </NavLink>
        <span className="shell-topbar__meta">{t('brandLong')}</span>
        {USE_MOCK && <span className="shell-topbar__mock">{t('mockMode')}</span>}
        <div className="shell-topbar__end">
          {endSlots.map((Slot, i) => (
            <Slot key={i} />
          ))}
          <button
            type="button"
            className="shell-topbar__btn"
            onClick={() => i18n.changeLanguage(i18n.resolvedLanguage === 'es' ? 'en' : 'es')}
            aria-label={t('language')}
          >
            {i18n.resolvedLanguage === 'es' ? 'EN' : 'ES'}
          </button>
          <span className="shell-topbar__user" title={session?.email}>
            <span className="shell-topbar__avatar" aria-hidden="true">
              {session?.firstName?.[0]}
              {session?.lastName?.[0]}
            </span>
            <span className="shell-topbar__name">
              {session?.firstName} {session?.lastName}
            </span>
          </span>
          <button type="button" className="shell-topbar__btn" onClick={onLogout}>
            {t('logout')}
          </button>
        </div>
      </header>

      <nav className="shell-rail" aria-label="Main">
        {SECTIONS.map((section) => {
          const list = items.filter((n) => (n.section ?? 'work') === section);
          if (!list.length) return null;
          return (
            <div key={section} className="shell-rail__group">
              <p className="shell-rail__title">{t(`nav.${section}`)}</p>
              <ul>
                {list.map((n) => (
                  <li key={n.to}>
                    <NavLink to={n.to} end={n.end} className="shell-rail__link">
                      <i aria-hidden="true" />
                      {t(n.label)}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>

      <main className="shell-main">
        <Outlet />
      </main>
    </div>
  );
}
