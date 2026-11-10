import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApi, useAction } from '../../lib/hooks.js';
import { Badge, Button, Dialog, ErrorState, Field, Loader, PageHeader, Panel, Textarea, useToast } from '../../ui';
import { useAuth } from '../../lib/auth/AuthProvider.jsx';
import { getAllExamInstances, getExam } from '../exams/api.js';
import { getMyTasks, useMySubjects } from '../workspace/api.js';
import { LifecycleRail, Score, StatusBadge } from '../workspace/domain.jsx';
import { studentName } from '../workspace/model.js';
import { getInstance, listAnnotations, serverGrades, transitionInstance } from './api.js';
import { usePdfUrl } from './usePdfUrl.js';
import { useAnnotations } from './useAnnotations.js';
import { useKnownGrades } from './useKnownGrades.js';
import AudioNotes from './AudioNotes.jsx';
import PdfStage from './PdfStage.jsx';
import ProblemGrader from './ProblemGrader.jsx';
import { CommentOcr } from './HandwritingOcr.jsx';

/** Retrocesos del ciclo de vida (RF-7.5) que afectan al alumno: piden confirmación. */
const CONFIRMED_MOVES = { PUBLISHED: 'GRADED', IN_REVIEW: 'PENDING_REVIEW', FINALIZED: 'PENDING_REVIEW' };

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
  const siblings = useApi(examId ? () => getAllExamInstances(examId, { status: 'PENDING_GRADING' }) : null, [examId, instanceId]);
  const { url: pdfUrl, error: pdfError } = usePdfUrl(instanceId);
  const annotations = useAnnotations(instanceId, { readOnly: !EDITABLE.includes(inst.data?.status) });
  const server = useMemo(() => serverGrades(inst.data), [inst.data]);
  const known = useKnownGrades(instanceId, server);
  const [confirm, setConfirm] = useState(false);
  // Guardar: rows (scores, per-problem comments) register their pending-edit committers here.
  const savers = useRef(new Map());
  const register = useCallback((key, fn) => {
    if (fn) savers.current.set(key, fn);
    else savers.current.delete(key);
  }, []);
  const [saveRun, setSaveRun] = useState({ state: 'idle' }); // idle | saving | done | error
  const [activeProblem, setActiveProblem] = useState(null);
  const transition = useAction((target) => transitionInstance(instanceId, target));

  // GET /my-tasks/?exam_id= lists, per instance, the problems the rules assign to this corrector
  // (problems_sent). Staff and coordinators grade everything; a corrector sees only their own problems.
  const { session } = useAuth();
  const { roleOf } = useMySubjects();
  const subjectId = exam.data?.subject_id;
  const tasks = useApi(examId ? () => getMyTasks(examId) : null, [examId, instanceId]); // fresh per exam opened
  const sees = useMemo(() => {
    const mine = (tasks.data?.grading_tasks ?? []).filter((x) => x.instance_id === instanceId);
    if (session?.isStaff || session?.isSuperadmin || roleOf(subjectId) === 'COORDINATOR' || !mine.length) return null;
    return new Set(mine.flatMap((x) => x.problems_sent));
  }, [tasks.data, instanceId, session, roleOf, subjectId]);

  const allProblems = useMemo(() => {
    const model = exam.data?.models_problems?.find((m) => m.model_id === inst.data?.model_id) ?? exam.data?.models_problems?.[0];
    return model?.problems ?? [];
  }, [exam.data, inst.data]);
  const problems = useMemo(() => (sees ? allProblems.filter((p) => sees.has(p.id)) : allProblems), [allProblems, sees]);

  // Only the first load (or a new instance) shows the loader: reloading after each grade must not unmount the PDF and the problem rows.
  if (inst.error) return <ErrorState error={inst.error} onRetry={inst.reload} />;
  if (exam.error) return <ErrorState error={exam.error} onRetry={exam.reload} />;
  if (inst.initialLoading || exam.initialLoading || !inst.data || !exam.data) return <Loader page />;

  const i = inst.data;
  const e = exam.data;
  const editable = EDITABLE.includes(i.status);
  const gradedCount = problems.filter((p) => known.grades[p.id] !== undefined).length;
  const maxTotal = problems.reduce((a, p) => a + Number(p.max_score), 0);
  // Next exam: one where this teacher still has exercises to grade (from /my-tasks/). A corrector who
  // finished their own exercises is not sent to exams only waiting for someone else.
  const myTasks = tasks.data?.grading_tasks ?? [];
  const pending = new Set((siblings.data ?? []).map((s) => s.id));
  const nextTask = myTasks.find((x) => x.instance_id !== i.id && x.ungraded_problems.length && pending.has(x.instance_id));
  const next = nextTask ? { id: nextTask.instance_id }
    : tasks.data && !myTasks.length && !sees ? (siblings.data ?? []).find((s) => s.id !== i.id) : null;

  // After a 409 VERSION_CONFLICT: re-read the instance so old_score is the persisted one before any retry.
  const refreshGrades = async () => {
    const fresh = await getInstance(instanceId);
    inst.setData(fresh);
    return serverGrades(fresh);
  };

  const saveAll = async () => {
    setSaveRun({ state: 'saving' });
    try {
      const rows = await Promise.all([...savers.current.values()].map((fn) => fn()));
      const annotationsOk = await annotations.flush();
      if (rows.includes(false) || !annotationsOk) {
        setSaveRun({ state: 'error' });
        return;
      }
      // Confirm against the server, not the screen: re-read the instance and its annotations.
      const [fresh, list] = await Promise.all([getInstance(instanceId), listAnnotations(instanceId)]);
      inst.setData(fresh);
      const mine = list.filter((a) => !session?.id || a.author_id === session.id);
      const count = (type) => mine.filter((a) => a.annotation_type === type).length;
      const freshGrades = serverGrades(fresh) ?? known.grades;
      // Saving with every exercise of the exam graded (all of them, not only this corrector's) marks it as graded.
      let marked = false;
      if (['PENDING_GRADING', 'PENDING_REVIEW'].includes(fresh.status) && allProblems.length
          && allProblems.every((p) => freshGrades[p.id] !== undefined)) {
        try {
          await transitionInstance(instanceId, 'GRADED');
          inst.setData(await getInstance(instanceId));
          marked = true;
        } catch {
          marked = false; // the grades are saved anyway; the exam just stays pending
        }
      }
      setSaveRun({
        marked,
        state: 'done',
        at: new Date(),
        graded: problems.filter((p) => freshGrades[p.id] !== undefined).length,
        total: problems.length,
        notes: mine.filter((a) => a.annotation_type === 'TEXT' && a.problem_id).length,
        audios: count('AUDIO'),
        strokes: count('STYLUS'),
        general: mine.some((a) => a.annotation_type === 'TEXT' && !a.problem_id),
      });
    } catch {
      setSaveRun({ state: 'error' });
    }
  };

  const goToProblem = (pid) => {
    const row = document.getElementById(`gr-problem-${pid}`);
    if (!row) return;
    setActiveProblem(pid);
    row.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    row.querySelector('input:not([type=checkbox]):not([hidden]), input[type=checkbox], textarea')?.focus({ preventScroll: true });
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

        <aside className="gr-side" onInputCapture={() => setSaveRun((r) => (r.state === 'done' || r.state === 'error' ? { state: 'idle' } : r))}>
          <Panel title={t('side.total')}>
            <div className="gr-total">
              <Score value={i.total_score} max={maxTotal} size="md" />
              <span className="u-muted u-num" role="status">{t('side.progress', { done: gradedCount, total: problems.length })}</span>
            </div>
          </Panel>

          <Panel title={t('save.panelTitle')} className="gr-savepanel">
            <nav aria-label={t('nav.label')} className="gr-exnav">
              {problems.map((p) => {
                const done = known.grades[p.id] !== undefined;
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`gr-exnav__chip ${done ? 'is-done' : ''} ${activeProblem === p.id ? 'is-active' : ''}`}
                    aria-current={activeProblem === p.id ? 'true' : undefined}
                    onClick={() => goToProblem(p.id)}
                  >
                    <span className="u-num">{String(p.order).padStart(2, '0')}</span> {p.name}
                    <span className="gr-exnav__mark">{done ? t('nav.graded') : t('nav.pending')}</span>
                  </button>
                );
              })}
            </nav>
            {editable && (
              <Button
                variant="solid"
                block
                className="gr-save-btn"
                onClick={saveAll}
                loading={saveRun.state === 'saving'}
                disabled={annotations.loading || annotations.loadFailed}
              >
                {t('save.button')}
              </Button>
            )}
            <div className={`gr-saveresult is-${saveRun.state}`} role="status" aria-live="polite">
              {saveRun.state === 'idle' && editable && <p className="u-muted">{t(gradedCount === problems.length && problems.length ? 'save.readyHint' : 'save.hint', { done: gradedCount, total: problems.length })}</p>}
              {saveRun.state === 'done' && (
                <>
                  <strong>{t('save.doneTitle')}</strong>
                  <p>{t(saveRun.marked ? 'save.marked' : 'save.notMarked', { done: saveRun.graded, total: saveRun.total })}</p>
                  <ul>
                    <li>{t('save.doneGrades', { done: saveRun.graded, total: saveRun.total })}</li>
                    <li>{t('save.doneNotes', { count: saveRun.notes })}</li>
                    <li>{t(saveRun.general ? 'save.generalYes' : 'save.generalNo')}</li>
                    <li>{t('save.doneAudios', { count: saveRun.audios })}</li>
                    <li>{t('save.doneStrokes', { count: saveRun.strokes })}</li>
                  </ul>
                  <span className="u-muted">{t('save.doneAt', { time: saveRun.at.toLocaleTimeString() })}</span>
                  {next ? (
                    <Button block onClick={async () => { if (await annotations.flush()) navigate(`/instances/${next.id}/grade`); }}>{t('actions.next')}</Button>
                  ) : (
                    <span className="u-muted">{t('save.noMore')}</span>
                  )}
                </>
              )}
              {saveRun.state === 'error' && <strong role="alert">{t('save.failed')}</strong>}
            </div>
          </Panel>

          <Panel title={t('side.problems')} flush>
            {!problems.length && <p className="gr-empty u-muted">{t('side.noProblems')}</p>}
            {problems.map((p, idx) => (
              <div key={`${i.id}:${p.id}`} className="gr-problem-wrap" onFocusCapture={() => setActiveProblem(p.id)}>
                <ProblemGrader
                  instanceId={i.id}
                  problem={p}
                  known={known}
                  disabled={!editable}
                  currentUserId={session?.id}
                  onSaved={() => inst.reload()}
                  onConflict={refreshGrades}
                  register={register}
                  onNext={idx < problems.length - 1 ? () => goToProblem(problems[idx + 1].id) : undefined}
                />
              </div>
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
