import { db, q } from '../../lib/mock/db.js';
import { mockError, reply } from '../../lib/mock/router.js';
import { gradeOut, hasPerm, instanceOut, recalcTotal, studentCan, studentInstanceOut } from '../exams/mockSerializers.js';

/* Mirrors apps.instances.models.instances.VALID_TRANSITIONS */
const VALID = {
  ASSEMBLING: ['RECEIVED'], RECEIVED: ['QUEUED'], QUEUED: ['PENDING_GRADING'], PENDING_GRADING: ['GRADED'],
  GRADED: ['PUBLISHED', 'PENDING_GRADING'], PUBLISHED: ['IN_REVIEW', 'GRADED'], IN_REVIEW: ['FINALIZED', 'PENDING_REVIEW'],
  PENDING_REVIEW: ['GRADED'], FINALIZED: ['ARCHIVED', 'PENDING_REVIEW'], ARCHIVED: [],
};

const instOr404 = (id) => {
  const i = q.instance(id);
  if (!i) throw mockError(404, 'NOT_FOUND');
  return i;
};
const subjectOf = (inst) => q.exam(inst.exam_id).subject_id;
const isOwner = (inst, user) => inst.student_id && inst.student_id === user.id;

/** Teacher can grade: coordinator-like (view all) or matching assignment rule. */
function canGrade(user, inst, problemId) {
  if (hasPerm(user, subjectOf(inst), 'can_view_all_instances') && ['COORDINATOR'].includes(q.membership(user.id, subjectOf(inst))?.role)) return true;
  if (user.is_staff) return true;
  return db.assignment_rules.some((r) => r.exam_id === inst.exam_id && r.correctors.includes(user.id) && (!problemId || r.problems.includes(problemId)));
}

function canSee(user, inst) {
  if (user.is_staff || user.is_superadmin) return true;
  if (isOwner(inst, user)) return studentCan(inst, null);
  return hasPerm(user, subjectOf(inst), 'can_view_all_instances') || canGrade(user, inst);
}

/* Annotation payloads are stored "in MinIO"; the mock keeps them inline and
 * hands out data: URLs as the presigned download_url. */
const annotationOut = (a) => ({
  id: a.id, instance_id: a.instance_id, annotation_type: a.annotation_type, storage_ref: `annotations/${a.id}`,
  download_url: `data:text/plain;charset=utf-8,${encodeURIComponent(a.content ?? '')}`,
  page_number: a.page_number, x: a.x, y: a.y, problem_id: a.problem_id, author_id: a.author_id,
  author_email: q.user(a.author_id)?.email ?? '', is_grade_annotation: a.is_grade_annotation, created_at: a.created_at, updated_at: a.updated_at,
});

function applyGrade({ inst, problem, score, oldScore, user, rubric }) {
  if (score > problem.max_score) throw mockError(409, 'SCORE_EXCEEDS_MAX');
  const g = db.grades.find((x) => x.instance_id === inst.id && x.problem_id === problem.id);
  if (!g) {
    if (oldScore !== null && oldScore !== undefined) throw mockError(409, 'VERSION_CONFLICT');
    const ng = { id: db.uid('gr'), instance_id: inst.id, problem_id: problem.id, score, grader_id: user.id, rubric_selections: rubric ?? [] };
    db.grades.push(ng);
    recalcTotal(inst);
    return ng;
  }
  if (oldScore === null || oldScore === undefined || Number(g.score) !== Number(oldScore)) throw mockError(409, 'VERSION_CONFLICT');
  Object.assign(g, { score, grader_id: user.id, rubric_selections: rubric ?? [] });
  recalcTotal(inst);
  return g;
}

export const mocks = [
  {
    method: 'GET',
    path: '/instances/:id/',
    handler: ({ params, user }) => {
      const inst = instOr404(params.id);
      if (!canSee(user, inst)) throw mockError(403, 'PERMISSION_DENIED');
      if (user.is_staff || user.is_superadmin) return instanceOut(inst);
      return isOwner(inst, user) ? studentInstanceOut(inst) : instanceOut(inst);
    },
  },
  {
    method: 'GET',
    path: '/instances/:id/download/',
    handler: async ({ params, user }) => {
      const inst = instOr404(params.id);
      if (isOwner(inst, user) ? !studentCan(inst, 'can_view_pages') : !canSee(user, inst)) throw mockError(403, 'PERMISSION_DENIED');
      const res = await fetch(inst.pdf);
      return reply(200, await res.blob(), { 'Content-Type': 'application/pdf' });
    },
  },
  {
    method: 'PATCH',
    path: '/instances/:id/transition/',
    handler: ({ params, user, body }) => {
      const inst = instOr404(params.id);
      if (!canGrade(user, inst)) throw mockError(403, 'PERMISSION_DENIED');
      const target = body?.target_status;
      if (!VALID[inst.status]?.includes(target)) throw mockError(400, 'INVALID_TRANSITION');
      inst.status = target;
      inst.updated_at = new Date().toISOString();
      return instanceOut(inst);
    },
  },
  {
    method: 'PUT',
    path: '/instances/:id/problems/:pid/grade/',
    handler: ({ params, user, body }) => {
      const inst = instOr404(params.id);
      const problem = db.problems.find((p) => p.id === params.pid && p.exam_model_id === inst.model_id);
      if (!problem) throw mockError(404, 'NOT_FOUND');
      if (!canGrade(user, inst, problem.id)) throw mockError(403, 'PERMISSION_DENIED');
      const score = Number(body?.score);
      if (Number.isNaN(score) || score < 0) throw mockError(400, 'VALIDATION_ERROR', { score: ['INVALID'] });
      return gradeOut(applyGrade({ inst, problem, score, oldScore: body?.old_score ?? null, user }));
    },
  },
  {
    method: 'PUT',
    path: '/instances/:id/problems/:pid/rubric/',
    handler: ({ params, user, body }) => {
      const inst = instOr404(params.id);
      const problem = db.problems.find((p) => p.id === params.pid && p.exam_model_id === inst.model_id);
      if (!problem) throw mockError(404, 'NOT_FOUND');
      if (!canGrade(user, inst, problem.id)) throw mockError(403, 'PERMISSION_DENIED');
      const ids = body?.criterion_ids ?? [];
      const crit = db.criteria.filter((c) => c.problem_id === problem.id && ids.includes(c.id));
      if (crit.length !== ids.length) throw mockError(400, 'VALIDATION_ERROR', { criterion_ids: ['INVALID'] });
      const score = Math.min(crit.reduce((a, c) => a + c.score, 0), problem.max_score);
      const rubric = crit.map((c) => ({ criterion_id: c.id, description: c.description, score: c.score.toFixed(2) }));
      return gradeOut(applyGrade({ inst, problem, score, oldScore: body?.old_score ?? null, user, rubric }));
    },
  },
  {
    method: 'GET',
    path: '/instances/:id/annotations/',
    handler: ({ params, user }) => {
      const inst = instOr404(params.id);
      if (isOwner(inst, user) ? !studentCan(inst, 'can_view_annotations') : !canSee(user, inst)) throw mockError(403, 'PERMISSION_DENIED');
      return db.annotations.filter((a) => a.instance_id === inst.id).map(annotationOut);
    },
  },
  {
    method: 'POST',
    path: '/instances/:id/annotations/',
    handler: ({ params, user, body }) => {
      const inst = instOr404(params.id);
      if (!canGrade(user, inst)) throw mockError(403, 'PERMISSION_DENIED');
      if (!['TEXT', 'STYLUS', 'AUDIO'].includes(body?.annotation_type)) throw mockError(400, 'VALIDATION_ERROR', { annotation_type: ['INVALID'] });
      if (!body.payload) throw mockError(400, 'VALIDATION_ERROR', { payload: ['FIELD_REQUIRED'] });
      const now = new Date().toISOString();
      const a = {
        id: db.uid('an'), instance_id: inst.id, annotation_type: body.annotation_type, content: body.payload,
        page_number: Number(body.page_number ?? 1), x: Number(body.x ?? 0), y: Number(body.y ?? 0), problem_id: body.problem_id ?? null,
        author_id: user.id, is_grade_annotation: Boolean(body.is_grade_annotation), created_at: now, updated_at: now,
      };
      db.annotations.push(a);
      return reply(201, annotationOut(a));
    },
  },
  {
    method: 'PUT',
    path: '/annotations/:id/',
    handler: ({ params, user, body }) => {
      const a = db.annotations.find((x) => x.id === params.id);
      if (!a) throw mockError(404, 'NOT_FOUND');
      if (a.author_id !== user.id && !user.is_staff) throw mockError(403, 'PERMISSION_DENIED');
      if (body?.payload !== undefined) a.content = body.payload;
      ['page_number', 'x', 'y', 'problem_id'].forEach((k) => {
        if (body?.[k] !== undefined) a[k] = body[k];
      });
      a.updated_at = new Date().toISOString();
      return annotationOut(a);
    },
  },
  {
    method: 'DELETE',
    path: '/annotations/:id/',
    handler: ({ params, user }) => {
      const idx = db.annotations.findIndex((x) => x.id === params.id);
      if (idx < 0) throw mockError(404, 'NOT_FOUND');
      if (db.annotations[idx].author_id !== user.id && !user.is_staff) throw mockError(403, 'PERMISSION_DENIED');
      db.annotations.splice(idx, 1);
      return reply(204);
    },
  },
];
