import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApi, useAction } from '../../lib/hooks.js';
import { Badge, Button, Dialog, ErrorState, Field, Loader, PageHeader, Panel, Textarea, useToast } from '../../ui';
import { useAuth } from '../../lib/auth/AuthProvider.jsx';
import { getAllExamInstances, getExam } from '../exams/api.js';
import { getMyTasks, useMySubjects } from '../workspace/api.js';
import { LifecycleRail, Score, StatusBadge } from '../workspace/domain.jsx';
import { studentName } from '../workspace/model.js';
import { getInstance, serverGrades, transitionInstance } from './api.js';
import { usePdfUrl } from './usePdfUrl.js';
import { useAnnotations } from './useAnnotations.js';
import { useKnownGrades } from './useKnownGrades.js';
import AudioNotes from './AudioNotes.jsx';
import PdfStage from './PdfStage.jsx';
import ProblemGrader from './ProblemGrader.jsx';
import { CommentOcr } from './HandwritingOcr.jsx';

/** Retrocesos del ciclo de vida (RF-7.5) que afectan al alumno: piden confirmación. */
const CONFIRMED_MOVES = { PUBLISHED: 'GRADED', FINALIZED: 'PENDING_REVIEW' };

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
  const annotations = useAnnotations(instanceId, { readOnly: !EDITABLE.includes(inst.data?.status) });
  const server = useMemo(() => serverGrades(inst.data), [inst.data]);
  const known = useKnownGrades(instanceId, server);
  const [confirm, setConfirm] = useState(false);
  const transition = useAction((target) => transitionInstance(instanceId, target));

  // GET /my-tasks/?exam_id= lists, per instance, the problems the rules assign to this corrector
  // (problems_sent). Staff and coordinators grade everything; a corrector sees only their own problems.
  const { session } = useAuth();
  const { roleOf } = useMySubjects();
  const subjectId = exam.data?.subject_id;
  const tasks = useApi(examId ? () => getMyTasks(examId) : null, [examId]);
  const sees = useMemo(() => {
    const mine = (tasks.data?.grading_tasks ?? []).filter((x) => x.instance_id === instanceId);
    if (session?.isStaff || session?.isSuperadmin || roleOf(subjectId) === 'COORDINATOR' || !mine.length) return null;
    return new Set(mine.flatMap((x) => x.problems_sent));
  }, [tasks.data, instanceId, session, roleOf, subjectId]);

  const problems = useMemo(() => {
    const model = exam.data?.models_problems?.find((m) => m.model_id === inst.data?.model_id) ?? exam.data?.models_problems?.[0];
    const all = model?.problems ?? [];
    return sees ? all.filter((p) => sees.has(p.id)) : all;
  }, [exam.data, inst.data, sees]);

  // Only the first load (or a new instance) shows the loader: reloading after each grade must not unmount the PDF and the problem rows.
  if (inst.error) return <ErrorState error={inst.error} onRetry={inst.reload} />;
  if (exam.error) return <ErrorState error={exam.error} onRetry={exam.reload} />;
  if (inst.initialLoading || exam.initialLoading || !inst.data || !exam.data) return <Loader page />;

  const i = inst.data;
  const e = exam.data;
  const editable = EDITABLE.includes(i.status);
  const gradedCount = problems.filter((p) => known.grades[p.id] !== undefined).length;
  const maxTotal = problems.reduce((a, p) => a + Number(p.max_score), 0);
  const next = (siblings.data ?? []).find((s) => s.id !== i.id);

  // After a 409 VERSION_CONFLICT: re-read the instance so old_score is the persisted one before any retry.
  const refreshGrades = async () => {
    const fresh = await getInstance(instanceId);
    inst.setData(fresh);
    return serverGrades(fresh);
  };

  const move = async (target, msgKey) => {
    try {
      if (!await annotations.flush()) return;
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
              <Button onClick={async () => { if (await annotations.flush()) navigate(`/instances/${next.id}/grade`); }} disabled={annotations.loading || annotations.loadFailed}>{t('actions.next')}</Button>
            )}
            {i.status === 'PENDING_GRADING' && (
              <Button variant="solid" onClick={() => move('GRADED', 'toast.graded')} loading={transition.pending} disabled={!problems.length || gradedCount < problems.length}>
                {t('actions.finish')}
              </Button>
            )}
            {i.status === 'PENDING_REVIEW' && (
              <Button variant="solid" onClick={() => move('GRADED', 'toast.graded')} loading={transition.pending} disabled={!problems.length || gradedCount < problems.length}>
                {t('actions.finish')}
              </Button>
            )}
            {CONFIRMED_MOVES[i.status] && (
              <Button onClick={() => setConfirm(true)} loading={transition.pending}>
                {t(`actions.back.${i.status}`)}
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
      <Dialog
        open={confirm}
        title={CONFIRMED_MOVES[i.status] ? t(`actions.back.${i.status}`) : ''}
        onClose={() => setConfirm(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>{t('confirm.cancel')}</Button>
            <Button
              variant="solid"
              loading={transition.pending}
              onClick={async () => {
                await move(CONFIRMED_MOVES[i.status], `toast.back.${i.status}`);
                setConfirm(false);
              }}
            >
              {t('confirm.accept')}
            </Button>
          </>
        }
      >
        <p>{CONFIRMED_MOVES[i.status] ? t(`confirm.body.${i.status}`) : null}</p>
      </Dialog>
      <div className="gr-railbar">
        <LifecycleRail status={i.status} compact />
      </div>

      {annotations.error && <ErrorState error={annotations.error} title={t(annotations.loadFailed ? 'annotations.loadError' : 'annotations.saveError')} onRetry={annotations.retry} />}

      <div className="gr-layout">
        {pdfError ? (
          <ErrorState error={pdfError} title={t('stage.pdfError')} />
        ) : (
          <PdfStage url={pdfUrl} annotations={annotations} readOnly={!editable || annotations.loading || annotations.loadFailed} aside={<SaveState state={annotations.saveState} />} />
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
                key={`${i.id}:${p.id}`}
                instanceId={i.id}
                problem={p}
                known={known}
                disabled={!editable}
                currentUserId={session?.id}
                onSaved={() => inst.reload()}
                onConflict={refreshGrades}
              />
            ))}
          </Panel>

          <AudioNotes instanceId={i.id} canEdit={editable} currentUserId={session?.id} />

          <Panel title={t('side.comment')}>
            <Field hint={t('side.commentHint')}>
              {(id) => (
                <Textarea
                  id={id}
                  aria-label={t('side.comment')}
                  value={annotations.comment}
                  onChange={(ev) => annotations.setComment(ev.target.value)}
                  disabled={!editable || annotations.loading || annotations.loadFailed}
                  placeholder={t('side.commentPlaceholder')}
                />
              )}
            </Field>
            {editable && !annotations.loading && !annotations.loadFailed && (
              <CommentOcr
                instanceId={i.id}
                onText={(text) => annotations.setComment(annotations.comment ? `${annotations.comment}\n${text}` : text)}
              />
            )}
          </Panel>

          {annotations.comments.length > 0 && <Panel title={t('annotations.otherComments')}>
            {annotations.comments.map((comment) => <div key={comment.id}>
              <strong>{comment.authorEmail || t('annotations.author')}</strong>
              <p className="gr-comment-text">{comment.text}</p>
            </div>)}
          </Panel>}

          {!editable && <Badge plain>{t('side.locked', { status: tc(`status.${i.status}`) })}</Badge>}
          {editable && <p className="u-muted">{t('annotations.ownLayer')}</p>}
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
