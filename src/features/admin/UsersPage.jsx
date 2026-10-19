import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Dialog, ErrorState, Field, Input, PageHeader, Select } from '../../ui';
import { useApi } from '../../lib/hooks.js';
import { createUser, exportUsers, getUsers, importUsers, resetPassword, updateUser } from './api.js';
import { Pagination, RecordForm, Records } from './components.jsx';
import ImportForm from './ImportForm.jsx';
import { downloadBlob } from './download.js';

export default function UsersPage() {
  const { t } = useTranslation('admin');
  const searchHintId = useId();
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
  const actingRef = useRef(false);
  const savingRef = useRef(false);
  const importPendingRef = useRef(false);
  const confirmationErrorRef = useRef(null);
  useEffect(() => {
    if (confirm && error && !pending) confirmationErrorRef.current?.focus();
  }, [confirm, error, pending]);
  const users = useApi(() => getUsers({ page, page_size: pageSize }), [page, pageSize]);
  const searchRef = useRef(null);
  const resultsRef = useRef(null);
  const focusAfterAction = useRef(null);
  const recovering = useRef(false);
  useEffect(() => {
    if (users.loading) return;
    if (users.error) {
      recovering.current = true;
    } else if (recovering.current && users.data) {
      recovering.current = false;
      searchRef.current?.focus();
    }
  }, [users.loading, users.error, users.data]);
  useEffect(() => {
    const target = focusAfterAction.current;
    if (!target || editing || confirm || users.loading || users.error) return;
    // A reload first renders the old data; wait for its replacement before focusing.
    if (target.reload && target.data === users.data) return;
    focusAfterAction.current = null;
    resultsRef.current?.focus();
  }, [editing, confirm, users.loading, users.error, users.data, notice]);
  const filtered = users.data && { ...users.data, results: users.data.results.filter((u) => `${u.email} ${u.first_name} ${u.last_name} ${u.nia}`.toLowerCase().includes(query.toLowerCase())) };
  async function act(fn) {
    if (actingRef.current) return;
    actingRef.current = true;
    setPending(true); setError(null); setNotice('');
    try { await fn(); } catch (err) { setError(err); } finally { actingRef.current = false; setPending(false); }
  }
  const create = () => setEditing({ first_name: '', last_name: '', email: '', nia: '', dni: '', is_staff: false });
  const fields = ['email', 'first_name', 'last_name', 'nia', ...(!editing?.id ? ['dni'] : []), 'is_staff'].map((name) => ({ name, label: t(name), type: name === 'email' ? 'email' : name === 'is_staff' ? 'checkbox' : 'text', required: ['email', 'first_name', 'last_name'].includes(name) }));
  return <>
    <PageHeader eyebrow={t('management')} title={t('users')} actions={<><Button variant="primary" onClick={create}>{t('create')}</Button><Button onClick={() => setImporting(true)}>{t('importUsers')}</Button></>} />
    <form className="admin-actions" onSubmit={(e) => { e.preventDefault(); setQuery(search); }}>
      <Field label={t('search')} hint={<span id={searchHintId}>{t('searchHint')}</span>}>{(id) => <Input ref={searchRef} id={id} aria-describedby={searchHintId} value={search} onChange={(e) => setSearch(e.target.value)} />}</Field>
      <Button type="submit">{t('common:search')}</Button>
      <Field label={t('pageSize')}>{(id) => <Select id={id} value={pageSize} onChange={(e) => { setPageSize(e.target.value); setPage(1); }} options={['25', '50', '100'].map((value) => ({ value, label: value }))} />}</Field>
      <Button disabled={pending} onClick={() => act(async () => {
        const blob = await exportUsers(); downloadBlob(blob, blob.type.includes('json') ? 'users.json' : 'users.csv');
      })}>{t('export')}</Button>
    </form>
    {error && !confirm && <ErrorState error={error} />}{notice && <p role="status">{notice}</p>}
    <section ref={resultsRef} tabIndex={-1} aria-label={t('users')}>
    <Records focusError state={{ ...users, data: filtered }} action={<Button onClick={create}>{t('create')}</Button>} columns={[
      { key: 'email', header: t('email') }, { key: 'id', header: t('id'), render: (u) => <code className="admin-identifier">{u.id}</code> }, { key: 'first_name', header: t('first_name'), render: (u) => `${u.first_name} ${u.last_name}` }, { key: 'nia', header: t('nia'), render: (u) => <code className="admin-identifier">{u.nia}</code> },
      { key: 'is_active', header: t('status'), render: (u) => <Badge tone={u.is_active ? 'accent' : undefined}>{t(u.is_active ? 'active' : 'inactive')}</Badge> },
      { key: 'actions', header: t('actions'), render: (u) => <div className="admin-actions"><Button size="sm" onClick={() => setEditing(u)}>{t('edit')}</Button><Button size="sm" variant="danger" onClick={() => { setError(null); setConfirm({ user: u, type: 'toggle' }); }}>{t('toggle')}</Button><Button size="sm" variant="danger" onClick={() => { setError(null); setConfirm({ user: u, type: 'reset' }); }}>{t('reset')}</Button></div> },
    ]} />
    </section>
    <Pagination data={users.data} page={page} onChange={setPage} />
    <Dialog open={importing} title={t('importUsers')} onClose={() => !importPendingRef.current && setImporting(false)}>
      {importing && <ImportForm hint={t('userImportHint')} onImport={importUsers} onComplete={users.reload} onPendingChange={(value) => { importPendingRef.current = value; }} />}
    </Dialog>
    <Dialog open={Boolean(editing)} title={t(editing?.id ? 'edit' : 'create')} onClose={() => !savingRef.current && setEditing(null)}>
      {editing && <RecordForm key={editing.id ?? 'new'} initial={editing} fields={fields} onSave={async (values) => {
        savingRef.current = true;
        try {
          const body = Object.fromEntries(fields.map(({ name }) => [name, values[name]]));
          if (editing.id) await updateUser(editing.id, body); else await createUser(body);
          focusAfterAction.current = { reload: true, data: users.data };
          setEditing(null); users.reload(); setNotice(t('saved'));
        } finally { savingRef.current = false; }
      }} />}
    </Dialog>
    <Dialog open={Boolean(confirm)} title={t(confirm?.type === 'reset' ? 'reset' : 'toggle')} onClose={() => !actingRef.current && setConfirm(null)} footer={<Button variant="danger" loading={pending} onClick={() => act(async () => {
      if (confirm.type === 'reset') { await resetPassword(confirm.user.id); focusAfterAction.current = { reload: false }; setNotice(t('resetDone')); }
      else { await updateUser(confirm.user.id, { is_active: !confirm.user.is_active }); focusAfterAction.current = { reload: true, data: users.data }; users.reload(); setNotice(t('saved')); }
      setConfirm(null);
    })}>{t('common:confirm')}</Button>}>
      <p>{t(confirm?.type === 'reset' ? 'resetConfirm' : 'toggleConfirm')}</p><p>{confirm?.user.email}</p>{error && <div ref={confirmationErrorRef} tabIndex={-1}><ErrorState error={error} /></div>}
    </Dialog>
  </>;
}
