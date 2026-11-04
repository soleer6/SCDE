import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Dialog, ErrorState, Field, Input, PageHeader, Select } from '../../ui';
import { useApi } from '../../lib/hooks.js';
import { createUser, exportUsers, getUsers, importUsers, resetPassword, updateUser } from './api.js';
import { Pagination, RecordForm, Records } from './components.jsx';
import ImportForm from './ImportForm.jsx';
import { downloadBlob } from './download.js';
import { userFilters, USER_FILTER_KEYS } from './user-filters.js';
import UserFilterError from './UserFilterError.jsx';

export default function UsersPage() {
  const { t } = useTranslation('admin');
  const searchHintId = useId();
  const [params, setParams] = useSearchParams();
  const queryKey = JSON.stringify(userFilters(Object.fromEntries(params)));
  const query = useMemo(() => JSON.parse(queryKey), [queryKey]);
  const requestedPage = Number(params.get('page'));
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const pageSize = ['25', '50', '100'].includes(params.get('page_size')) ? params.get('page_size') : '25';
  const [search, setSearch] = useState(query.search || '');
  const [draftFilters, setDraftFilters] = useState(query);
  const format = params.get('export_format') === 'csv' ? 'csv' : 'json';
  useEffect(() => { setSearch(query.search || ''); setDraftFilters(query); }, [query]);
  function updateLocation(values) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(values)) {
      if (value === '') next.delete(key); else next.set(key, String(value));
    }
    setParams(next);
  }
  const [editing, setEditing] = useState(null);
  const [importing, setImporting] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState('');
  const actingRef = useRef(false);
  const savingRef = useRef(false);
  const importPendingRef = useRef(false);
  const closeImport = useCallback(() => { if (!importPendingRef.current) setImporting(false); }, []);
  const confirmationErrorRef = useRef(null);
  useEffect(() => {
    if (confirm && error && !pending) confirmationErrorRef.current?.focus();
  }, [confirm, error, pending]);
  const users = useApi(() => getUsers({ ...query, page, page_size: pageSize }), [queryKey, page, pageSize]);
  const filterErrorRef = useRef(null);
  const actionErrorRef = useRef(null);
  useEffect(() => { if (error && !confirm && !pending) actionErrorRef.current?.focus(); }, [error, confirm, pending]);
  const searchRef = useRef(null);
  const resultsRef = useRef(null);
  const focusAfterAction = useRef(null);
  const focusAfterQuery = useRef(null);
  const recovering = useRef(false);
  useEffect(() => {
    if (users.loading) return;
    if (users.error) {
      focusAfterQuery.current = null;
      recovering.current = true;
      filterErrorRef.current?.focus();
    } else if (recovering.current && users.data) {
      recovering.current = false;
      searchRef.current?.focus();
    }
  }, [users.loading, users.error, users.data]);
  useEffect(() => {
    const target = focusAfterQuery.current;
    if (users.error) { focusAfterQuery.current = null; return; }
    if (!target || users.loading || users.error) return;
    if (target.reload && target.data === users.data) return;
    focusAfterQuery.current = null;
    resultsRef.current?.focus();
  }, [query, users.loading, users.error, users.data]);
  useEffect(() => {
    const target = focusAfterAction.current;
    if (!target || editing || confirm || users.loading || users.error) return;
    // A reload first renders the old data; wait for its replacement before focusing.
    if (target.reload && target.data === users.data) return;
    focusAfterAction.current = null;
    resultsRef.current?.focus();
  }, [editing, confirm, users.loading, users.error, users.data, notice]);
  async function act(fn) {
    if (actingRef.current) return;
    actingRef.current = true;
    setPending(true); setError(null); setNotice('');
    try { await fn(); } catch (err) { setError(err); } finally { actingRef.current = false; setPending(false); }
  }
  const create = () => setEditing({ first_name: '', last_name: '', email: '', nia: '', dni: '', is_staff: false });
  const fields = ['email', 'first_name', 'last_name', 'nia', 'dni', 'is_staff'].map((name) => ({ name, label: t(name === 'dni' && editing?.id ? 'newDni' : name), type: name === 'email' ? 'email' : name === 'is_staff' ? 'checkbox' : 'text', required: ['email', 'first_name', 'last_name'].includes(name), ...(name === 'dni' ? { maxLength: 20 } : {}) }));
  return <>
    <PageHeader eyebrow={t('management')} title={t('users')} actions={<><Button variant="primary" onClick={create}>{t('create')}</Button><Button onClick={() => setImporting(true)}>{t('importUsers')}</Button></>} />
    <form className="admin-filters" onSubmit={(e) => {
      e.preventDefault();
      const next = userFilters({ ...draftFilters, search });
      focusAfterQuery.current = { reload: true, data: users.data };
      if (page === 1 && JSON.stringify(next) === queryKey) users.reload();
      else updateLocation({ ...Object.fromEntries(USER_FILTER_KEYS.map(key => [key, ''])), ...next, page: 1 });
    }}>
      <Field label={t('search')} hint={<span id={searchHintId}>{t('searchHint')}</span>}>{(id) => <Input ref={searchRef} id={id} aria-describedby={searchHintId} value={search} onChange={(e) => setSearch(e.target.value)} />}</Field>
      <Button type="submit">{t('common:search')}</Button>
      {['email', 'nia'].map(key => <Field key={key} label={t(`userFilterLabels.${key}`)}>{id => <Input id={id} value={draftFilters[key] || ''} onChange={event => setDraftFilters({ ...draftFilters, [key]: event.target.value })} />}</Field>)}
      {['is_active', 'is_staff'].map(key => <Field key={key} label={t(`userFilterLabels.${key}`)}>{id => <Select id={id} value={draftFilters[key] || ''} onChange={event => setDraftFilters({ ...draftFilters, [key]: event.target.value })} options={[
        { value: '', label: t(key === 'is_active' ? 'allAccounts' : 'allUsers') },
        { value: 'true', label: t(key === 'is_active' ? 'active' : 'managers') },
        { value: 'false', label: t(key === 'is_active' ? 'inactive' : 'nonManagers') },
      ]} />}</Field>)}
      <Button onClick={() => { focusAfterQuery.current = { reload: true, data: users.data }; updateLocation({ ...Object.fromEntries(USER_FILTER_KEYS.map(key => [key, ''])), page: 1 }); users.reload(); }}>{t('clearFilters')}</Button>
      <Field label={t('pageSize')}>{(id) => <Select id={id} value={pageSize} onChange={(e) => { focusAfterQuery.current = { reload: true, data: users.data }; updateLocation({ page_size: e.target.value, page: 1 }); }} options={['25', '50', '100'].map((value) => ({ value, label: value }))} />}</Field>
      <Field label={t('exportFormat')}>{id => <Select id={id} value={format} onChange={event => updateLocation({ export_format: event.target.value })} options={['json', 'csv'].map(value => ({ value, label: value.toUpperCase() }))} />}</Field>
      <Button disabled={pending || users.loading || Boolean(users.error)} onClick={() => act(async () => {
        const blob = await exportUsers(query, format); downloadBlob(blob, `users.${format}`);
      })}>{t('export')}</Button>
    </form>
    <p className="u-muted">{t('exportFilteredHint')}</p>
    {error && !confirm && <div ref={actionErrorRef} tabIndex={-1}><UserFilterError error={error} /></div>}{notice && <p role="status">{notice}</p>}
    <section ref={resultsRef} tabIndex={-1} aria-label={t('users')}>
    {users.error?.code === 'INVALID_FILTER' ? <div ref={filterErrorRef} tabIndex={-1}><UserFilterError error={users.error} onRetry={users.reload} /></div> : <Records focusError state={users} action={<Button onClick={create}>{t('create')}</Button>} columns={[
      { key: 'email', header: t('email') }, { key: 'id', header: t('id'), render: (u) => <code className="admin-identifier">{u.id}</code> }, { key: 'first_name', header: t('first_name'), render: (u) => `${u.first_name} ${u.last_name}` }, { key: 'nia', header: t('nia'), render: (u) => <code className="admin-identifier">{u.nia}</code> },
      { key: 'is_active', header: t('status'), render: (u) => <Badge tone={u.is_active ? 'accent' : undefined}>{t(u.is_active ? 'active' : 'inactive')}</Badge> },
      { key: 'actions', header: t('actions'), render: (u) => <div className="admin-actions"><Button size="sm" onClick={() => setEditing({ ...u, dni: '' })}>{t('edit')}</Button><Button size="sm" variant="danger" onClick={() => { setError(null); setConfirm({ user: u, type: 'toggle' }); }}>{t('toggle')}</Button><Button size="sm" variant="danger" onClick={() => { setError(null); setConfirm({ user: u, type: 'reset' }); }}>{t('reset')}</Button></div> },
    ]} />}
    </section>
    <Pagination data={users.loading ? undefined : users.data} page={page} onChange={(value) => { focusAfterQuery.current = { reload: true, data: users.data }; updateLocation({ page: value }); }} />
    <Dialog open={importing} title={t('importUsers')} onClose={closeImport}>
      {importing && <ImportForm hint={t('userImportHint')} onImport={importUsers} onComplete={users.reload} onPendingChange={(value) => { importPendingRef.current = value; }} />}
    </Dialog>
    <Dialog open={Boolean(editing)} title={t(editing?.id ? 'edit' : 'create')} onClose={() => !savingRef.current && setEditing(null)}>
      {editing && <RecordForm key={editing.id ?? 'new'} initial={editing} fields={fields} onSave={async (values) => {
        savingRef.current = true;
        try {
          const body = Object.fromEntries(fields.map(({ name }) => [name, values[name]]));
          if (editing.id && !body.dni?.trim()) delete body.dni;
          if (editing.id) await updateUser(editing.id, body); else await createUser(body);
          focusAfterAction.current = { reload: true, data: users.data };
          setEditing(null); updateLocation({ page: 1 }); users.reload(); setNotice(t('saved'));
        } finally { savingRef.current = false; }
      }}>{editing.id && <p className="u-muted">{t('newDniHint')}</p>}</RecordForm>}
    </Dialog>
    <Dialog open={Boolean(confirm)} title={t(confirm?.type === 'reset' ? 'reset' : 'toggle')} onClose={() => !actingRef.current && setConfirm(null)} footer={<Button variant="danger" loading={pending} onClick={() => act(async () => {
      if (confirm.type === 'reset') { await resetPassword(confirm.user.id); focusAfterAction.current = { reload: false }; setNotice(t('resetDone')); }
      else { await updateUser(confirm.user.id, { is_active: !confirm.user.is_active }); focusAfterAction.current = { reload: true, data: users.data }; updateLocation({ page: 1 }); users.reload(); setNotice(t('saved')); }
      setConfirm(null);
    })}>{t('common:confirm')}</Button>}>
      <p>{t(confirm?.type === 'reset' ? 'resetConfirm' : 'toggleConfirm')}</p><p>{confirm?.user.email}</p>{error && <div ref={confirmationErrorRef} tabIndex={-1}><ErrorState error={error} /></div>}
    </Dialog>
  </>;
}
