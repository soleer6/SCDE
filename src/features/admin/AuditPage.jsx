import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, Field, Input, PageHeader } from '../../ui';
import { useApi } from '../../lib/hooks.js';
import { getAudit } from './api.js';
import { Pagination, Records } from './components.jsx';

export default function AuditPage() {
  const { t } = useTranslation('admin');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const state = useApi(() => getAudit({ page }), [page]);
  const filtered = state.data && { ...state.data, results: state.data.results.filter((row) => JSON.stringify(row).toLowerCase().includes(search.toLowerCase())) };
  return <>
    <PageHeader eyebrow={t('management')} title={t('audit')} />
    <div className="admin-search"><Field label={t('localFilter')}>{(id) => <Input id={id} value={search} onChange={(e) => setSearch(e.target.value)} />}</Field></div>
    <Records state={{ ...state, data: filtered }} onRowClick={setSelected} columns={['timestamp', 'event_type', 'actor_email', 'entity_type', 'entity_id'].map((key) => ({ key, header: t(key) }))} />
    <Pagination data={state.data} page={page} onChange={setPage} />
    <Dialog open={Boolean(selected)} title={t('details')} onClose={() => setSelected(null)}><pre className="admin-code">{JSON.stringify(selected?.payload, null, 2)}</pre></Dialog>
  </>;
}
