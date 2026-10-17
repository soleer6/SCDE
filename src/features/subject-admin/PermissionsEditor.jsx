import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorState, Loader, Panel } from '../../ui';
import { useApi } from '../../lib/hooks.js';
import { DEFAULT_PERMISSIONS, PERMISSION_KEYS } from '../../lib/permissions.js';
import { RecordForm } from '../admin/components.jsx';
import { getPermissions, updatePermissions } from './api.js';

export default function PermissionsEditor({ member }) {
  const { t } = useTranslation('subject-admin');
  const [overrides, setOverrides] = useState(member.permission_overrides);
  const state = useApi(() => getPermissions(member.id), [member.id]);
  if (state.loading) return <Loader />;
  if (state.error) return <ErrorState error={state.error} onRetry={state.reload} />;
  if (!state.data) return null;
  const data = state.data;
  const defaults = DEFAULT_PERMISSIONS[data.role] ?? {};
  const initial = Object.fromEntries(PERMISSION_KEYS.map((key) => {
    const override = overrides?.[key];
    return [key, override !== undefined ? String(override) : Boolean(data.permissions[key]) !== Boolean(defaults[key]) && !data.is_staff_bypass ? String(Boolean(data.permissions[key])) : 'inherit'];
  }));
  return <Panel title={member.user_name ?? member.id}>
    <p>{t('common:roles.' + data.role)}</p><p>{t('permissionHint')}</p>
    {data.is_staff_bypass && <p role="status">{t('bypass')}</p>}
    <RecordForm initial={initial} fields={PERMISSION_KEYS.map((key) => ({
      name: key,
      label: `${t('permissionNames.' + key)} · ${t('default')}: ${t(defaults[key] ? 'yes' : 'no')} · ${t('effective')}: ${t(data.permissions[key] ? 'yes' : 'no')}`,
      type: 'select', disabled: data.is_staff_bypass,
      options: [{ value: 'inherit', label: t('inherited') }, { value: 'true', label: t('allow') }, { value: 'false', label: t('deny') }],
    }))} onSave={async (values) => {
      const permissions = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== 'inherit').map(([key, value]) => [key, value === 'true']));
      const result = await updatePermissions(member.id, permissions);
      // Keep the exact overrides separate from the effective response.
      setOverrides(permissions);
      state.setData(result);
    }} />
  </Panel>;
}
