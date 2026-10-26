/* Mock-side equivalents of the Django serializers used by the core flows.
 * Each function documents the backend serializer it mirrors. */
import { db, q } from '../../lib/mock/db.js';
import { DEFAULT_PERMISSIONS } from '../../lib/permissions.js';

const dec = (n) => (n === null || n === undefined ? null : Number(n).toFixed(2));

/** apps.subjects.services.permissions.has_subject_permission */
export function hasPerm(user, subjectId, key) {
  if (!user) return false;
  if (user.is_staff || user.is_superadmin) return true;
  const m = q.membership(user.id, subjectId);
  if (!m) return false;
  const base = DEFAULT_PERMISSIONS[m.role] ?? {};
  return Boolean({ ...base, ...(m.permission_overrides || {}) }[key]);
}

export const roleIn = (user, subjectId) => q.membership(user?.id, subjectId)?.role ?? null;

/** ProblemResponseSerializer */
export function problemOut(p) {
  return {
    id: p.id,
    name: p.name,
    max_score: dec(p.max_score),
    order: p.order,
    exam_model_id: p.exam_model_id,
    zone_ids: [],
    rubric_criteria: db.criteria
      .filter((c) => c.problem_id === p.id)
      .sort((a, b) => a.order - b.order)
      .map((c) => ({ id: c.id, description: c.description, score: dec(c.score), order: c.order })),
  };
}

/** ExamBasic / ExamTeacher / ExamFull serializers, chosen like ExamDetailView */
export function examOut(exam, user) {
  const subject = q.subject(exam.subject_id);
  const basic = {
    id: exam.id,
    name: exam.name,
    date: exam.date,
    subject_id: exam.subject_id,
    subject_name: subject?.name ?? '',
    subject_code: subject?.code ?? '',
  };
  const role = roleIn(user, exam.subject_id);
  const full = hasPerm(user, exam.subject_id, 'can_create_exams');
  if (!full && role !== 'TEACHER' && role !== 'COORDINATOR') return basic;
  const teacher = {
    ...basic,
    models_problems: db.models
      .filter((m) => m.exam_id === exam.id)
      .map((m) => ({
        model_id: m.id,
        label: m.label,
        problems: db.problems.filter((p) => p.exam_model_id === m.id).sort((a, b) => a.order - b.order).map(problemOut),
      })),
    convocation: db.convocations
      .filter((c) => c.exam_id === exam.id)
      .map((c) => {
        const u = q.user(c.student_id);
        return { id: u.id, email: u.email, first_name: u.first_name, last_name: u.last_name };
      }),
  };
  return full ? { ...teacher, student_permissions: exam.student_permissions } : teacher;
}

/** InstanceResponseSerializer */
/** apps.grading.services.grading.can_user_grade_instance: coordinator-like (view all), staff, or a matching assignment rule. */
export function canGradeInstance(user, inst, problemId) {
  const subjectId = q.exam(inst.exam_id).subject_id;
  if (hasPerm(user, subjectId, 'can_view_all_instances') && q.membership(user.id, subjectId)?.role === 'COORDINATOR') return true;
  if (user.is_staff) return true;
  return db.assignment_rules.some((r) => r.exam_id === inst.exam_id && r.correctors.includes(user.id) && (!problemId || r.problems.includes(problemId)));
}

/** InstanceResponseSerializer. `grades` lists the persisted grades of the problems `user` may grade (empty without a user). */
export function instanceOut(inst, user = null) {
  const student = inst.student_id ? q.user(inst.student_id) : null;
  const model = db.models.find((m) => m.id === inst.model_id);
  return {
    id: inst.id,
    exam_id: inst.exam_id,
    student_id: inst.student_id,
    student_email: student?.email ?? '',
    model_id: inst.model_id,
    model_label: model?.label ?? '',
    status: inst.status,
    has_issues: inst.has_issues,
    issue_types: inst.issue_types,
    total_score: dec(inst.total_score),
    expected_pages: inst.expected_pages,
    // Scanned pages live in db.pages (seeded by the ingestion feature).
    page_ids: (db.pages ?? []).filter((p) => p.instance_id === inst.id).sort((a, b) => a.page_number - b.page_number).map((p) => p.id),
    created_at: inst.created_at,
    updated_at: inst.updated_at,
    grades: user ? db.grades.filter((g) => g.instance_id === inst.id && canGradeInstance(user, inst, g.problem_id)).map(gradeOut) : [],
  };
}

const VISIBLE_TO_STUDENT = ['PUBLISHED', 'IN_REVIEW', 'PENDING_REVIEW', 'FINALIZED', 'ARCHIVED'];

/** apps.instances.services.access_control._student_access */
export function studentCan(inst, perm) {
  if (!perm) return VISIBLE_TO_STUDENT.includes(inst.status);
  const exam = q.exam(inst.exam_id);
  if (!exam.student_permissions?.[perm]) return false;
  const review = db.reviews.find((r) => r.exam_id === exam.id);
  if (!review) return false;
  if (review.status === 'OPEN' && inst.status === 'IN_REVIEW') return true;
  if (['CLOSED', 'COMPLETED'].includes(review.status)) return Boolean(exam.student_permissions.can_view_pages_after_review);
  return false;
}

/** StudentInstanceSerializer (conditional fields) */
export function studentInstanceOut(inst) {
  const exam = q.exam(inst.exam_id);
  const subject = q.subject(exam.subject_id);
  const out = {
    id: inst.id,
    exam_name: exam.name,
    subject_name: subject.name,
    status: inst.status,
    total_score: dec(inst.total_score),
  };
  if (studentCan(inst, 'can_view_pages')) {
    out.pages = Array.from({ length: inst.expected_pages }, (_, i) => ({
      id: `${inst.id}-pg${i + 1}`, instance_id: inst.id, page_number: i + 1, storage_ref: '', status: 'RECOGNIZED', issue_type: '', recognized_at: inst.created_at,
      created_at: inst.created_at, image_url: null, // PageResponseSerializer.get_image_url: null for the student
    }));
  }
  const problems = db.problems.filter((p) => p.exam_model_id === inst.model_id).sort((a, b) => a.order - b.order);
  if (studentCan(inst, 'can_view_rubric')) {
    out.rubric = problems.map((p) => ({
      problem_id: p.id, // gap-2, resolved in SCDEE-backend b6ce6ff
      problem_name: p.name,
      max_score: dec(p.max_score),
      criteria: db.criteria.filter((c) => c.problem_id === p.id).map((c) => ({ description: c.description, score: dec(c.score) })),
    }));
  }
  if (studentCan(inst, 'can_view_grade_breakdown')) {
    out.grades = db.grades
      .filter((g) => g.instance_id === inst.id)
      .map((g) => ({ problem_id: g.problem_id, problem_name: problems.find((p) => p.id === g.problem_id)?.name ?? '', score: dec(g.score), rubric_selections: g.rubric_selections }));
  }
  out.can_download = Boolean(exam.student_permissions?.can_download_pages);
  return out;
}

/** GradeResponseSerializer */
export function gradeOut(g) {
  const p = db.problems.find((x) => x.id === g.problem_id);
  return { problem_id: g.problem_id, problem_name: p?.name ?? '', score: dec(g.score), grader_email: q.user(g.grader_id)?.email ?? '', rubric_selections: g.rubric_selections };
}

/** apps.instances.services.instance_service.recalculate_total_score */
export function recalcTotal(inst) {
  const gs = db.grades.filter((g) => g.instance_id === inst.id);
  inst.total_score = gs.length ? Math.max(0, gs.reduce((a, g) => a + Number(g.score), 0)) : null;
  inst.updated_at = new Date().toISOString();
}

/** ReviewResponseSerializer */
export function reviewOut(r) {
  const instIds = db.instances.filter((i) => i.exam_id === r.exam_id).map((i) => i.id);
  return {
    id: r.id, exam_id: r.exam_id, start_date: r.start_date, end_date: r.end_date, status: r.status,
    request_count: db.review_requests.filter((rr) => instIds.includes(rr.instance_id)).length, created_at: r.created_at,
  };
}

/** ReviewRequestResponseSerializer */
export function reviewRequestOut(rr) {
  const p = db.problems.find((x) => x.id === rr.problem_id);
  return { ...rr, problem_name: p?.name ?? '' };
}
