import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApi, useAction } from '../../lib/hooks.js';
import { Badge, Button, ErrorState, Field, Loader, PageHeader, Panel, Textarea, useToast } from '../../ui';
import { getAllExamInstances, getExam } from '../exams/api.js';
import { LifecycleRail, Score, StatusBadge } from '../workspace/domain.jsx';
import { studentName } from '../workspace/model.js';
import { getInstance, transitionInstance } from './api.js';
import { usePdfUrl } from './usePdfUrl.js';
import { useAnnotations } from './useAnnotations.js';
import { useKnownGrades } from './useKnownGrades.js';
import PdfStage from './PdfStage.jsx';
import ProblemGrader from './ProblemGrader.jsx';
import { CommentOcr } from './HandwritingOcr.jsx';

const EDITABLE = ['PENDING_GRADING', 'GRADED', 'PENDING_REVIEW'];

export default function GradingPage() {
  const { instanceId } = useParams();
  const { t } = useTranslation('grading');
  const { t: tc } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();

  const inst = useApi(() => getInstance(instanceId), [instanceId]);
  const examId = inst.data?.exam_id;
  const exam = useApi(examId ? () => getExam(examId) : null, [examId]);
  const siblings = useApi(examId ? () => getAllExamInstances(examId, { status: 'PENDING_GRADING' }) : null, [examId]);
  const { url: pdfUrl, error: pdfError } = usePdfUrl(instanceId);
  const annotations = useAnnotations(instanceId);
  const known = useKnownGrades(instanceId);
  const transition = useAction((target) => transitionInstance(instanceId, target));

  const problems = useMemo(() => {
    const model = exam.data?.models_problems?.find((m) => m.model_id === inst.data?.model_id) ?? exam.data?.models_problems?.[0];
    return model?.problems ?? [];
  }, [exam.data, inst.data]);

  // Only the first load shows the loader: reloading after each grade must not unmount the PDF and the problem rows.
  if (inst.error) return <ErrorState error={inst.error} onRetry={inst.reload} />;
  if (exam.error) return <ErrorState error={exam.error} onRetry={exam.reload} />;
  if (!inst.data || !exam.data) return <Loader page />;

  const i = inst.data;
  const e = exam.data;
  const editable = EDITABLE.includes(i.status);
  const gradedCount = problems.filter((p) => known.grades[p.id] !== undefined).length;
  const maxTotal = problems.reduce((a, p) => a + Number(p.max_score), 0);
  const next = (siblings.data ?? []).find((s) => s.id !== i.id);

  const move = async (target, msgKey) => {
    try {
      await transition.run(target);
      toast.success(t(msgKey));
      inst.reload();
    } catch (err) {
      toast.error(tc(`errors.${err.code}`, { defaultValue: err.code }));
    }
  };

  return (
    <>
      <PageHeader
        crumbs={[
          { label: e.subject_code, to: `/subjects/${e.subject_id}` },
          { label: e.name, to: `/exams/${e.id}` },
          { label: studentName(i.student_email) },
        ]}
        eyebrow={`${e.subject_code} · ${e.name} · ${t('header.model', { label: i.model_label || '—' })}`}
        title={i.student_email ? studentName(i.student_email) : t('header.unidentified')}
        lede={i.student_email || undefined}
        actions={
          <>
            <StatusBadge status={i.status} />
            {next && (
              <Button onClick={() => navigate(`/instances/${next.id}/grade`)}>{t('actions.next')}</Button>
            )}
            {i.status === 'PENDING_GRADING' && (
              <Button variant="solid" onClick={() => move('GRADED', 'toast.graded')} loading={transition.pending} disabled={!problems.length || gradedCount < problems.length}>
                {t('actions.finish')}
              </Button>
            )}
            {i.status === 'GRADED' && (
              <Button variant="primary" onClick={() => move('PENDING_GRADING', 'toast.reopened')} loading={transition.pending}>
                {t('actions.reopen')}
              </Button>
            )}
          </>
        }
      />
      <div className="gr-railbar">
        <LifecycleRail status={i.status} compact />
      </div>

      <div className="gr-layout">
        {pdfError ? (
          <ErrorState error={pdfError} title={t('stage.pdfError')} />
        ) : (
          <PdfStage url={pdfUrl} annotations={annotations} readOnly={!editable} aside={<SaveState state={annotations.saveState} />} />
        )}

        <aside className="gr-side">
          <Panel title={t('side.total')}>
            <div className="gr-total">
              <Score value={i.total_score} max={maxTotal} size="md" />
              <span className="u-muted u-num" role="status">{t('side.progress', { done: gradedCount, total: problems.length })}</span>
            </div>
          </Panel>

          <Panel title={t('side.problems')} flush>
            {!problems.length && <p className="gr-empty u-muted">{t('side.noProblems')}</p>}
            {problems.map((p) => (
              <ProblemGrader
                key={p.id}
                instanceId={i.id}
                problem={p}
                known={known}
                disabled={!editable}
                onSaved={() => inst.reload()}
              />
            ))}
          </Panel>

          <Panel title={t('side.comment')}>
            <Field hint={t('side.commentHint')}>
              {(id) => (
                <Textarea
                  id={id}
                  aria-label={t('side.comment')}
                  value={annotations.comment}
                  onChange={(ev) => annotations.setComment(ev.target.value)}
                  disabled={!editable || annotations.loading}
                  placeholder={t('side.commentPlaceholder')}
                />
              )}
            </Field>
            {editable && !annotations.loading && (
              <CommentOcr
                instanceId={i.id}
                onText={(text) => annotations.setComment(annotations.comment ? `${annotations.comment}\n${text}` : text)}
              />
            )}
          </Panel>

          {!editable && <Badge plain>{t('side.locked', { status: tc(`status.${i.status}`) })}</Badge>}
          {known.unknownTotal(i.total_score, problems) && <p className="u-muted">{t('side.unknownGrades')}</p>}
          <p className="u-muted">{t('side.shortcuts')}</p>
        </aside>
      </div>
    </>
  );
}

function SaveState({ state }) {
  const { t } = useTranslation('grading');
  return <span className={`gr-save is-${state}`} role="status">{t(`save.${state}`)}</span>;
}
