import { useState } from 'react';
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

  return (
    <>
      <PageHeader eyebrow={t('eyebrow')} title={t('title')} lede={t('lede')} />
      {tasks.loading ? (
        <Loader page />
      ) : tasks.error ? (
        <ErrorState error={tasks.error} onRetry={tasks.reload} />
      ) : items.length ? (
        <ol className="rv-list">
          {items.map((r) => (
            <ReviewItem key={r.review_request_id} item={r} onResolved={tasks.reload} />
          ))}
        </ol>
      ) : (
        <EmptyState title={t('emptyTitle')} body={t('emptyBody')} />
      )}
    </>
  );
}

function ReviewItem({ item, onResolved }) {
  const { t } = useTranslation('reviews');
  const { t: tc } = useTranslation();
  const toast = useToast();
  const [msg, setMsg] = useState('');
  const resolve = useAction(() => resolveReviewRequest(item.review_request_id, msg));

  const submit = async () => {
    try {
      await resolve.run();
      toast.success(t('resolved'));
      onResolved();
    } catch (e) {
      toast.error(tc(`errors.${e.code}`, { defaultValue: e.code }));
    }
  };

  return (
    <li className="rv-item">
      <header className="rv-item__head">
        <div>
          <p className="ui-eyebrow">{item.exam_name}</p>
          <h2 className="ui-h3">
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
          <ButtonLink to={`/instances/${item.instance_id}/grade`}>{t('openExam')}</ButtonLink>
          <Button variant="solid" onClick={submit} loading={resolve.pending}>
            {t('resolve')}
          </Button>
        </div>
      </div>
    </li>
  );
}
