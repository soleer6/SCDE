import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Button, ErrorState, PageHeader } from '../../ui';
import { useApi } from '../../lib/hooks.js';
import { Pagination, Records } from '../admin/components.jsx';
import { getNotifications, markRead } from './api.js';

export default function NotificationsPage() {
  const { t } = useTranslation('notifications');
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const errorRef = useRef(null);
  const attemptedIds = useRef([]);
  const marking = useRef(false);
  const resultsRef = useRef(null);
  const recovering = useRef(false);
  const state = useApi(() => getNotifications(page), [page]);
  const unread = state.data?.results.filter((n) => n.status === 'UNREAD').map((n) => n.id) ?? [];
  useEffect(() => {
    if (error && !pending) errorRef.current?.focus();
  }, [error, pending]);
  useEffect(() => {
    if (state.loading) return;
    if (state.error) recovering.current = true;
    else if (state.data && recovering.current) {
      resultsRef.current?.focus();
      recovering.current = false;
    }
  }, [state.loading, state.error, state.data]);
  async function mark(ids) {
    if (marking.current) return;
    marking.current = true;
    attemptedIds.current = [...ids];
    setPending(true); setError(null);
    try {
      await markRead(ids);
      recovering.current = true;
      state.reload();
    } catch (err) { setError(err); } finally { marking.current = false; setPending(false); }
  }
  return <>
    <PageHeader eyebrow={t('account')} title={t('title')} actions={<Button variant="primary" loading={pending} disabled={!unread.length || state.loading} onClick={() => mark(unread)}>{t('markPage')}</Button>} />
    {error && <div ref={errorRef} tabIndex={-1}><ErrorState error={error} onRetry={() => mark(attemptedIds.current)} /></div>}
    <section ref={resultsRef} tabIndex={-1} aria-label={t('title')}>
    <Records focusError state={state} emptyTitle={t('empty')} emptyBody={t('emptyHint')} action={<Button onClick={state.reload}>{t('refresh')}</Button>} columns={[
      { key: 'title', header: t('message'), render: (n) => <><p>{n.title}</p><p className="u-muted">{n.message}</p></> },
      { key: 'created_at', header: t('date'), render: (n) => <time dateTime={n.created_at}>{new Date(n.created_at).toLocaleString()}</time> },
      { key: 'status', header: t('status'), render: (n) => <Badge tone={n.status === 'UNREAD' ? 'gold' : undefined}>{t(n.status === 'UNREAD' ? 'new' : 'read')}</Badge> },
      { key: 'actions', header: t('actions'), render: (n) => n.status === 'UNREAD' && <Button size="sm" aria-label={t('markNamed', { title: n.title })} disabled={pending} onClick={() => mark([n.id])}>{t('mark')}</Button> },
    ]} />
    </section>
    <Pagination data={state.data} page={page} onChange={setPage} />
  </>;
}
