import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../lib/auth/AuthProvider.jsx';
import { USE_MOCK } from '../../lib/api/client.js';
import { Button, Field, Input } from '../../ui';
import './login.css';

const DEMO = [
  ['maria.perez@uam.es', 'prof123', 'COORDINATOR'],
  ['javier.ruiz@uam.es', 'prof123', 'TEACHER'],
  ['elena.rodriguez@estudiante.uam.es', 'est123', 'STUDENT'],
  ['admin@uam.es', 'admin123', 'STAFF'],
];

export default function LoginPage() {
  const { t } = useTranslation('auth');
  const { t: tc } = useTranslation();
  const { login, session } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);

  if (session) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await login(email.trim(), password);
      navigate(location.state?.from?.pathname || '/', { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  };

  const fieldErr = (f) => {
    const code = error?.fieldCode?.(f);
    return code ? tc(`errors.${code}`, { defaultValue: code }) : null;
  };

  return (
    <div className="login">
      <div className="login__grid" aria-hidden="true" />
      <header className="login__top">
        <span className="login__brand">
          <span className="login__mark" aria-hidden="true" />
          {tc('brand')}
        </span>
        <span className="login__meta">{t('meta')}</span>
      </header>

      <section className="login__hero">
        <h1 className="login__display">{t('headline')}</h1>
        <p className="login__sub">{t('sub')}</p>
      </section>

      <form className="login__form" onSubmit={submit} noValidate>
        <h2 className="ui-eyebrow">{t('title')}</h2>
        <Field label={t('email')} error={fieldErr('email')}>
          {(id) => <Input id={id} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />}
        </Field>
        <Field label={t('password')} error={fieldErr('password')}>
          {(id) => (
            <Input id={id} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          )}
        </Field>
        {error && !error.fields && (
          <p className="login__error" role="alert">
            {tc(`errors.${error.code}`, { defaultValue: tc('errors.UNKNOWN') })}
          </p>
        )}
        <Button type="submit" variant="solid" block loading={pending}>
          {t('submit')}
        </Button>

        {USE_MOCK && (
          <div className="login__demo">
            <p className="ui-eyebrow">{t('demo')}</p>
            <ul>
              {DEMO.map(([e, p, role]) => (
                <li key={e}>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail(e);
                      setPassword(p);
                    }}
                  >
                    <span>{e}</span>
                    <span className="u-muted">{tc(`roles.${role}`)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </form>
    </div>
  );
}
