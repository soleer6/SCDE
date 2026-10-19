import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useApi } from '../../lib/hooks.js';
import { formatDate, formatDateTime, formatScore } from '../../lib/format.js';
import { Badge, DataTable, EmptyState, ErrorState, Loader, PageHeader, Panel } from '../../ui';
import { getExamInstances, getReview, asList } from '../exams/api.js';
import { listAnnotations, readAnnotationPayload } from '../grading/api.js';
import { isPadAnnotation, parseInk } from '../grading/ocr.js';
import { usePdfUrl } from '../grading/usePdfUrl.js';
import PdfStage from '../grading/PdfStage.jsx';
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
            <StudentPdf instanceId={inst.id} />
          ) : (
            <EmptyState title={t('pdf.hiddenTitle')} body={t(review.data ? 'pdf.hiddenAfter' : 'pdf.hiddenBody')} />
          )}
        </section>
        <aside className="ui-stack">
          <Breakdown inst={inst} />
          <TeacherComment instanceId={inst.id} visible={Boolean(inst.pages)} />
          <Panel title={t('review.title')}>
            {reviewOpen ? (
              <ReviewRequestForm
                inst={inst}
                existing={requests.data ?? []}
                onSent={() => { focusAfter.current = 'list'; requests.reload(); }}
                onStale={() => { focusAfter.current = 'closed'; review.reload(); instances.reload(); }}
              />
            ) : (
              <p ref={closedRef} tabIndex={-1} className="u-muted">{review.data ? t('review.closed') : t('review.notOpen')}</p>
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

function StudentPdf({ instanceId }) {
  const { t } = useTranslation('results');
  const { url, error } = usePdfUrl(instanceId);
  const ann = useApi(async () => {
    try {
      const list = await listAnnotations(instanceId);
      const byPage = {};
      await Promise.all(
        list
          .filter((a) => a.annotation_type === 'STYLUS' && !isPadAnnotation(a))
          .map(async (a) => {
            const strokes = parseInk(await readAnnotationPayload(a)); // null: pad payload
            if (strokes) byPage[a.page_number] = strokes;
          }),
      );
      return byPage;
    } catch (e) {
      if (e.status === 403) return {}; // annotations hidden by exam permissions
      throw e;
    }
  }, [instanceId]);

  if (error) return <ErrorState error={error} title={t('pdf.error')} />;
  const annotations = { strokesByPage: ann.data ?? {}, loading: ann.loading, undo() {}, clearPage() {}, addStroke() {} };
  return <PdfStage url={url} annotations={annotations} readOnly />;
}

function TeacherComment({ instanceId, visible }) {
  const { t } = useTranslation('results');
  const comment = useApi(
    visible
      ? async () => {
          try {
            const list = await listAnnotations(instanceId);
            const a = list.find((x) => x.annotation_type === 'TEXT' && !x.problem_id);
            return a ? readAnnotationPayload(a) : '';
          } catch {
            return '';
          }
        }
      : null,
    [instanceId, visible],
  );
  if (!visible || !comment.data) return null;
  return (
    <Panel title={t('comment.title')}>
      <p className="rs-comment">{comment.data}</p>
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
