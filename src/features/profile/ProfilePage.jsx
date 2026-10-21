import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorState, KeyValue, Loader, PageHeader } from '../../ui';
import { useApi } from '../../lib/hooks.js';
import { RecordForm } from '../admin/components.jsx';
import { getProfile, updateProfile } from './api.js';
import { useAuth } from '../../lib/auth/AuthProvider.jsx';

export default function ProfilePage() {
  const { t } = useTranslation('profile');
  const { updateSession } = useAuth();
  const saveProfile = async (body) => {
    const saved = await updateProfile(body);
    // The integrated base supports session updates. Keep compatibility with the
    // older administration-only base while reflecting the server's saved email.
    updateSession?.({ email: saved.email });
    return saved;
  };
  const state = useApi(getProfile);
  const pageRef = useRef(null);
  const errorRef = useRef(null);
  const recovering = useRef(false);
  useEffect(() => {
    if (state.loading) return;
    if (state.error) {
      recovering.current = true;
      errorRef.current?.focus();
    } else if (state.data && recovering.current) {
      pageRef.current?.querySelector('input[type="email"]')?.focus();
      recovering.current = false;
    }
  }, [state.loading, state.error, state.data]);
  return <div ref={pageRef} className="admin-stack">
    <PageHeader eyebrow={t('account')} title={t('title')} lede={t('hint')} />
    {state.loading ? <Loader /> : state.error ? <div ref={errorRef} tabIndex={-1}><ErrorState error={state.error} onRetry={state.reload} /></div> : state.data && <>
      <KeyValue items={['first_name', 'last_name', 'nia', 'dni'].map((key) => ({ label: t(key), value: state.data[key] || '—' }))} />
      <RecordForm focusOnSaved initial={{ email: state.data.email, email_notifications_enabled: state.data.email_notifications_enabled }} fields={[
        { name: 'email', label: t('email'), type: 'email', autoComplete: 'email', required: true },
        { name: 'email_notifications_enabled', label: t('notifications'), type: 'checkbox' },
      ]} onSave={saveProfile} />
    </>}
  </div>;
}
