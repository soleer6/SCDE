import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../lib/auth/AuthProvider.jsx';
import { useAction, useApi } from '../../lib/hooks.js';
import { formatDate, formatDateTime, formatScore, toNumber } from '../../lib/format.js';
import { can } from '../../lib/permissions.js';
import {
  Badge, Button, ButtonLink, DataTable, Dialog, EmptyState, ErrorState, Field, Input, KeyValue, Loader, PageHeader, Panel, Stats, Tabs, useToast,
} from '../../ui';
import { Score, StatusBadge } from '../workspace/domain.jsx';
import { GRADED_STATES, studentName } from '../workspace/model.js';
import { createReview, exportGrades, getAllExamInstances, getReview, publishExam } from './api.js';
import './exams.css';

const FILTERS = {
  all: () => true,
  todo: (i) => i.status === 'PENDING_GRADING',
  graded: (i) => i.status === 'GRADED',
  published: (i) => ['PUBLISHED', 'FINALIZED', 'ARCHIVED'].includes(i.status),
  review: (i) => ['IN_REVIEW', 'PENDING_REVIEW'].includes(i.status),
  issues: (i) => i.has_issues || ['ASSEMBLING', 'RECEIVED', 'QUEUED'].includes(i.status),
};

export default function TeacherExamView({ exam, role }) {
  const { t } = useTranslation('exams');
  const { session } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');
  const [reviewOpen, setReviewOpen] = useState(false);

  const instances = useApi(() => getAllExamInstances(exam.id), [exam.id]);
  const review = useApi(() => getReview(exam.id), [exam.id]);
  const publish = useAction(() => publishExam(exam.id));

  const list = useMemo(() => instances.data ?? [], [instances.data]);
  const counts = useMemo(() => Object.fromEntries(Object.entries(FILTERS).map(([k, f]) => [k, list.filter(f).length])), [list]);
  const gradedList = list.filter((i) => GRADED_STATES.includes(i.status));
  const avg = gradedList.length ? gradedList.reduce((a, i) => a + (toNumber(i.total_score) ?? 0), 0) / gradedList.length : null;
  const maxScore = exam.models_problems?.[0]?.problems.reduce((a, p) => a + Number(p.max_score), 0);

  const canPublish = can(session, role, 'can_publish_grades');
  const canReview = can(session, role, 'can_manage_reviews');
  const canExport = can(session, role, 'can_export_grades');
  const canSetup = ['can_create_exams', 'can_create_rubric', 'can_assign_correctors'].some((p) => can(session, role, p));
  const allPublished = list.length > 0 && list.every((i) => ['PUBLISHED', 'ARCHIVED'].includes(i.status));

  const onPublish = async () => {
    try {
      const r = await publish.run();
      toast.success(t('publish.done', { count: r.published }));
      instances.reload();
    } catch (e) {
      toast.error(t(`errors.${e.code}`, { ns: 'common', defaultValue: e.code }));
    }
  };

  const onExport = async () => {
    try {
      const blob = await exportGrades(exam.id, 'csv');
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), { href: url, download: `${exam.subject_code}-${exam.name}.csv` });
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(t(`errors.${e.code}`, { ns: 'common', defaultValue: e.code }));
    }
  };

  return (
    <>
      <PageHeader
        crumbs={[
          { label: t('crumbs.subjects'), to: '/subjects' },
          { label: exam.subject_code, to: `/subjects/${exam.subject_id}` },
          { label: exam.name },
        ]}
        eyebrow={`${exam.subject_code} · ${exam.subject_name} · ${formatDate(exam.date)}`}
        title={exam.name}
        actions={
          <>
            {canSetup && <ButtonLink to={`/exams/${exam.id}/setup`}>{t('actions.configure')}</ButtonLink>}
            {canExport && <Button onClick={onExport}>{t('actions.export')}</Button>}
            {canReview && allPublished && !review.data && (
              <Button variant="primary" onClick={() => setReviewOpen(true)}>
                {t('actions.openReview')}
              </Button>
            )}
            {canPublish && counts.graded > 0 && (
              <Button variant="solid" onClick={onPublish} loading={publish.pending}>
                {t('actions.publish', { count: counts.graded })}
              </Button>
            )}
          </>
        }
      />

      <Stats
        items={[
          { label: t('stats.enrolled'), value: list.length },
          { label: t('stats.todo'), value: counts.todo, tone: counts.todo ? 'gold' : undefined },
          { label: t('stats.graded'), value: gradedList.length },
          { label: t('stats.average'), value: avg === null ? '—' : formatScore(avg, 1) },
        ]}
      />

      <div className="dm-split ex-body">
        <section className="dm-section">
          <Tabs
            label={t('filters.label')}
            value={filter}
            onChange={setFilter}
            tabs={Object.keys(FILTERS).map((k) => ({ value: k, label: t(`filters.${k}`), count: counts[k] }))}
          />
          {instances.loading ? (
            <Loader />
          ) : instances.error ? (
            <ErrorState error={instances.error} onRetry={instances.reload} />
          ) : (
            <DataTable
              caption={t('instances.caption')}
              rows={list.filter(FILTERS[filter])}
              onRowClick={(i) => navigate(`/instances/${i.id}/grade`)}
              empty={<EmptyState title={t(filter === 'all' ? 'instances.emptyAll' : 'instances.empty')} body={filter === 'all' ? t('instances.emptyAllBody') : undefined} />}
              columns={[
                {
                  key: 'student',
                  header: t('cols.student'),
                  render: (i) =>
                    i.student_email ? (
                      <span className="ex-student">
                        <span>{studentName(i.student_email)}</span>
                        <span className="u-muted">{i.student_email}</span>
                      </span>
                    ) : (
                      <Badge tone="rust">{t('instances.unidentified')}</Badge>
                    ),
                },
                { key: 'model', header: t('cols.model'), render: (i) => i.model_label || '—' },
                { key: 'status', header: t('cols.status'), render: (i) => <StatusBadge status={i.status} /> },
                { key: 'score', header: t('cols.score'), align: 'num', render: (i) => (i.total_score == null ? '—' : <Score value={i.total_score} size="sm" />) },
              ]}
            />
          )}
        </section>

        <aside className="ui-stack">
          <Panel title={t('problems.title')} flush>
            <ul className="ex-problems">
              {(exam.models_problems ?? []).flatMap((m) =>
                m.problems.map((p) => (
                  <li key={p.id}>
                    <span className="u-muted u-num">{String(p.order).padStart(2, '0')}</span>
                    <span>{p.name}</span>
                    <span className="u-num">{formatScore(p.max_score)}</span>
                  </li>
                )),
              )}
              {maxScore != null && (
                <li className="ex-problems__total">
                  <span />
                  <span>{t('problems.total')}</span>
                  <span className="u-num">{formatScore(maxScore)}</span>
                </li>
              )}
            </ul>
          </Panel>
          <Panel title={t('review.title')}>
            {review.loading ? (
              <Loader />
            ) : review.data ? (
              <KeyValue
                items={[
                  { label: t('review.status'), value: <Badge tone={review.data.status === 'OPEN' ? 'gold' : undefined}>{t(`review.states.${review.data.status}`, { defaultValue: review.data.status })}</Badge> },
                  { label: t('review.from'), value: formatDateTime(review.data.start_date) },
                  { label: t('review.to'), value: formatDateTime(review.data.end_date) },
                  { label: t('review.requests'), value: review.data.request_count },
                ]}
              />
            ) : (
              <p className="u-muted">{allPublished ? t('review.none') : t('review.needsPublish')}</p>
            )}
          </Panel>
        </aside>
      </div>

      <ReviewDialog
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        examId={exam.id}
        onCreated={() => {
          setReviewOpen(false);
          review.reload();
          instances.reload();
          toast.success(t('review.created'));
        }}
      />
    </>
  );
}

const toLocalInput = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

function ReviewDialog({ open, onClose, examId, onCreated }) {
  const { t } = useTranslation('exams');
  const { t: tc } = useTranslation();
  const now = new Date();
  const [start, setStart] = useState(toLocalInput(now));
  const [end, setEnd] = useState(toLocalInput(new Date(now.getTime() + 7 * 864e5)));
  const action = useAction(() => createReview(examId, { start_date: new Date(start).toISOString(), end_date: new Date(end).toISOString(), notify_students: true }));

  const submit = async () => {
    try {
      await action.run();
      onCreated();
    } catch {
      /* shown below */
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('review.dialogTitle')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button variant="solid" onClick={submit} loading={action.pending}>
            {t('actions.openReview')}
          </Button>
        </>
      }
    >
      <p className="u-muted">{t('review.dialogBody')}</p>
      <Field label={t('review.from')}>{(id) => <Input id={id} type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />}</Field>
      <Field label={t('review.to')}>{(id) => <Input id={id} type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />}</Field>
      {action.error && (
        <p className="u-rust" role="alert">
          {t(`review.errors.${action.error.code}`, { defaultValue: tc(`errors.${action.error.code}`, { defaultValue: action.error.code }) })}
        </p>
      )}
    </Dialog>
  );
}
