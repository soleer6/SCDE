import { db, q } from '../../lib/mock/db.js';
import { mockError, reply } from '../../lib/mock/router.js';
import { hasPerm, reviewRequestOut } from '../exams/mockSerializers.js';

/* Mirrors apps.reviews.views + services.submit_review_requests / resolve_request */
export const mocks = [
  {
    method: 'GET',
    path: '/instances/:id/review-requests/',
    handler: ({ params, user }) => {
      const inst = q.instance(params.id);
      if (!inst) throw mockError(404, 'NOT_FOUND');
      const subjectId = q.exam(inst.exam_id).subject_id;
      const own = inst.student_id === user.id;
      if (!own && !hasPerm(user, subjectId, 'can_manage_reviews') && !hasPerm(user, subjectId, 'can_view_all_instances')) {
        throw mockError(403, 'PERMISSION_DENIED');
      }
      return db.review_requests.filter((r) => r.instance_id === inst.id).map(reviewRequestOut);
    },
  },
  {
    method: 'POST',
    path: '/instances/:id/review-requests/',
    handler: ({ params, user, body, db: d }) => {
      const inst = q.instance(params.id);
      if (!inst) throw mockError(404, 'NOT_FOUND');
      const review = d.reviews.find((r) => r.exam_id === inst.exam_id);
      if (!review || review.status !== 'OPEN') throw mockError(409, 'REVIEW_NOT_OPEN');
      if (inst.student_id !== user.id) throw mockError(409, 'NOT_INSTANCE_OWNER');
      if (inst.status !== 'IN_REVIEW') throw mockError(409, 'INSTANCE_NOT_IN_REVIEW');
      const created = [];
      (body?.problems ?? []).forEach((item) => {
        const p = d.problems.find((x) => x.id === item.problem_id && x.exam_model_id === inst.model_id);
        if (!p) return; // backend skips invalid problems
        // get_or_create: an existing request is kept and left out of the answer
        if (d.review_requests.some((r) => r.instance_id === inst.id && r.problem_id === p.id)) return;
        const rr = { id: d.uid('rr'), instance_id: inst.id, problem_id: p.id, student_message: item.message ?? '', resolved: false, resolved_at: null, resolver_message: '', created_at: new Date().toISOString() };
        d.review_requests.push(rr);
        created.push(reviewRequestOut(rr));
      });
      return reply(201, created);
    },
  },
  {
    method: 'PATCH',
    path: '/review-requests/:id/resolve/',
    handler: ({ params, user, body, db: d }) => {
      const rr = d.review_requests.find((r) => r.id === params.id);
      if (!rr) throw mockError(404, 'NOT_FOUND');
      const inst = q.instance(rr.instance_id);
      const subjectId = q.exam(inst.exam_id).subject_id;
      const isCorrector = d.assignment_rules.some((r) => r.exam_id === inst.exam_id && r.correctors.includes(user.id) && r.problems.includes(rr.problem_id));
      if (!isCorrector && !hasPerm(user, subjectId, 'can_manage_reviews')) throw mockError(403, 'PERMISSION_DENIED');
      if (rr.resolved) throw mockError(409, 'ALREADY_RESOLVED');
      Object.assign(rr, { resolved: true, resolved_at: new Date().toISOString(), resolver_message: body?.resolver_message ?? '' });
      const pending = d.review_requests.some((r) => r.instance_id === inst.id && !r.resolved);
      if (!pending && inst.status === 'IN_REVIEW') inst.status = 'FINALIZED';
      if (inst.student_id) {
        d.notifications.unshift({
          id: d.uid('n'), user_id: inst.student_id, notification_type: 'REVIEW_RESULT', title: 'Revisión resuelta',
          message: `Se ha resuelto tu solicitud de revisión de ${q.exam(inst.exam_id).name}.`, status: 'UNREAD',
          metadata: { exam_id: inst.exam_id, instance_id: inst.id }, created_at: new Date().toISOString(),
        });
      }
      return reviewRequestOut(rr);
    },
  },
];
