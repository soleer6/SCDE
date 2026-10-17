import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Checkbox, DataTable, EmptyState, ErrorState, Field, Input, Loader, Select, Textarea } from '../../ui';
import './admin.css';

export function Records({ state, columns, onRowClick, action, emptyTitle, emptyBody }) {
  const { t } = useTranslation('admin');
  if (state.loading) return <Loader />;
  if (state.error) return <ErrorState error={state.error} onRetry={state.reload} />;
  const rows = Array.isArray(state.data) ? state.data : state.data?.results ?? [];
  return <DataTable rows={rows} columns={columns} onRowClick={onRowClick} empty={<EmptyState title={emptyTitle ?? t('empty')} body={emptyBody ?? t('emptyHint')} action={action} />} />;
}

export function Pagination({ data, page, onChange }) {
  const { t } = useTranslation('admin');
  return <nav className="admin-actions" aria-label={t('pagination')}>
    <Button disabled={page <= 1} onClick={() => onChange(page - 1)}>{t('previous')}</Button>
    <span aria-live="polite">{t('page', { page, total: data?.total_pages ?? 1, count: data?.count ?? 0 })}</span>
    <Button disabled={!data || page >= data.total_pages} onClick={() => onChange(page + 1)}>{t('next')}</Button>
  </nav>;
}

// Remount with a record key when switching records. Values remain intact after validation errors.
export function RecordForm({ initial, fields, onSave, submitLabel, children }) {
  const { t } = useTranslation('admin');
  const [values, setValues] = useState(initial);
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setPending(true); setError(null); setSaved(false);
    try { await onSave(values); setSaved(true); }
    catch (err) { setError(err); }
    finally { setPending(false); }
  }
  return <form className="admin-form" onSubmit={submit}>
    {fields.map(({ name, label, type = 'text', options, ...props }) => {
      const code = error?.fieldCode?.(name);
      const message = code ? t(`common:errors.${code}`, { defaultValue: t('invalid') }) : undefined;
      const update = (value) => { setValues({ ...values, [name]: value }); setSaved(false); };
      return <Field key={name} label={type === 'checkbox' ? undefined : label} error={message}>{(id) => type === 'checkbox'
        ? <Checkbox label={label} checked={Boolean(values[name])} onChange={(e) => update(e.target.checked)} disabled={pending} />
        : type === 'select'
          ? <Select id={id} options={options} value={values[name] ?? ''} onChange={(e) => update(e.target.value)} {...props} disabled={pending || props.disabled} />
          : type === 'json'
            ? <Textarea id={id} value={values[name] ?? ''} onChange={(e) => update(e.target.value)} {...props} disabled={pending || props.disabled} />
            : <Input id={id} type={type} value={values[name] ?? ''} onChange={(e) => update(type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)} {...props} disabled={pending || props.disabled} />
      }</Field>;
    })}
    {children}
    {error && <ErrorState error={error} />}
    {saved && <p role="status">{t('saved')}</p>}
    <Button type="submit" variant="solid" loading={pending}>{submitLabel ?? t('common:save')}</Button>
  </form>;
}
