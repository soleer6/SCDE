import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../lib/auth/AuthProvider.jsx';
import { ApiError } from '../../lib/api/errors.js';
import { Button, ErrorState, KeyValue, PageHeader } from '../../ui';
import { createOrganization } from './api.js';
import { RecordForm } from './components.jsx';

const empty = { name: '', subdomain: '', plan: 'FREE', manager_email: '', manager_first_name: '', manager_last_name: '' };

export default function OrganizationsPage() {
  const { session } = useAuth();
  const { t } = useTranslation('admin');
  const [created, setCreated] = useState(null);
  const resultRef = useRef(null);
  useEffect(() => { if (created) resultRef.current?.focus(); }, [created]);
  if (!session?.isSuperadmin) return <>
    <PageHeader title={t('organizations')} />
    <ErrorState error={new ApiError('PERMISSION_DENIED', 403)} title={t('orgSuperadminOnly')} />
  </>;
  async function save(values) {
    try {
      const org = await createOrganization({ name: values.name, subdomain: values.subdomain, plan: values.plan,
        initial_manager: { email: values.manager_email, first_name: values.manager_first_name, last_name: values.manager_last_name } });
      setCreated(org);
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      const nested = err.fields?.initial_manager;
      // Keep the shared form's field errors/focus without changing the API shape.
      const fields = { ...err.fields };
      for (const key of ['email', 'first_name', 'last_name']) {
        const codes = fields[`initial_manager.${key}`] ?? nested?.[key];
        if (codes) fields[`manager_${key}`] = codes;
      }
      // The common dictionary may not yet include organization-specific codes.
      const code = err.code === 'SUBDOMAIN_ALREADY_EXISTS' ? 'CONFLICT' : err.code;
      if (fields.subdomain?.includes('SUBDOMAIN_ALREADY_EXISTS')) fields.subdomain = ['CONFLICT'];
      throw new ApiError(code, err.status, fields, err.data);
    }
  }
  return <div className="admin-stack">
    <PageHeader eyebrow={t('management')} title={t('organizations')} lede={t('orgHint')} />
    {created ? <section ref={resultRef} tabIndex={-1} aria-label={t('orgCreated')}>
      <h2 className="ui-h2">{t('orgCreated')}</h2>
      <KeyValue items={['name', 'subdomain', 'plan', 'id'].map(key => ({ label: t(`orgFields.${key}`), value: created[key] }))} />
      <p>{t('orgCredentialsHint')}</p>
      <Button onClick={() => setCreated(null)}>{t('orgAnother')}</Button>
    </section> : <RecordForm initial={empty} onSave={save} submitLabel={t('orgCreate')} fields={[
      { name: 'name', label: t('orgFields.name'), required: true, maxLength: 255, autoFocus: true },
      { name: 'subdomain', label: t('orgFields.subdomain'), required: true, maxLength: 63, pattern: '[-a-zA-Z0-9_]+' },
      { name: 'plan', label: t('orgFields.plan'), type: 'select', options: ['FREE', 'PREMIUM'].map(value => ({ value, label: t(`orgPlans.${value}`) })) },
      { name: 'manager_email', label: t('orgManagerEmail'), type: 'email', required: true },
      { name: 'manager_first_name', label: t('orgManagerFirstName'), required: true, maxLength: 150 },
      { name: 'manager_last_name', label: t('orgManagerLastName'), required: true, maxLength: 150 },
    ]} />}
  </div>;
}
