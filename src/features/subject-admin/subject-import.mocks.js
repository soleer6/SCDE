import { mockError } from '../../lib/mock/router.js';
import { requireStaff } from '../admin/mocks.js';
import { importRowError, readImportFile } from '../admin/import-files.js';
import { captureMembershipPermissions } from '../../lib/mock/membershipPermissions.js';

function validateSubject(value, db, user) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw mockError(400, 'VALIDATION_ERROR');
  for (const key of ['name', 'code', 'coordinator_email']) if (typeof value[key] !== 'string' || !value[key].trim()) throw mockError(400, 'VALIDATION_ERROR', { [key]: ['FIELD_REQUIRED'] });
  if (value.semester !== undefined && typeof value.semester !== 'string') throw mockError(400, 'VALIDATION_ERROR', { semester: ['INVALID'] });
  const findUser = (email) => {
    const found = typeof email === 'string' && db.users.find((u) => u.email.toLowerCase() === email.toLowerCase() && u.is_active && u.organization_id === user.organization_id);
    if (!found) throw mockError(400, 'VALIDATION_ERROR', { email: ['INVALID'] });
    return found;
  };
  const groups = value.groups === undefined || value.groups === '' ? [] : value.groups;
  const teachers = value.teachers === undefined || value.teachers === '' ? [] : value.teachers;
  const students = value.students === undefined || value.students === '' ? [] : value.students;
  if (!Array.isArray(groups) || groups.some((g) => typeof g !== 'string' || !g.trim()) || new Set(groups).size !== groups.length) throw mockError(400, 'VALIDATION_ERROR', { groups: ['INVALID'] });
  if (!Array.isArray(teachers) || !Array.isArray(students)) throw mockError(400, 'VALIDATION_ERROR');
  const coordinator = findUser(value.coordinator_email);
  const teaching = teachers.map(findUser);
  const enrolled = students.map((student) => {
    if (!student || typeof student !== 'object' || Array.isArray(student) || Object.values(student).some((v) => typeof v !== 'string') || (student.group && !groups.includes(student.group))) throw mockError(400, 'VALIDATION_ERROR', { students: ['INVALID'] });
    return { user: findUser(student.email), group: student.group };
  });
  const ids = [coordinator.id, ...teaching.map((u) => u.id), ...enrolled.map(({ user }) => user.id)];
  if (new Set(ids).size !== ids.length) throw mockError(400, 'VALIDATION_ERROR');
  return { groups, coordinator, teaching, enrolled };
}

export const subjectImportMocks = [{
  method: 'POST', path: '/subjects/import/', handler: async ({ db, user, form }) => {
    requireStaff(user);
    const rows = await readImportFile(form);
    const course = db.courses.find((c) => c.is_active);
    if (!course) throw mockError(404, 'NOT_FOUND');
    const result = { created: 0, total_errors: 0, errors: [] };
    rows.forEach((value, index) => {
      try {
        // Validate the complete row before adding any of its related records.
        const { groups, coordinator, teaching, enrolled } = validateSubject(value, db, user);
        const timestamp = new Date().toISOString();
        let subject = db.subjects.find((s) => s.course_id === course.id && s.code === value.code.trim());
        if (!subject) {
          subject = { id: crypto.randomUUID(), course_id: course.id, code: value.code.trim(), created_at: timestamp };
          db.subjects.push(subject);
        }
        Object.assign(subject, { name: value.name.trim(), semester: value.semester ?? '', coordinator_id: coordinator.id, updated_at: timestamp });
        const subjectGroups = groups.map((label) => {
          let group = db.groups.find((g) => g.subject_id === subject.id && g.label === label);
          if (!group) { group = { id: crypto.randomUUID(), subject_id: subject.id, label }; db.groups.push(group); }
          return group;
        });
        const membership = (member, role, group) => {
          let row = db.memberships.find((m) => m.subject_id === subject.id && m.user_id === member.id && m.role === role);
          const groupId = subjectGroups.find((g) => g.label === group)?.id ?? null;
          if (!row) {
            row = { id: crypto.randomUUID(), subject_id: subject.id, user_id: member.id, role, group_id: groupId, is_active: true, permission_overrides: {} };
            captureMembershipPermissions(db, row);
            db.memberships.push(row);
          } else {
            captureMembershipPermissions(db, row);
            if (role === 'COORDINATOR') row.is_active = true;
            if (role === 'STUDENT' && groupId) row.group_id = groupId;
          }
        };
        membership(coordinator, 'COORDINATOR');
        teaching.forEach((u) => membership(u, 'TEACHER'));
        enrolled.forEach(({ user: student, group }) => membership(student, 'STUDENT', group));
        result.created++;
      } catch (err) { result.errors.push(importRowError(index, err)); }
    });
    result.total_errors = result.errors.length;
    return result;
  },
}];
