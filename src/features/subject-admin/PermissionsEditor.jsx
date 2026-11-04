import { useEffect, useRef, useState } from 'react';
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
  const editorRef = useRef(null);
  const errorRef = useRef(null);
  const focused = useRef(false);
  useEffect(() => {
    // Failed lookups replace the loader too. Resume keyboard navigation at the
    // error, immediately before its retry action.
    if (state.error && !state.loading) errorRef.current?.focus();
  }, [state.error, state.loading]);
  useEffect(() => {
    // The member action disappears when opening this tab. Resume keyboard navigation
    // in the loaded editor once, without moving focus again after saving.
    if (state.data && !state.loading && !state.error && !focused.current) {
      const target = editorRef.current?.querySelector('select:not(:disabled), [data-permission-summary]');
      if (target) { target.focus(); focused.current = true; }
    }
  }, [state.data, state.loading, state.error]);
  if (state.loading) return <Loader />;
  if (state.error) return <div ref={errorRef} tabIndex={-1}><ErrorState error={state.error} onRetry={state.reload} /></div>;
  if (!state.data) return null;
  const data = state.data;
  const defaults = DEFAULT_PERMISSIONS[data.role] ?? {};
  const initial = Object.fromEntries(PERMISSION_KEYS.map((key) => {
    const override = overrides?.[key];
    return [key, override !== undefined ? String(override) : Boolean(data.permissions[key]) !== Boolean(defaults[key]) && !data.is_staff_bypass ? String(Boolean(data.permissions[key])) : 'inherit'];
  }));
  return <div ref={editorRef}><Panel title={member.user_name ?? member.id}>
    <p>{t('common:roles.' + data.role)}</p><p>{t('permissionHint')}</p>
    {data.is_staff_bypass && <p role="status" tabIndex={-1} data-permission-summary>{t('bypass')}</p>}
    {data.role === 'STUDENT' && <p role="status" tabIndex={-1} data-permission-summary>{t('studentFixed')}</p>}
    <RecordForm focusOnSaved disabled={data.is_staff_bypass || data.role === 'STUDENT'} initial={initial} fields={PERMISSION_KEYS.map((key) => ({
      name: key,
      label: `${t('permissionNames.' + key)} · ${t('default')}: ${t(defaults[key] ? 'yes' : 'no')} · ${t('effective')}: ${t(data.permissions[key] ? 'yes' : 'no')}`,
      type: 'select', disabled: data.is_staff_bypass || data.role === 'STUDENT',
      options: [{ value: 'inherit', label: t('inherited') }, { value: 'true', label: t('allow') }, { value: 'false', label: t('deny') }],
    }))} onSave={async (values) => {
      // Django merges PATCH values. Omission preserves an override; null removes it.
      // A direct lookup has no raw overrides, so reset every inherited key there.
      const permissions = Object.fromEntries(Object.entries(values)
        .filter(([key, value]) => value !== 'inherit' || overrides === undefined || Object.hasOwn(overrides, key))
        .map(([key, value]) => [key, value === 'inherit' ? null : value === 'true']));
      const result = await updatePermissions(member.id, permissions);
      // Keep the exact overrides separate from the effective response.
      setOverrides(Object.fromEntries(Object.entries(permissions).filter(([, value]) => value !== null)));
      state.setData(result);
    }} />
  </Panel></div>;
}
