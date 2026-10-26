import { db, q } from '../../lib/mock/db.js';
import { mockError } from '../../lib/mock/router.js';
import { examOut, hasPerm } from '../exams/mockSerializers.js';

/* Mirrors MySubjectsView, SubjectDetailView, MyTasksView (apps.subjects / apps.instances). */
export const mocks = [
  {
    method: 'GET',
    path: '/my-subjects/',
    handler: ({ user }) => {
      const course = q.activeCourse();
      if (!course) return [];
      return db.memberships
        .filter((m) => m.user_id === user.id && m.is_active)
        .map((m) => ({ m, s: q.subject(m.subject_id) }))
        .filter(({ s }) => s?.course_id === course.id)
        .sort((a, b) => a.s.name.localeCompare(b.s.name))
        .map(({ m, s }) => ({
          id: s.id,
          name: s.name,
          code: s.code,
          semester: s.semester,
          role: m.role,
          group_label: db.groups.find((g) => g.id === m.group_id)?.label ?? '',
          coordinator_email: q.user(s.coordinator_id)?.email ?? '',
        }));
    },
  },
  {
    method: 'GET',
    path: '/subjects/:id/',
    handler: ({ params, user }) => {
      const s = q.subject(params.id);
      if (!s) throw mockError(404, 'NOT_FOUND');
      if (!user.is_staff && !q.membership(user.id, s.id)) throw mockError(403, 'PERMISSION_DENIED');
      const members = db.memberships.filter((m) => m.subject_id === s.id && m.is_active);
      return {
        id: s.id, name: s.name, code: s.code, semester: s.semester, course_id: s.course_id,
        coordinator_id: s.coordinator_id, coordinator_email: q.user(s.coordinator_id)?.email ?? '',
        created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z',
        groups: db.groups.filter((g) => g.subject_id === s.id).map((g) => ({ id: g.id, label: g.label })),
        member_counts: {
          COORDINATOR: members.filter((m) => m.role === 'COORDINATOR').length,
          TEACHER: members.filter((m) => m.role === 'TEACHER').length,
          STUDENT: members.filter((m) => m.role === 'STUDENT').length,
        },
      };
    },
  },
  {
    method: 'GET',
    path: '/subjects/:id/exams/',
    handler: ({ params, user }) => {
      if (!q.subject(params.id)) throw mockError(404, 'NOT_FOUND');
      if (!user.is_staff && !q.membership(user.id, params.id)) throw mockError(403, 'PERMISSION_DENIED');
      return db.exams
        .filter((e) => e.subject_id === params.id)
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((e) => examOut(e, user));
    },
  },
  {
    method: 'GET',
    path: '/my-exams/',
    handler: ({ user }) => {
      const subjectIds = db.memberships.filter((m) => m.user_id === user.id && m.is_active).map((m) => m.subject_id);
      return db.exams
        .filter((e) => subjectIds.includes(e.subject_id))
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((e) => examOut(e, user));
    },
  },
  {
    method: 'GET',
    path: '/my-tasks/',
    handler: ({ user, query }) => {
      const examFilter = query.get('exam_id');
      // get_corrector_tasks: instances in PENDING_GRADING/GRADED the user may grade via rules,
      // or every instance when the user can view all (coordinator-like).
      const tasks = [];
      db.instances
        .filter((i) => (!examFilter || i.exam_id === examFilter) && ['PENDING_GRADING', 'GRADED'].includes(i.status))
        .forEach((inst) => {
          const exam = q.exam(inst.exam_id);
          const rules = db.assignment_rules.filter((r) => r.exam_id === exam.id && r.correctors.includes(user.id));
          const viaRule = rules.length > 0;
          const isCoord = q.membership(user.id, exam.subject_id)?.role === 'COORDINATOR';
          if (!viaRule && !isCoord) return;
          const problems = db.problems.filter((p) => p.exam_model_id === inst.model_id);
          const assigned = viaRule ? problems.filter((p) => rules.some((r) => r.problems.includes(p.id))) : problems;
          const graded = db.grades.filter((g) => g.instance_id === inst.id).map((g) => g.problem_id);
          const ungraded = assigned.filter((p) => !graded.includes(p.id)).map((p) => p.id);
          // get_corrector_tasks: with exam_id every assigned instance is returned (graded included).
          if (!examFilter && !ungraded.length) return;
          tasks.push({
            instance_id: inst.id,
            exam_name: `${q.subject(exam.subject_id).code} · ${exam.name}`,
            student_email: q.user(inst.student_id)?.email ?? null,
            ungraded_problems: ungraded,
            problems_sent: (examFilter ? assigned : assigned.filter((p) => ungraded.includes(p.id))).map((p) => p.id),
            total_problems: assigned.length,
          });
        });
      const pending_reviews = db.review_requests
        .filter((rr) => !rr.resolved)
        .map((rr) => ({ rr, inst: q.instance(rr.instance_id) }))
        .filter(({ inst }) => inst && (!examFilter || inst.exam_id === examFilter) && hasPerm(user, q.exam(inst.exam_id).subject_id, 'can_manage_reviews'))
        .map(({ rr, inst }) => {
          const exam = q.exam(inst.exam_id);
          return {
            review_request_id: rr.id,
            instance_id: inst.id,
            exam_name: `${q.subject(exam.subject_id).code} · ${exam.name}`,
            student_email: q.user(inst.student_id)?.email ?? null,
            problem_name: db.problems.find((p) => p.id === rr.problem_id)?.name ?? '',
            problem_id: rr.problem_id,
            student_message: rr.student_message,
            resolver_message: rr.resolver_message,
            created_at: rr.created_at,
          };
        });
      return { grading_tasks: tasks, pending_reviews };
    },
  },
];
