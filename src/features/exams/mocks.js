import { db, q } from '../../lib/mock/db.js';
import { mockError, paginate, reply } from '../../lib/mock/router.js';
import { examOut, hasPerm, instanceOut, reviewOut, roleIn, studentCan, studentInstanceOut } from './mockSerializers.js';

const examOr404 = (id) => {
  const e = q.exam(id);
  if (!e) throw mockError(404, 'NOT_FOUND');
  return e;
};

/* Mirrors apps.exams.views.exams, apps.instances.views.instances (list, publish),
 * apps.reviews.views (exam review), export_grades. */
export const mocks = [
  {
    method: 'GET',
    path: '/exams/:id/',
    handler: ({ params, user }) => {
      const e = examOr404(params.id);
      if (!user.is_staff && !q.membership(user.id, e.subject_id)) throw mockError(403, 'PERMISSION_DENIED');
      return examOut(e, user);
    },
  },
  {
    method: 'GET',
    path: '/exams/:id/instances/',
    handler: ({ params, user, query }) => {
      const e = examOr404(params.id);
      let list;
      if (hasPerm(user, e.subject_id, 'can_view_all_instances')) {
        list = db.instances.filter((i) => i.exam_id === e.id);
      } else {
        const role = roleIn(user, e.subject_id);
        if (role === 'STUDENT') {
          const own = db.instances.find((i) => i.exam_id === e.id && i.student_id === user.id);
          if (!own || !studentCan(own, null)) return [];
          return [studentInstanceOut(own)];
        }
        if (role !== 'TEACHER' && role !== 'COORDINATOR') throw mockError(403, 'PERMISSION_DENIED');
        const rules = db.assignment_rules.filter((r) => r.exam_id === e.id && r.correctors.includes(user.id));
        list = rules.length ? db.instances.filter((i) => i.exam_id === e.id) : [];
      }
      const s = query.get('status');
      if (s) list = list.filter((i) => i.status === s);
      const hi = query.get('has_issues');
      if (hi) list = list.filter((i) => i.has_issues === (hi === 'true'));
      return paginate(list.map(instanceOut), query);
    },
  },
  {
    method: 'POST',
    path: '/exams/:id/publish/',
    handler: ({ params, user, db: d }) => {
      const e = examOr404(params.id);
      if (!hasPerm(user, e.subject_id, 'can_publish_grades')) throw mockError(403, 'PERMISSION_DENIED');
      const all = d.instances.filter((i) => i.exam_id === e.id);
      let published = 0;
      let skipped = 0;
      const errors = [];
      all.forEach((i) => {
        if (i.status === 'GRADED') {
          i.status = 'PUBLISHED';
          published++;
          if (i.student_id) {
            d.notifications.unshift({
              id: d.uid('n'), user_id: i.student_id, notification_type: 'GRADES_PUBLISHED', title: 'Notas publicadas',
              message: `Ya puedes consultar tu nota de ${q.subject(e.subject_id).name} · ${e.name}.`, status: 'UNREAD',
              metadata: { exam_id: e.id }, created_at: new Date().toISOString(),
            });
          }
        } else if (i.status === 'PUBLISHED') {
          skipped++;
          errors.push({ instance_id: i.id, reason: 'ALREADY_PUBLISHED' });
        } else {
          skipped++;
          errors.push({ instance_id: i.id, reason: 'NOT_GRADED' });
        }
      });
      return { published, skipped, total: all.length, errors };
    },
  },
  {
    method: 'GET',
    path: '/exams/:id/review/',
    handler: ({ params }) => {
      examOr404(params.id);
      const r = db.reviews.find((x) => x.exam_id === params.id);
      if (!r) throw mockError(404, 'NOT_FOUND');
      return reviewOut(r);
    },
  },
  {
    method: 'POST',
    path: '/exams/:id/review/',
    handler: ({ params, user, body, db: d }) => {
      const e = examOr404(params.id);
      if (!hasPerm(user, e.subject_id, 'can_manage_reviews')) throw mockError(403, 'PERMISSION_DENIED');
      if (d.reviews.some((r) => r.exam_id === e.id)) throw mockError(409, 'REVIEW_ALREADY_EXISTS');
      if (!body?.start_date || !body?.end_date) throw mockError(400, 'VALIDATION_ERROR', { start_date: ['FIELD_REQUIRED'] });
      if (new Date(body.start_date) >= new Date(body.end_date)) throw mockError(400, 'INVALID_DATES');
      const inst = d.instances.filter((i) => i.exam_id === e.id);
      if (inst.some((i) => !['PUBLISHED', 'ARCHIVED'].includes(i.status))) throw mockError(400, 'NOT_ALL_PUBLISHED');
      const r = { id: d.uid('rv'), exam_id: e.id, start_date: body.start_date, end_date: body.end_date, status: 'SCHEDULED', created_at: new Date().toISOString() };
      // Celery beat opens the window at start_date (open_review). The mock opens it immediately if already started.
      if (new Date(r.start_date) <= new Date()) {
        r.status = 'OPEN';
        inst.filter((i) => i.status === 'PUBLISHED').forEach((i) => {
          i.status = 'IN_REVIEW';
        });
      }
      d.reviews.push(r);
      return reply(201, reviewOut(r));
    },
  },
  {
    method: 'GET',
    path: '/exams/:id/coverage/',
    handler: ({ params, user }) => {
      const e = examOr404(params.id);
      if (!hasPerm(user, e.subject_id, 'can_assign_correctors')) throw mockError(403, 'PERMISSION_DENIED');
      const models = db.models.filter((m) => m.exam_id === e.id);
      const problems = db.problems.filter((p) => models.some((m) => m.id === p.exam_model_id));
      const rules = db.assignment_rules.filter((r) => r.exam_id === e.id);
      const covered = problems.filter((p) => rules.some((r) => r.problems.includes(p.id)));
      return {
        complete: covered.length === problems.length,
        total_problems: problems.length,
        covered_problems: covered.length,
        uncovered: problems.filter((p) => !covered.includes(p)).map((p) => ({ problem_id: p.id, problem_name: p.name, model: models.find((m) => m.id === p.exam_model_id)?.label ?? '' })),
        total_instances: db.instances.filter((i) => i.exam_id === e.id && i.status !== 'ARCHIVED').length,
        rules_count: rules.length,
      };
    },
  },
  {
    method: 'GET',
    path: '/exams/:id/export/',
    handler: ({ params, user, query }) => {
      const e = examOr404(params.id);
      if (!hasPerm(user, e.subject_id, 'can_export_grades')) throw mockError(403, 'PERMISSION_DENIED');
      const rows = db.instances
        .filter((i) => i.exam_id === e.id && i.student_id)
        .map((i) => {
          const u = q.user(i.student_id);
          return { nia: u.nia, email: u.email, total_score: i.total_score == null ? '' : Number(i.total_score).toFixed(2) };
        });
      if (query.get('format') === 'json') return rows;
      const csv = ['nia,email,total_score', ...rows.map((r) => `${r.nia},${r.email},${r.total_score}`)].join('\n');
      return reply(200, new Blob([csv], { type: 'text/csv' }), { 'Content-Type': 'text/csv' });
    },
  },
];
