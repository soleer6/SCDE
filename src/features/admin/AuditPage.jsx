import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Dialog, Field, Input, PageHeader, Select } from '../../ui';
import { useApi } from '../../lib/hooks.js';
import { getAudit } from './api.js';
import { Pagination, Records } from './components.jsx';

const filterKeys = ['event_type', 'actor_id', 'entity_type', 'entity_id', 'ip_address', 'timestamp_from', 'timestamp_to'];
export default function AuditPage() {
  const { t } = useTranslation('admin');
  const dateHintId = useId();
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState({ page_size: '25' });
  const [query, setQuery] = useState({ page_size: '25' });
  const [selected, setSelected] = useState(null);
  const state = useApi(() => getAudit({ page, ...query }), [page, query]);
  const eventRef = useRef(null);
  const resultsRef = useRef(null);
  const focusAfterQuery = useRef(null);
  const recovering = useRef(false);
  useEffect(() => {
    if (state.loading) return;
    if (state.error) {
      focusAfterQuery.current = null;
      recovering.current = true;
    } else if (state.data && recovering.current) {
      recovering.current = false;
      eventRef.current?.focus();
    }
  }, [state.loading, state.error, state.data]);
  useEffect(() => {
    const target = focusAfterQuery.current;
    if (!target || state.loading || state.error || target.data === state.data) return;
    focusAfterQuery.current = null;
    resultsRef.current?.focus();
  }, [state.loading, state.error, state.data]);
  return <>
    <PageHeader eyebrow={t('management')} title={t('audit')} />
    <form className="admin-filters" onSubmit={(e) => {
      e.preventDefault();
      focusAfterQuery.current = { data: state.data };
      setQuery(Object.fromEntries(Object.entries(draft).map(([key, value]) => [key, key.startsWith('timestamp_') && value ? new Date(value).toISOString() : value])));
      setPage(1);
    }}>
      <p id={dateHintId}>{t('auditDateHint')}</p>
      {filterKeys.map((name) => <Field key={name} label={t(name)}>{(id) => <Input ref={name === 'event_type' ? eventRef : undefined} id={id} type={name.startsWith('timestamp_') ? 'datetime-local' : 'text'} aria-describedby={name.startsWith('timestamp_') ? dateHintId : undefined} min={name === 'timestamp_to' ? draft.timestamp_from || undefined : undefined} max={name === 'timestamp_from' ? draft.timestamp_to || undefined : undefined} value={draft[name] ?? ''} onChange={(e) => setDraft({ ...draft, [name]: e.target.value })} />}</Field>)}
      <Field label={t('pageSize')}>{(id) => <Select id={id} value={draft.page_size} onChange={(e) => setDraft({ ...draft, page_size: e.target.value })} options={['25', '50', '100'].map((value) => ({ value, label: value }))} />}</Field>
      <div className="admin-actions"><Button type="submit" variant="primary">{t('applyFilters')}</Button><Button onClick={() => { focusAfterQuery.current = { data: state.data }; setDraft({ page_size: '25' }); setQuery({ page_size: '25' }); setPage(1); }}>{t('clearFilters')}</Button></div>
    </form>
    <section ref={resultsRef} tabIndex={-1} aria-label={t('audit')}>
      <Records focusError state={state} onRowClick={setSelected} columns={['timestamp', 'event_type', 'actor_email', 'entity_type', 'entity_id'].map((key) => ({ key, header: t(key) }))} />
    </section>
    <Pagination data={state.data} page={page} onChange={(value) => { focusAfterQuery.current = { data: state.data }; setPage(value); }} />
    <Dialog open={Boolean(selected)} title={t('details')} onClose={() => setSelected(null)}><pre className="admin-code">{JSON.stringify(selected?.payload, null, 2)}</pre></Dialog>
  </>;
}
