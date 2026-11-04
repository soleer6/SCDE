import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Button, ErrorState, Field, PageHeader, Select } from '../../ui';
import { useApi } from '../../lib/hooks.js';
import { Pagination, Records } from '../admin/components.jsx';
import { getNotifications, markRead } from './api.js';

export default function NotificationsPage() {
  const { t } = useTranslation('notifications');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const errorRef = useRef(null);
  const attemptedIds = useRef([]);
  const marking = useRef(false);
  const resultsRef = useRef(null);
  const recovering = useRef(false);
  const focusAfterLoad = useRef(null);
  const state = useApi(() => getNotifications(page, {
    ...(status ? { status } : {}), ...(type ? { notification_type: type } : {}),
  }), [page, status, type]);
  const unread = state.data?.results.filter((n) => n.status === 'UNREAD').map((n) => n.id) ?? [];
  useEffect(() => {
    if (error && !pending) errorRef.current?.focus();
  }, [error, pending]);
  useEffect(() => {
    if (state.loading) return;
    if (state.error) {
      focusAfterLoad.current = null;
      recovering.current = true;
    } else if (state.data && (recovering.current || (focusAfterLoad.current && focusAfterLoad.current.data !== state.data))) {
      resultsRef.current?.focus();
      recovering.current = false;
      focusAfterLoad.current = null;
    }
  }, [state.loading, state.error, state.data]);
  async function mark(ids) {
    if (marking.current) return;
    marking.current = true;
    attemptedIds.current = [...ids];
    setPending(true); setError(null);
    try {
      await markRead(ids);
      focusAfterLoad.current = { data: state.data };
      // A filtered last page may disappear after marking its final unread row.
      setPage(1);
      state.reload();
    } catch (err) { setError(err); } finally { marking.current = false; setPending(false); }
  }
  return <>
    <PageHeader eyebrow={t('account')} title={t('title')} actions={<>
      <Button loading={pending} disabled={!unread.length || state.loading} onClick={() => mark(unread)}>{t('markPage')}</Button>
      <Button variant="primary" loading={pending} disabled={state.loading || Boolean(state.error)} onClick={() => mark([])}>{t('markAll')}</Button>
    </>} />
    <p className="u-muted">{t('markAllHint')}</p>
    <div className="admin-filters">
      <Field label={t('statusFilter')}>{id => <Select id={id} value={status} disabled={pending} onChange={e => { setStatus(e.target.value); setPage(1); }} options={[
        { value: '', label: t('active') }, ...['UNREAD', 'READ', 'ARCHIVED'].map(value => ({ value, label: t(`statuses.${value}`) })),
      ]} />}</Field>
      <Field label={t('typeFilter')}>{id => <Select id={id} value={type} disabled={pending} onChange={e => { setType(e.target.value); setPage(1); }} options={[
        { value: '', label: t('allTypes') }, ...['GRADES_PUBLISHED', 'REVIEW_OPENED', 'REVIEW_RESULT', 'REVIEW_REQUESTS_SUMMARY', 'ASSIGNMENT_CREATED', 'INGESTION_ISSUE', 'COURSE_TRANSITION', 'DELETION_REMINDER', 'GENERAL'].map(value => ({ value, label: t(`types.${value}`) })),
      ]} />}</Field>
    </div>
    {error && <div ref={errorRef} tabIndex={-1}><ErrorState error={error} onRetry={() => mark(attemptedIds.current)} /></div>}
    <section ref={resultsRef} tabIndex={-1} aria-label={t('title')}>
    <Records focusError state={state} emptyTitle={t('empty')} emptyBody={t('emptyHint')} action={<Button onClick={() => { focusAfterLoad.current = { data: state.data }; state.reload(); }}>{t('refresh')}</Button>} columns={[
      { key: 'title', header: t('message'), render: (n) => <><p>{n.title}</p><p className="u-muted">{n.message}</p></> },
      { key: 'created_at', header: t('date'), render: (n) => <time dateTime={n.created_at}>{new Date(n.created_at).toLocaleString()}</time> },
      { key: 'status', header: t('status'), render: (n) => <Badge tone={n.status === 'UNREAD' ? 'gold' : undefined}>{t(`statuses.${n.status}`)}</Badge> },
      { key: 'actions', header: t('actions'), render: (n) => n.status === 'UNREAD' && <Button size="sm" aria-label={t('markNamed', { title: n.title })} disabled={pending} onClick={() => mark([n.id])}>{t('mark')}</Button> },
    ]} />
    </section>
    <Pagination data={state.data} page={page} onChange={(value) => { focusAfterLoad.current = { data: state.data }; setPage(value); }} />
  </>;
}
