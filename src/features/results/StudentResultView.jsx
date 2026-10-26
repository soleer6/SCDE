import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useApi } from '../../lib/hooks.js';
import { formatDate, formatDateTime, formatScore } from '../../lib/format.js';
import { Badge, Button, DataTable, EmptyState, ErrorState, Loader, PageHeader, Panel } from '../../ui';
import { getExamInstances, getReview, asList } from '../exams/api.js';
import { listAnnotations, readAnnotationPayload } from '../grading/api.js';
import { readAnnotationLayers } from '../grading/annotationLayers.js';
import { usePdfUrl } from '../grading/usePdfUrl.js';
import PdfStage from '../grading/PdfStage.jsx';
import AudioNotes from '../grading/AudioNotes.jsx';
import { LifecycleRail, Score, StatusBadge } from '../workspace/domain.jsx';
import { listMyReviewRequests } from './api.js';
import ReviewRequestForm from './ReviewRequestForm.jsx';
import './results.css';

/** Student view of one exam: grade, breakdown, corrected PDF, review requests.
 *  Every block depends on the exam's student_permissions + review window,
 *  enforced by the backend: absent fields simply mean "not visible". */
export default function StudentResultView({ exam }) {
  const { t } = useTranslation('results');
  const instances = useApi(() => getExamInstances(exam.id).then(asList), [exam.id]);
  const review = useApi(() => getReview(exam.id), [exam.id]);
  const inst = instances.data?.[0];
  const requests = useApi(inst ? () => listMyReviewRequests(inst.id) : null, [inst?.id]);
  // After sending, focus moves to the request list; if the window closed
  // meanwhile, to the notice that replaces the form. Applied once reloaded.
  const focusAfter = useRef(null);
  const listRef = useRef(null);
  const closedRef = useRef(null);
  const settled = !instances.loading && !review.loading && !requests.loading;
  // Keyed on the data too: when a reload answers before the loading state is
  // rendered, both updates batch and `settled` never flips (seen under load).
  useEffect(() => {
    if (!focusAfter.current || !settled) return;
    (focusAfter.current === 'list' ? listRef : closedRef).current?.focus();
    focusAfter.current = null;
  }, [settled, instances.data, review.data, requests.data]);

  // The window closes server-side (Celery Beat) some time after end_date: a page kept open re-reads the
  // review at end_date and, while the server still says OPEN, every 30 s, so the form and the pages
  // follow the real state instead of failing on submit. Bytes already downloaded cannot be revoked.
  const { reload: reloadReview } = review;
  const { reload: reloadInstances } = instances;
  const { reload: reloadRequests } = requests;
  const endsAt = review.data?.status === 'OPEN' ? Date.parse(review.data.end_date) : NaN;
  useEffect(() => {
    if (!Number.isFinite(endsAt)) return undefined;
    const wait = endsAt - Date.now();
    if (wait > 2 ** 31 - 1) return undefined;
    const id = setTimeout(() => {
      reloadReview();
      reloadInstances();
      reloadRequests();
    }, wait > 0 ? wait + 1500 : 30000);
    return () => clearTimeout(id);
  }, [endsAt, review.data, reloadReview, reloadInstances, reloadRequests]);

  const header = (
    <PageHeader
      crumbs={[
        { label: t('crumbs.subjects'), to: '/subjects' },
        { label: exam.subject_code, to: `/subjects/${exam.subject_id}` },
        { label: exam.name },
      ]}
      eyebrow={`${exam.subject_code} · ${exam.subject_name} · ${formatDate(exam.date)}`}
      title={exam.name}
      actions={inst && <StatusBadge status={inst.status} />}
    />
  );

  // Reloads keep the page mounted (and the focus target alive).
  if (instances.initialLoading) return <>{header}<Loader page /></>;
  if (instances.error) return <>{header}<ErrorState error={instances.error} onRetry={instances.reload} /></>;
  if (!inst) {
    return (
      <>
        {header}
        <EmptyState title={t('empty.title')} body={t('empty.body')} />
      </>
    );
  }

  const maxTotal = inst.rubric?.reduce((a, p) => a + Number(p.max_score), 0);
  const reviewOpen = review.data?.status === 'OPEN' && inst.status === 'IN_REVIEW';

  return (
    <>
      {header}
      <div className="rs-hero">
        <div className="rs-hero__score">
          <span className="ui-eyebrow">{t('hero.grade')}</span>
          <Score value={inst.total_score} size="lg" />
          {maxTotal ? <span className="u-muted">{t('hero.over', { max: formatScore(maxTotal) })}</span> : null}
        </div>
        <div className="rs-hero__meta">
          <LifecycleRail status={inst.status} compact />
          {review.data && (
            <p className="u-muted">
              {reviewOpen
                ? t('hero.reviewOpen', { end: formatDateTime(review.data.end_date) })
                : t(`hero.review.${review.data.status}`, { start: formatDateTime(review.data.start_date), defaultValue: '' })}
            </p>
          )}
        </div>
      </div>

      <div className="dm-split rs-body">
        <section className="dm-section">
          {inst.pages ? (
            <StudentPdf instanceId={inst.id} canDownload={Boolean(inst.can_download)} fileName={`${exam.subject_code}-${exam.name}.pdf`} />
          ) : (
            <EmptyState title={t('pdf.hiddenTitle')} body={t(review.data ? 'pdf.hiddenAfter' : 'pdf.hiddenBody')} />
          )}
        </section>
        <aside className="ui-stack">
          <Breakdown inst={inst} />
          <TeacherComment instanceId={inst.id} visible={Boolean(inst.pages)} problems={inst.rubric ?? inst.grades ?? []} />
          {inst.pages && <AudioNotes instanceId={inst.id} canEdit={false} />}
          <Panel title={t('review.title')}>
            {reviewOpen ? (
              <ReviewRequestForm
                inst={inst}
                existing={requests.data ?? []}
                onSent={() => { focusAfter.current = 'list'; requests.reload(); }}
                onStale={() => { focusAfter.current = 'closed'; review.reload(); instances.reload(); }}
              />
            ) : (
              <p ref={closedRef} tabIndex={-1} role="status" className="u-muted">{review.data ? t('review.closed') : t('review.notOpen')}</p>
            )}
            {(requests.data ?? []).length > 0 && (
              <section ref={listRef} tabIndex={-1} aria-label={t('review.requests')}>
                <RequestList items={requests.data} />
              </section>
            )}
          </Panel>
        </aside>
      </div>
    </>
  );
}

function Breakdown({ inst }) {
  const { t } = useTranslation('results');
  const rows = useMemo(() => {
    if (!inst.grades && !inst.rubric) return null;
    const names = (inst.rubric ?? inst.grades).map((r) => r.problem_name);
    return names.map((name) => {
      const g = inst.grades?.find((x) => x.problem_name === name);
      const r = inst.rubric?.find((x) => x.problem_name === name);
      return { id: name, name, score: g?.score ?? null, max: r?.max_score ?? null, selections: g?.rubric_selections ?? [] };
    });
  }, [inst]);

  return (
    <Panel title={t('breakdown.title')} flush>
      {rows ? (
        <DataTable
          caption={t('breakdown.title')}
          rows={rows}
          columns={[
            { key: 'name', header: t('breakdown.problem') },
            { key: 'score', header: t('breakdown.score'), align: 'num', render: (r) => formatScore(r.score) },
            { key: 'max', header: t('breakdown.max'), align: 'num', render: (r) => (r.max ? formatScore(r.max) : '—') },
          ]}
        />
      ) : (
        <p className="rs-pad u-muted">{t('breakdown.hidden')}</p>
      )}
    </Panel>
  );
}

function StudentPdf({ instanceId, canDownload, fileName }) {
  const { t } = useTranslation('results');
  const { url, error } = usePdfUrl(instanceId);
  const ann = useApi(async () => {
    try {
      const list = await listAnnotations(instanceId);
      return await readAnnotationLayers(list);
    } catch (e) {
      if (e.status === 403) return { layersByPage: {} }; // annotations hidden by exam permissions
      throw e;
    }
  }, [instanceId]);

  if (error) return <ErrorState error={error} title={t('pdf.error')} />;
  const annotations = { strokesByPage: {}, layersByPage: ann.data?.layersByPage ?? {}, loading: ann.loading };
  return <>
    {ann.error && <ErrorState error={ann.error} onRetry={ann.reload} />}
    <PdfStage
      url={url}
      annotations={annotations}
      readOnly
      aside={canDownload && (
        <Button size="sm" variant="ghost" disabled={!url} onClick={() => Object.assign(document.createElement('a'), { href: url, download: fileName }).click()}>
          {t('pdf.download')}
        </Button>
      )}
    />
  </>;
}

function TeacherComment({ instanceId, visible, problems = [] }) {
  const { t } = useTranslation('results');
  const comment = useApi(
    visible
      ? async () => {
          try {
            const list = await listAnnotations(instanceId);
            return await Promise.all(list.filter((x) => x.annotation_type === 'TEXT').map(async (a) => ({ ...a, text: await readAnnotationPayload(a) })));
          } catch (e) {
            if (e.status === 403) return [];
            throw e;
          }
        }
      : null,
    [instanceId, visible],
  );
  if (!visible) return null;
  if (comment.error) return <ErrorState error={comment.error} onRetry={comment.reload} />;
  if (!comment.data?.length) return null;
  return (
    <Panel title={t('comment.title')}>
      {comment.data.map((a) => <div key={a.id}>
        {a.author_email && <strong>{a.author_email}</strong>}
        {a.problem_id && <span className="u-muted"> · {(problems.find((x) => x.problem_id === a.problem_id)?.problem_name) ?? ''}</span>}
        <p className="rs-comment">{a.text}</p>
      </div>)}
    </Panel>
  );
}

function RequestList({ items }) {
  const { t } = useTranslation('results');
  return (
    <ul className="rs-requests">
      {items.map((r) => (
        <li key={r.id}>
          <div className="ui-row">
            <span>{r.problem_name}</span>
            <Badge tone={r.resolved ? 'green' : 'gold'}>{r.resolved ? t('review.resolved') : t('review.pending')}</Badge>
          </div>
          {r.student_message && <p className="u-muted">{r.student_message}</p>}
          {r.resolver_message && (
            <p className="rs-reply">
              <span className="ui-eyebrow">{t('review.reply')}</span> {r.resolver_message}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
