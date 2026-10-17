import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Dialog, ErrorState, Field, Input, PageHeader, Select } from '../../ui';
import { useApi } from '../../lib/hooks.js';
import { createUser, exportUsers, getUsers, importUsers, resetPassword, updateUser } from './api.js';
import { Pagination, RecordForm, Records } from './components.jsx';
import ImportForm from './ImportForm.jsx';
import { downloadBlob } from './download.js';

export default function UsersPage() {
  const { t } = useTranslation('admin');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [pageSize, setPageSize] = useState('25');
  const [editing, setEditing] = useState(null);
  const [importing, setImporting] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState('');
  const users = useApi(() => getUsers({ page, page_size: pageSize }), [page, pageSize]);
  const filtered = users.data && { ...users.data, results: users.data.results.filter((u) => `${u.email} ${u.first_name} ${u.last_name} ${u.nia}`.toLowerCase().includes(query.toLowerCase())) };
  async function act(fn) {
    setPending(true); setError(null); setNotice('');
    try { await fn(); } catch (err) { setError(err); } finally { setPending(false); }
  }
  const create = () => setEditing({ first_name: '', last_name: '', email: '', nia: '', dni: '', is_staff: false });
  const fields = ['email', 'first_name', 'last_name', 'nia', ...(!editing?.id ? ['dni'] : []), 'is_staff'].map((name) => ({ name, label: t(name), type: name === 'email' ? 'email' : name === 'is_staff' ? 'checkbox' : 'text', required: ['email', 'first_name', 'last_name'].includes(name) }));
  return <>
    <PageHeader eyebrow={t('management')} title={t('users')} actions={<><Button variant="primary" onClick={create}>{t('create')}</Button><Button onClick={() => setImporting(true)}>{t('importUsers')}</Button></>} />
    <form className="admin-actions" onSubmit={(e) => { e.preventDefault(); setQuery(search); }}>
      <Field label={t('search')} hint={t('searchHint')}>{(id) => <Input id={id} value={search} onChange={(e) => setSearch(e.target.value)} />}</Field>
      <Button type="submit">{t('common:search')}</Button>
      <Field label={t('pageSize')}>{(id) => <Select id={id} value={pageSize} onChange={(e) => { setPageSize(e.target.value); setPage(1); }} options={['25', '50', '100'].map((value) => ({ value, label: value }))} />}</Field>
      <Button disabled={pending} onClick={() => act(async () => {
        const blob = await exportUsers(); downloadBlob(blob, blob.type.includes('json') ? 'users.json' : 'users.csv');
      })}>{t('export')}</Button>
    </form>
    {error && <ErrorState error={error} />}{notice && <p role="status">{notice}</p>}
    <Records state={{ ...users, data: filtered }} action={<Button onClick={create}>{t('create')}</Button>} columns={[
      { key: 'email', header: t('email') }, { key: 'id', header: t('id'), render: (u) => <code className="admin-identifier">{u.id}</code> }, { key: 'first_name', header: t('first_name'), render: (u) => `${u.first_name} ${u.last_name}` }, { key: 'nia', header: t('nia'), render: (u) => <code className="admin-identifier">{u.nia}</code> },
      { key: 'is_active', header: t('status'), render: (u) => <Badge tone={u.is_active ? 'accent' : undefined}>{t(u.is_active ? 'active' : 'inactive')}</Badge> },
      { key: 'actions', header: t('actions'), render: (u) => <div className="admin-actions"><Button size="sm" onClick={() => setEditing(u)}>{t('edit')}</Button><Button size="sm" variant="danger" onClick={() => { setError(null); setConfirm({ user: u, type: 'toggle' }); }}>{t('toggle')}</Button><Button size="sm" variant="danger" onClick={() => { setError(null); setConfirm({ user: u, type: 'reset' }); }}>{t('reset')}</Button></div> },
    ]} />
    <Pagination data={users.data} page={page} onChange={setPage} />
    <Dialog open={importing} title={t('importUsers')} onClose={() => setImporting(false)}>
      {importing && <ImportForm hint={t('userImportHint')} onImport={importUsers} onComplete={users.reload} />}
    </Dialog>
    <Dialog open={Boolean(editing)} title={t(editing?.id ? 'edit' : 'create')} onClose={() => setEditing(null)}>
      {editing && <RecordForm key={editing.id ?? 'new'} initial={editing} fields={fields} onSave={async (values) => {
        const body = Object.fromEntries(fields.map(({ name }) => [name, values[name]]));
        if (editing.id) await updateUser(editing.id, body); else await createUser(body);
        setEditing(null); users.reload(); setNotice(t('saved'));
      }} />}
    </Dialog>
    <Dialog open={Boolean(confirm)} title={t(confirm?.type === 'reset' ? 'reset' : 'toggle')} onClose={() => !pending && setConfirm(null)} footer={<Button variant="danger" loading={pending} onClick={() => act(async () => {
      if (confirm.type === 'reset') { await resetPassword(confirm.user.id); setNotice(t('resetDone')); }
      else { await updateUser(confirm.user.id, { is_active: !confirm.user.is_active }); users.reload(); setNotice(t('saved')); }
      setConfirm(null);
    })}>{t('common:confirm')}</Button>}>
      <p>{t(confirm?.type === 'reset' ? 'resetConfirm' : 'toggleConfirm')}</p><p>{confirm?.user.email}</p>{error && <ErrorState error={error} />}
    </Dialog>
  </>;
}
