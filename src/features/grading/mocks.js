import { db, q } from '../../lib/mock/db.js';
import { mockError, reply } from '../../lib/mock/router.js';
import { encryptPdf } from './pdfCrypto.js';
import { authorizeAnnotationRead } from './annotationAccess.js';
import { validatedInk } from './ocrPayload.mock.js';
import { canGradeInstance as canGrade, gradeOut, hasPerm, instanceOut, recalcTotal, studentCan, studentInstanceOut } from '../exams/mockSerializers.js';

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
/* jsdom's Blob has no arrayBuffer(); FileReader exists in both jsdom and browsers. */
const blobBytes = (blob) =>
  typeof blob.arrayBuffer === 'function'
    ? blob.arrayBuffer()
    : new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result);
        fr.onerror = () => reject(fr.error);
        fr.readAsArrayBuffer(blob);
      });
const isOwner = (inst, user) => inst.student_id && inst.student_id === user.id;

function canSee(user, inst) {
  if (user.is_staff || user.is_superadmin) return true;
  if (isOwner(inst, user)) return studentCan(inst, null);
  return hasPerm(user, subjectOf(inst), 'can_view_all_instances') || canGrade(user, inst);
}

/* Annotation payloads are stored "in MinIO"; the mock keeps them inline and
 * hands out data: URLs as the presigned download_url. */
const annotationOut = (a) => ({
  id: a.id, instance_id: a.instance_id, annotation_type: a.annotation_type, storage_ref: `annotations/${a.id}`,
  download_url: a.annotation_type === 'AUDIO' ? (a.audio && URL.createObjectURL ? URL.createObjectURL(a.audio) : 'data:audio/webm;base64,') : `data:text/plain;charset=utf-8,${encodeURIComponent(a.content ?? '')}`,
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

/* Handwriting recognition (apps.annotations.services: ocr_grade_annotation, ocr_stylus_annotation).
 * There is no OCR engine in the browser, so the mock simulates a deterministic
 * reading from the pad strokes ([[{x,y}]] in 0-100, see ocr.js): the grade is
 * the number of strokes, confident (0.92) up to 3 strokes and doubtful (0.55)
 * beyond. Auto-apply above 0.8 mirrors GRADE_OCR_CONFIDENCE_THRESHOLD. */
const OCR_THRESHOLD = 0.8;
const ocrEngine = () => {
  if (!['tesseract', 'easyocr'].includes(db.org_config.default_ocr_engine)) throw mockError(503, 'OCR_UNAVAILABLE');
};
function ocrGrade(a) {
  if (!a.problem_id) throw mockError(400, 'NO_PROBLEM_ASSOCIATED');
  if (!a.content) throw mockError(400, 'NO_CONTENT');
  if (!['STYLUS', 'TEXT'].includes(a.annotation_type)) throw mockError(400, 'UNSUPPORTED_TYPE');
  const n = a.annotation_type === 'STYLUS' ? validatedInk(a.content).length : null;
  if (n !== null) ocrEngine();
  const value = n === null ? a.content.trim().replace(',', '.') : String(n);
  const score = /^[-+]?(?:\d*\.\d+|\d+)$/.test(value) ? Number(value) : null;
  const out = { recognized_value: score === null ? null : value, confidence: n === null ? 1 : (n <= 3 ? 0.92 : 0.55), auto_applied: false, raw_value: value, apply_error_code: null };
  if (score === null) out.apply_error_code = 'NO_RECOGNIZED_VALUE';
  else if (score < 0) out.apply_error_code = 'INVALID_SCORE';
  else if (out.confidence < OCR_THRESHOLD) out.apply_error_code = 'LOW_CONFIDENCE';
  if (!out.apply_error_code) {
    const inst = q.instance(a.instance_id);
    const problem = db.problems.find((p) => p.id === a.problem_id);
    const current = db.grades.find((g) => g.instance_id === inst.id && g.problem_id === problem.id);
    try {
      applyGrade({ inst, problem, score, oldScore: current?.score ?? null, user: q.user(a.author_id) });
      out.auto_applied = true;
    } catch (e) {
      out.apply_error_code = e.__mock?.body?.error_code ?? 'VERSION_CONFLICT';
    }
  }
  return out;
}
const ocrAuthorized = (a, user, grade = false) => {
  const inst = q.instance(a.instance_id);
  const subject = q.subject(subjectOf(inst));
  const course = db.courses.find((c) => c.id === subject.course_id);
  if ((inst.organization_id ?? subject.organization_id ?? course?.organization_id ?? db.organizations[0]?.id) !== user.organization_id) throw mockError(404, 'NOT_FOUND');
  if (grade && course?.is_active === false) throw mockError(403, 'COURSE_ARCHIVED');
  if (!user.is_staff && a.author_id !== user.id) throw mockError(403, 'NOT_AUTHOR');
};

export const mocks = [
  {
    method: 'GET',
    path: '/instances/:id/',
    handler: ({ params, user }) => {
      const inst = instOr404(params.id);
      if (!canSee(user, inst)) throw mockError(403, 'PERMISSION_DENIED');
      if (isOwner(inst, user) && !user.is_staff && !user.is_superadmin) return studentInstanceOut(inst);
      return instanceOut(inst, user);
    },
  },
  {
    method: 'GET',
    path: '/instances/:id/download/',
    handler: async ({ params, user }) => {
      const inst = instOr404(params.id);
      if (isOwner(inst, user) ? !studentCan(inst, 'can_view_pages') : !canSee(user, inst)) throw mockError(403, 'PERMISSION_DENIED');
      const pdf = await (await fetch(inst.pdf)).blob();
      // InstanceDownloadView: the owner without can_download_pages gets it encrypted.
      if (isOwner(inst, user) && !q.exam(inst.exam_id).student_permissions?.can_download_pages) {
        return reply(200, new Blob([await encryptPdf(await blobBytes(pdf), user.id)]), { 'Content-Type': 'application/octet-stream' });
      }
      return reply(200, pdf, { 'Content-Type': 'application/pdf' });
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
      return instanceOut(inst, user);
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
      if (body?.score == null || String(body.score).trim() === '' || !Number.isFinite(score)) throw mockError(400, 'VALIDATION_ERROR', { score: ['INVALID'] });
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
      const rubric = crit.map((c) => c.id); // Grade.rubric_selections: JSON list of criterion ids
      return gradeOut(applyGrade({ inst, problem, score, oldScore: body?.old_score ?? null, user, rubric }));
    },
  },
  {
    method: 'GET',
    path: '/instances/:id/annotations/',
    handler: ({ params, user, query = new URLSearchParams() }) => {
      const inst = instOr404(params.id);
      authorizeAnnotationRead(inst, user);
      return db.annotations.filter((a) => a.instance_id === inst.id
        && ['page_number', 'problem_id', 'annotation_type', 'author_id'].every((key) => !query.get(key) || String(a[key]) === query.get(key)))
        .sort((a, b) => a.page_number - b.page_number || a.y - b.y || a.x - b.x).map(annotationOut);
    },
  },
  {
    method: 'POST',
    path: '/instances/:id/annotations/',
    handler: ({ params, user, body }) => {
      const inst = instOr404(params.id);
      if (!canGrade(user, inst)) throw mockError(403, 'PERMISSION_DENIED');
      if (!['TEXT', 'STYLUS', 'AUDIO'].includes(body?.annotation_type)) throw mockError(400, 'VALIDATION_ERROR', { annotation_type: ['INVALID'] });
      if (body.annotation_type === 'AUDIO') {
        if (!body.file || typeof body.file === 'string') throw mockError(400, 'NO_AUDIO_DATA');
        if (body.file.size > 5 * 1024 * 1024) throw mockError(400, 'AUDIO_DURATION_EXCEEDED');
      } else if (!body.payload) throw mockError(400, 'VALIDATION_ERROR', { payload: ['FIELD_REQUIRED'] });
      if (body.problem_id && !db.problems.some((p) => p.id === body.problem_id && p.exam_model_id === inst.model_id)) throw mockError(400, 'PROBLEM_NOT_IN_MODEL');
      if (body.is_grade_annotation && !body.problem_id) throw mockError(400, 'GRADE_ANNOTATION_REQUIRES_PROBLEM');
      const now = new Date().toISOString();
      const a = {
        id: db.uid('an'), instance_id: inst.id, annotation_type: body.annotation_type, content: body.payload ?? '', audio: body.file,
        page_number: Number(body.page_number ?? 1), x: Number(body.x ?? 0), y: Number(body.y ?? 0), problem_id: body.problem_id ?? null,
        author_id: user.id, is_grade_annotation: Boolean(body.is_grade_annotation), created_at: now, updated_at: now,
      };
      db.annotations.push(a);
      if (a.is_grade_annotation) {
        try { ocrGrade(a); } catch { /* automatic failure does not roll back creation */ }
      }
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
  {
    method: 'POST',
    path: '/annotations/:id/ocr-grade/',
    handler: ({ params, user }) => {
      const a = db.annotations.find((x) => x.id === params.id);
      if (!a) throw mockError(404, 'NOT_FOUND');
      ocrAuthorized(a, user, true);
      return ocrGrade(a);
    },
  },
  {
    method: 'POST',
    path: '/annotations/:id/ocr/',
    handler: ({ params, user }) => {
      const a = db.annotations.find((x) => x.id === params.id);
      if (!a) throw mockError(404, 'NOT_FOUND');
      ocrAuthorized(a, user);
      if (a.annotation_type !== 'STYLUS') throw mockError(400, 'NOT_STYLUS');
      if (!a.content) throw mockError(400, 'NO_CONTENT');
      const n = validatedInk(a.content).length;
      ocrEngine();
      return { recognized_text: n ? `Texto manuscrito simulado (${n} trazos)` : null, confidence: n ? 0.7 : 0 };
    },
  },
];
