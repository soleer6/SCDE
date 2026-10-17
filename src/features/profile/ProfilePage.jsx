import { useTranslation } from 'react-i18next';
import { ErrorState, KeyValue, Loader, PageHeader } from '../../ui';
import { useApi } from '../../lib/hooks.js';
import { RecordForm } from '../admin/components.jsx';
import { getProfile, updateProfile } from './api.js';

export default function ProfilePage() {
  const { t } = useTranslation('profile');
  const state = useApi(getProfile);
  return <div className="admin-stack">
    <PageHeader eyebrow={t('account')} title={t('title')} lede={t('hint')} />
    {state.loading ? <Loader /> : state.error ? <ErrorState error={state.error} onRetry={state.reload} /> : state.data && <>
      <KeyValue items={['first_name', 'last_name', 'nia', 'dni'].map((key) => ({ label: t(key), value: state.data[key] || '—' }))} />
      <RecordForm initial={{ email: state.data.email, email_notifications_enabled: state.data.email_notifications_enabled }} fields={[
        { name: 'email', label: t('email'), type: 'email', required: true },
        { name: 'email_notifications_enabled', label: t('notifications'), type: 'checkbox' },
      ]} onSave={updateProfile} />
    </>}
  </div>;
}
