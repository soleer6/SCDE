import { useEffect, useId, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Dialog, ErrorState, Field, Input, PageHeader, Tabs } from '../../ui';
import { useApi } from '../../lib/hooks.js';
import { Pagination, RecordForm, Records } from '../admin/components.jsx';
import PermissionsEditor from './PermissionsEditor.jsx';
import { assignMember, createGroup, deleteGroup, getGroups, getMembers, removeMember, updateGroup } from './api.js';

function Members({ subjectId, onPermissions }) {
  const { t } = useTranslation('subject-admin');
  const [page, setPage] = useState(1);
  const state = useApi(() => getMembers(subjectId, page), [subjectId, page]);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const removalErrorRef = useRef(null);
  const removalTriggerRef = useRef(null);
  useEffect(() => {
    if (!removing) removalTriggerRef.current?.focus();
  }, [removing]);
  useEffect(() => {
    if (removing && error && !pending) removalErrorRef.current?.focus();
  }, [removing, error, pending]);
  const action = <Button variant="primary" onClick={() => setAdding(true)} disabled={state.loading || Boolean(state.error)}>{t('assign')}</Button>;
  return <>
    <div className="admin-actions">{action}</div>
    <Records state={state} focusError action={action} columns={[
      { key: 'user_name', header: t('name') }, { key: 'user_email', header: t('email') }, { key: 'id', header: t('membership') }, { key: 'role', header: t('role'), render: (m) => t('common:roles.' + m.role) }, { key: 'group_label', header: t('group') },
      { key: 'actions', header: t('actions'), render: (m) => <div className="admin-actions"><Button size="sm" onClick={() => onPermissions(m)}>{t('inspect')}</Button><Button size="sm" variant="danger" onClick={(event) => { removalTriggerRef.current = event.currentTarget; setError(null); setRemoving(m); }}>{t('remove')}</Button></div> },
    ]} />
    <Pagination data={state.data} page={page} onChange={setPage} />
    <Dialog open={adding} title={t('assign')} onClose={() => setAdding(false)}>
      {adding && <RecordForm initial={{ user_id: '', role: 'STUDENT', group_id: '' }} fields={[
        { name: 'user_id', label: t('user_id'), required: true },
        { name: 'role', label: t('role'), type: 'select', options: ['STUDENT', 'TEACHER', 'COORDINATOR'].map((value) => ({ value, label: t('common:roles.' + value) })) },
        { name: 'group_id', label: t('group_id') },
      ]} onSave={async (values) => { await assignMember(subjectId, { ...values, group_id: values.group_id || null }); setAdding(false); state.reload(); }} />}
    </Dialog>
    <Dialog open={Boolean(removing)} title={t('remove')} onClose={() => !pending && setRemoving(null)} footer={<Button variant="danger" loading={pending} onClick={async () => {
      setPending(true); setError(null);
      try { await removeMember(subjectId, removing.id); setRemoving(null); state.reload(); } catch (err) { setError(err); } finally { setPending(false); }
    }}>{t('common:confirm')}</Button>}><p>{t('removeConfirm')}</p><p>{removing?.user_email}</p>{error && <div ref={removalErrorRef} tabIndex={-1}><ErrorState error={error} /></div>}</Dialog>
  </>;
}

function Groups({ subjectId }) {
  const { t } = useTranslation('subject-admin');
  const [page, setPage] = useState(1);
  const state = useApi(() => getGroups(subjectId, page), [subjectId, page]);
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const removalErrorRef = useRef(null);
  const removalTriggerRef = useRef(null);
  useEffect(() => {
    if (!removing) removalTriggerRef.current?.focus();
  }, [removing]);
  useEffect(() => {
    if (removing && error && !pending) removalErrorRef.current?.focus();
  }, [removing, error, pending]);
  const action = <Button variant="primary" onClick={() => setEditing({ label: '' })} disabled={state.loading || Boolean(state.error)}>{t('createGroup')}</Button>;
  return <>
    <div className="admin-actions">{action}</div>
    <Records state={state} focusError action={action} columns={[
      { key: 'label', header: t('label') }, { key: 'id', header: t('group_id') }, { key: 'member_count', header: t('member_count'), align: 'num' },
      { key: 'actions', header: t('actions'), render: (g) => <div className="admin-actions"><Button size="sm" onClick={() => setEditing(g)}>{t('editGroup')}</Button><Button size="sm" variant="danger" onClick={(event) => { removalTriggerRef.current = event.currentTarget; setError(null); setRemoving(g); }}>{t('deleteGroup')}</Button></div> },
    ]} />
    <Pagination data={state.data} page={page} onChange={setPage} />
    <Dialog open={Boolean(editing)} title={t(editing?.id ? 'editGroup' : 'createGroup')} onClose={() => setEditing(null)}>
      {editing && <RecordForm key={editing.id ?? 'new'} initial={{ label: editing.label }} fields={[{ name: 'label', label: t('label'), required: true }]} onSave={async (values) => {
        if (editing.id) await updateGroup(subjectId, editing.id, values); else await createGroup(subjectId, values);
        setEditing(null); state.reload();
      }} />}
    </Dialog>
    <Dialog open={Boolean(removing)} title={t('deleteGroup')} onClose={() => !pending && setRemoving(null)} footer={<Button variant="danger" loading={pending} onClick={async () => {
      setPending(true); setError(null);
      try { await deleteGroup(subjectId, removing.id); setRemoving(null); state.reload(); } catch (err) { setError(err); } finally { setPending(false); }
    }}>{t('common:confirm')}</Button>}><p>{t('deleteConfirm')}</p><p>{removing?.label}</p>{error && <div ref={removalErrorRef} tabIndex={-1}><ErrorState error={error} /></div>}</Dialog>
  </>;
}

function SubjectManagement({ subjectId }) {
  const { t } = useTranslation('subject-admin');
  const membershipHintId = useId();
  const [tab, setTab] = useState('members');
  const [member, setMember] = useState(null);
  const [inspection, setInspection] = useState(0);
  const [membership, setMembership] = useState('');
  return <>
    <PageHeader eyebrow={subjectId} title={t('title')} crumbs={[{ label: t('directory'), to: `/subjects/${subjectId}` }, { label: t('title') }]} />
    <Tabs label={t('title')} value={tab} onChange={setTab} tabs={['members', 'groups', 'permissions'].map((value) => ({ value, label: t(value) }))} />
    {tab === 'members' && <Members key={subjectId} subjectId={subjectId} onPermissions={(m) => { setMember(m); setTab('permissions'); }} />}
    {tab === 'groups' && <Groups key={subjectId} subjectId={subjectId} />}
    {tab === 'permissions' && <div className="admin-stack">
      <form className="admin-actions" onSubmit={(e) => {
        e.preventDefault();
        setMember({ id: membership.trim() });
        // A repeated lookup must fetch again, including after a failed request.
        setInspection((value) => value + 1);
      }}>
        <Field label={t('membership')} hint={<span id={membershipHintId}>{t('membershipHint')}</span>}>{(id) => <Input id={id} aria-describedby={membershipHintId} value={membership} onChange={(e) => setMembership(e.target.value)} required />}</Field><Button type="submit">{t('inspect')}</Button>
      </form>
      {member && <PermissionsEditor key={`${member.id}:${inspection}`} member={member} />}
    </div>}
  </>;
}

export default function ManagePage() {
  const { subjectId } = useParams();
  return <SubjectManagement key={subjectId} subjectId={subjectId} />;
}
