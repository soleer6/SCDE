import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Dialog, Field, Input, PageHeader, Select } from '../../ui';
import { useApi } from '../../lib/hooks.js';
import { getAudit } from './api.js';
import { Pagination, Records } from './components.jsx';

const filterKeys = ['event_type', 'actor_id', 'entity_type', 'entity_id', 'ip_address', 'timestamp_from', 'timestamp_to'];
export default function AuditPage() {
  const { t } = useTranslation('admin');
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState({ page_size: '25' });
  const [query, setQuery] = useState({ page_size: '25' });
  const [selected, setSelected] = useState(null);
  const state = useApi(() => getAudit({ page, ...query }), [page, query]);
  return <>
    <PageHeader eyebrow={t('management')} title={t('audit')} />
    <form className="admin-filters" onSubmit={(e) => {
      e.preventDefault();
      setQuery(Object.fromEntries(Object.entries(draft).map(([key, value]) => [key, key.startsWith('timestamp_') && value ? new Date(value).toISOString() : value])));
      setPage(1);
    }}>
      {filterKeys.map((name) => <Field key={name} label={t(name)}>{(id) => <Input id={id} type={name.startsWith('timestamp_') ? 'datetime-local' : 'text'} value={draft[name] ?? ''} onChange={(e) => setDraft({ ...draft, [name]: e.target.value })} />}</Field>)}
      <Field label={t('pageSize')}>{(id) => <Select id={id} value={draft.page_size} onChange={(e) => setDraft({ ...draft, page_size: e.target.value })} options={['25', '50', '100'].map((value) => ({ value, label: value }))} />}</Field>
      <div className="admin-actions"><Button type="submit" variant="primary">{t('applyFilters')}</Button><Button onClick={() => { setDraft({ page_size: '25' }); setQuery({ page_size: '25' }); setPage(1); }}>{t('clearFilters')}</Button></div>
    </form>
    <Records state={state} onRowClick={setSelected} columns={['timestamp', 'event_type', 'actor_email', 'entity_type', 'entity_id'].map((key) => ({ key, header: t(key) }))} />
    <Pagination data={state.data} page={page} onChange={setPage} />
    <Dialog open={Boolean(selected)} title={t('details')} onClose={() => setSelected(null)}><pre className="admin-code">{JSON.stringify(selected?.payload, null, 2)}</pre></Dialog>
  </>;
}
