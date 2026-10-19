import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAction, useApi } from '../../lib/hooks.js';
import { formatDateTime } from '../../lib/format.js';
import { Button, ButtonLink, EmptyState, ErrorState, Field, Loader, PageHeader, Textarea, useToast } from '../../ui';
import { getMyTasks } from '../workspace/api.js';
import { studentName } from '../workspace/model.js';
import { resolveReviewRequest } from './api.js';
import './reviews.css';

/** Teacher inbox of pending review requests (GET /my-tasks/ pending_reviews). */
export default function ReviewsPage() {
  const { t } = useTranslation('reviews');
  const tasks = useApi(() => getMyTasks(), []);
  const items = tasks.data?.pending_reviews ?? [];
  // After resolving, focus moves to the request that takes its place (or the list) instead of being lost.
  const focusAfter = useRef(null);
  const listRef = useRef(null);
  const settled = !tasks.loading && tasks.data;

  useEffect(() => {
    if (focusAfter.current == null || !settled) return;
    const index = focusAfter.current;
    focusAfter.current = null;
    const headings = listRef.current?.querySelectorAll('.rv-item h2');
    const target = headings?.length ? headings[Math.min(index, headings.length - 1)] : listRef.current;
    target?.focus();
  }, [settled]);

  const resolved = (index) => {
    focusAfter.current = index;
    tasks.reload();
  };

  return (
    <>
      <PageHeader eyebrow={t('eyebrow')} title={t('title')} lede={t('lede')} />
      {/* Loader only on first load: reloading keeps the list mounted so replies typed in other requests survive. */}
      {tasks.initialLoading ? (
        <Loader page />
      ) : tasks.error ? (
        <ErrorState error={tasks.error} onRetry={tasks.reload} />
      ) : (
        <section ref={listRef} tabIndex={-1} className="rv-region" aria-label={t('title')} aria-busy={tasks.loading}>
          {items.length ? (
            <ol className="rv-list">
              {items.map((r, i) => (
                <ReviewItem key={r.review_request_id} item={r} onDone={() => resolved(i)} />
              ))}
            </ol>
          ) : (
            <EmptyState title={t('emptyTitle')} body={t('emptyBody')} />
          )}
        </section>
      )}
    </>
  );
}

function ReviewItem({ item, onDone }) {
  const { t } = useTranslation('reviews');
  const { t: tc } = useTranslation();
  const toast = useToast();
  const [msg, setMsg] = useState('');
  const resolve = useAction(() => resolveReviewRequest(item.review_request_id, msg));

  const submit = async () => {
    try {
      await resolve.run();
      toast.success(t('resolved'));
      onDone();
    } catch (e) {
      toast.error(t(`errors.${e.code}`, { defaultValue: tc(`errors.${e.code}`, { defaultValue: tc('errors.UNKNOWN') }) }));
      // Someone else already resolved it (or it is gone): refresh so the stale request disappears.
      if (e.code === 'ALREADY_RESOLVED' || e.code === 'NOT_FOUND') onDone();
    }
  };

  const headingId = `rv-${item.review_request_id}`;
  const label = `${item.problem_name} · ${studentName(item.student_email)}`;

  return (
    <li className="rv-item" aria-labelledby={headingId}>
      <header className="rv-item__head">
        <div>
          <p className="ui-eyebrow">{item.exam_name}</p>
          <h2 className="ui-h3" id={headingId} tabIndex={-1}>
            {item.problem_name} <span className="u-muted">· {studentName(item.student_email)}</span>
          </h2>
        </div>
        <span className="u-muted">{formatDateTime(item.created_at)}</span>
      </header>
      <blockquote className="rv-quote">{item.student_message || t('noMessage')}</blockquote>
      <div className="rv-item__foot">
        <Field label={t('reply')} className="rv-reply">
          {(id) => <Textarea id={id} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={t('replyPlaceholder')} />}
        </Field>
        <div className="ui-row">
          <ButtonLink to={`/instances/${item.instance_id}/grade`} aria-label={t('openExamFor', { label })}>{t('openExam')}</ButtonLink>
          <Button variant="solid" onClick={submit} loading={resolve.pending} aria-label={t('resolveFor', { label })}>
            {t('resolve')}
          </Button>
        </div>
      </div>
    </li>
  );
}
