import { db, q } from '../../lib/mock/db.js';
import { effectiveMembershipPermissions } from '../../lib/mock/membershipPermissions.js';
import { mockError } from '../../lib/mock/router.js';
import { studentCan } from '../exams/mockSerializers.js';

/** Mirrors can_read_instance_annotations, including assignment model/group filters.
 * Legacy demo subjects inherit the demo organization's tenant from their course. */
export function authorizeAnnotationRead(inst, user) {
  const subject = q.subject(q.exam(inst.exam_id).subject_id);
  const course = db.courses.find((c) => c.id === subject.course_id);
  const tenant = inst.organization_id ?? subject.organization_id ?? course?.organization_id ?? db.organizations[0]?.id;
  if (tenant !== user.organization_id) throw mockError(404, 'NOT_FOUND');
  if (user.is_staff || user.is_superadmin) return;
  const found = q.membership(user.id, subject.id);
  const member = found && (!found.organization_id || found.organization_id === tenant) ? found : null;
  let allowed = false;
  if (member && inst.student_id === user.id) {
    const review = db.reviews.find((r) => r.exam_id === inst.exam_id);
    allowed = studentCan(inst, null) && studentCan(inst, 'can_view_annotations');
    if (review?.status === 'OPEN') {
      allowed &&= Date.parse(review.start_date) <= Date.now() && Date.now() < Date.parse(review.end_date);
    }
  } else if (member && ['COORDINATOR', 'TEACHER'].includes(member.role)) {
    const viewAll = effectiveMembershipPermissions(db, member).can_view_all_instances;
    const studentGroup = q.membership(inst.student_id, subject.id)?.group_id;
    allowed = member.role === 'COORDINATOR' || viewAll || db.assignment_rules.some((r) =>
      r.exam_id === inst.exam_id && r.correctors.includes(user.id)
      && (!r.models_filter?.length || r.models_filter.includes(inst.model_id))
      && (!r.groups?.length || r.groups.includes(studentGroup)));
  }
  if (!allowed) throw mockError(403, 'PERMISSION_DENIED');
}
