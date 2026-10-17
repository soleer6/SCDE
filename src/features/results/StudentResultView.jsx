import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useApi } from '../../lib/hooks.js';
import { formatDate, formatDateTime, formatScore } from '../../lib/format.js';
import { Badge, DataTable, EmptyState, ErrorState, Loader, PageHeader, Panel } from '../../ui';
import { getExamInstances, getReview, asList } from '../exams/api.js';
import { listAnnotations, readAnnotationPayload } from '../grading/api.js';
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

  if (instances.loading) return <>{header}<Loader page /></>;
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
              <ReviewRequestForm inst={inst} existing={requests.data ?? []} onSent={requests.reload} />
            ) : (
              <p className="u-muted">{review.data ? t('review.closed') : t('review.notOpen')}</p>
            )}
            {(requests.data ?? []).length > 0 && <RequestList items={requests.data} />}
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
          .filter((a) => a.annotation_type === 'STYLUS')
          .map(async (a) => {
            try {
              const d = JSON.parse(await readAnnotationPayload(a));
              byPage[a.page_number] = Array.isArray(d) ? d : d.strokes ?? [];
            } catch {
              /* unreadable payload: skip */
            }
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
