import { mockError, paginate, reply } from '../../lib/mock/router.js';
import { DEFAULT_PERMISSIONS, PERMISSION_KEYS } from '../../lib/permissions.js';
import { requireRecord, requireStaff } from '../admin/mocks.js';
import { subjectImportMocks } from './subject-import.mocks.js';

function permit(db, user, subject, permission) {
  requireRecord(db.subjects.find((s) => s.id === subject));
  if (!user?.is_active) throw mockError(403, 'PERMISSION_DENIED');
  if (user.is_staff || user.is_superadmin) return;
  const membership = db.memberships.find((m) => m.user_id === user.id && m.subject_id === subject && m.is_active);
  if (!membership || !(membership.permission_overrides?.[permission] ?? DEFAULT_PERMISSIONS[membership.role]?.[permission])) throw mockError(403, 'PERMISSION_DENIED');
}
const memberShape = (m, db) => {
  const u = requireRecord(db.users.find((u) => u.id === m.user_id));
  return { id: m.id, user_id: m.user_id, user_email: u.email, user_name: `${u.first_name} ${u.last_name}`, subject_id: m.subject_id, role: m.role, group_id: m.group_id, group_label: db.groups.find((g) => g.id === m.group_id)?.label ?? '', permission_overrides: m.permission_overrides ?? {}, is_active: m.is_active };
};
const groupShape = (g, db) => ({ id: g.id, label: g.label, subject_id: g.subject_id, member_count: db.memberships.filter((m) => m.is_active && m.group_id === g.id).length });
function effective(m, db) {
  const u = db.users.find((u) => u.id === m.user_id);
  const bypass = Boolean(u?.is_staff || u?.is_superadmin);
  return { permissions: bypass ? Object.fromEntries(PERMISSION_KEYS.map((key) => [key, true])) : { ...DEFAULT_PERMISSIONS[m.role], ...m.permission_overrides }, role: m.role, has_overrides: Boolean(Object.keys(m.permission_overrides ?? {}).length), is_staff_bypass: bypass };
}
const permissionTarget = (db, user, id, editing) => {
  if (!user?.is_active) throw mockError(403, 'PERMISSION_DENIED');
  const m = requireRecord(db.memberships.find((m) => m.id === id && m.is_active));
  if (editing || m.user_id !== user?.id) permit(db, user, m.subject_id, 'can_delegate_perms');
  return m;
};
const shape = (s, db) => ({
  id: s.id, name: s.name, code: s.code, semester: s.semester, course_id: s.course_id,
  coordinator_id: s.coordinator_id, coordinator_email: db.users.find((u) => u.id === s.coordinator_id)?.email ?? '',
  created_at: s.created_at ?? '2026-09-01T00:00:00Z', updated_at: s.updated_at ?? '2026-09-01T00:00:00Z',
});
function validate(body, db, user, subject) {
  const values = {};
  for (const [key, max] of [['name', 255], ['code', 50], ['semester', 100]]) {
    if (!Object.hasOwn(body, key) && (subject || key === 'semester')) continue;
    if (typeof body[key] !== 'string' || body[key].length > max || (!body[key].trim() && (key !== 'semester' || !subject))) {
      throw mockError(400, 'VALIDATION_ERROR', { [key]: ['INVALID'] });
    }
    values[key] = body[key].trim();
  }
  if (!subject || Object.hasOwn(body, 'coordinator_id')) {
    if (typeof body.coordinator_id !== 'string' || !body.coordinator_id.trim()) throw mockError(400, 'VALIDATION_ERROR', { coordinator_id: ['FIELD_REQUIRED'] });
    const coordinator = db.users.find((u) => u.id === body.coordinator_id && u.organization_id === user.organization_id);
    if (!coordinator) throw mockError(409, 'COORDINATOR_NOT_FOUND', subject ? undefined : { coordinator_id: ['COORDINATOR_NOT_FOUND'] });
    if (!subject && !coordinator.is_active) throw mockError(409, 'COORDINATOR_INACTIVE', { coordinator_id: ['COORDINATOR_INACTIVE'] });
    values.coordinator_id = coordinator.id;
  }
  return values;
}
function coordinatorMembership(db, subject) {
  let member = db.memberships.find((m) => m.subject_id === subject.id && m.user_id === subject.coordinator_id && m.is_active);
  if (!member) {
    member = { id: crypto.randomUUID(), subject_id: subject.id, user_id: subject.coordinator_id, group_id: null, is_active: true };
    db.memberships.push(member);
  }
  Object.assign(member, { role: 'COORDINATOR', permission_overrides: {} });
}
function target(db, user, id) {
  const s = requireRecord(db.subjects.find((s) => s.id === id));
  requireRecord(db.users.find((u) => u.id === s.coordinator_id && u.organization_id === user.organization_id));
  return s;
}
function active(db, s) {
  if (!db.courses.some((c) => c.id === s.course_id && c.is_active)) throw mockError(403, 'COURSE_ARCHIVED');
}
function unique(db, values, course, id, creating) {
  if (values.code && db.subjects.some((s) => s.id !== id && s.course_id === course && s.code === values.code)) throw mockError(409, 'CODE_ALREADY_EXISTS', creating ? { code: ['CODE_ALREADY_EXISTS'] } : undefined);
}
export const subjectCrudMocks = [
  { method: 'POST', path: '/subjects/', handler: ({ db, user, body }) => {
    requireStaff(user);
    const values = validate(body, db, user);
    const course = db.courses.find((c) => c.is_active && (!c.organization_id || c.organization_id === user.organization_id));
    if (!course) throw mockError(409, 'NO_ACTIVE_COURSE');
    unique(db, values, course.id, null, true);
    const now = new Date().toISOString();
    const s = { ...values, semester: values.semester ?? '', id: crypto.randomUUID(), course_id: course.id, created_at: now, updated_at: now };
    db.subjects.push(s); coordinatorMembership(db, s);
    return reply(201, shape(s, db));
  } },
  { method: 'PATCH', path: '/subjects/:subject/', handler: ({ db, user, params, body }) => {
    if (!user?.is_active) throw mockError(403, 'PERMISSION_DENIED');
    const s = target(db, user, params.subject);
    if (!(user.is_staff || user.is_superadmin || db.memberships.some((m) => m.subject_id === s.id && m.user_id === user.id && m.is_active && m.role === 'COORDINATOR'))) throw mockError(403, 'PERMISSION_DENIED');
    active(db, s);
    const values = validate(body, db, user, s);
    unique(db, values, s.course_id, s.id, false);
    if (values.coordinator_id && values.coordinator_id !== s.coordinator_id) {
      const old = db.memberships.find((m) => m.subject_id === s.id && m.user_id === s.coordinator_id && m.is_active && m.role === 'COORDINATOR');
      if (old) Object.assign(old, { role: 'TEACHER', permission_overrides: {} });
      s.coordinator_id = values.coordinator_id; coordinatorMembership(db, s);
    }
    Object.assign(s, values, { updated_at: new Date().toISOString() });
    return shape(s, db);
  } },
  { method: 'DELETE', path: '/subjects/:subject/', handler: ({ db, user, params }) => {
    requireStaff(user);
    const s = target(db, user, params.subject);
    active(db, s);
    if (db.exams.some((e) => e.subject_id === s.id)) throw mockError(409, 'HAS_EXAMS');
    db.subjects = db.subjects.filter((row) => row.id !== s.id);
    db.memberships = db.memberships.filter((m) => m.subject_id !== s.id);
    db.groups = db.groups.filter((g) => g.subject_id !== s.id);
    return reply(204);
  } },
];

export const mocks = [
  ...subjectCrudMocks,
  ...subjectImportMocks,
  { method: 'GET', path: '/subjects/export/', handler: ({ db, user, query }) => {
    requireStaff(user);
    return db.subjects.filter((s) => !query.get('course_id') || s.course_id === query.get('course_id')).map((s) => ({
      name: s.name, code: s.code, semester: s.semester,
      coordinator_email: db.users.find((u) => u.id === s.coordinator_id)?.email ?? '',
      groups: db.groups.filter((g) => g.subject_id === s.id).map((g) => g.label),
      teachers: db.memberships.filter((m) => m.subject_id === s.id && m.is_active && m.role === 'TEACHER').map((m) => db.users.find((u) => u.id === m.user_id)?.email),
      students: db.memberships.filter((m) => m.subject_id === s.id && m.is_active && m.role === 'STUDENT').map((m) => ({ email: db.users.find((u) => u.id === m.user_id)?.email, group: db.groups.find((g) => g.id === m.group_id)?.label ?? '' })),
    }));
  } },
  { method: 'GET', path: '/subjects/:subject/members/', handler: ({ db, user, params, query }) => {
    permit(db, user, params.subject, 'can_manage_members');
    return paginate(db.memberships.filter((m) => m.subject_id === params.subject && m.is_active).map((m) => memberShape(m, db)), query);
  } },
  { method: 'POST', path: '/subjects/:subject/members/', handler: ({ db, user, params, body }) => {
    permit(db, user, params.subject, 'can_manage_members');
    if (!['TEACHER', 'STUDENT'].includes(body.role)) throw mockError(400, 'VALIDATION_ERROR', { role: ['INVALID'] });
    const target = db.users.find((u) => u.id === body.user_id && u.organization_id === user.organization_id);
    if (!target) throw mockError(409, 'USER_NOT_FOUND');
    if (!target.is_active) throw mockError(409, 'USER_INACTIVE');
    if (body.group_id && !db.groups.some((g) => g.id === body.group_id && g.subject_id === params.subject)) throw mockError(409, 'GROUP_NOT_FOUND');
    const existing = db.memberships.find((m) => m.subject_id === params.subject && m.user_id === body.user_id && m.is_active);
    if (body.role === 'STUDENT' && body.group_id && existing?.group_id && existing.group_id !== body.group_id) throw mockError(409, 'STUDENT_ALREADY_IN_GROUP');
    if (existing) throw mockError(409, 'ALREADY_MEMBER');
    const m = { id: crypto.randomUUID(), subject_id: params.subject, user_id: body.user_id, role: body.role, group_id: body.group_id || null, permission_overrides: {}, is_active: true };
    db.memberships.push(m); return reply(201, memberShape(m, db));
  } },
  { method: 'DELETE', path: '/subjects/:subject/members/:member/', handler: ({ db, user, params }) => {
    permit(db, user, params.subject, 'can_manage_members');
    const m = requireRecord(db.memberships.find((m) => m.id === params.member && m.subject_id === params.subject && m.is_active));
    m.is_active = false; return reply(204);
  } },
  { method: 'GET', path: '/subjects/:subject/groups/', handler: ({ db, user, params, query }) => {
    permit(db, user, params.subject, 'can_manage_groups'); return paginate(db.groups.filter((g) => g.subject_id === params.subject).map((g) => groupShape(g, db)), query);
  } },
  { method: 'POST', path: '/subjects/:subject/groups/', handler: ({ db, user, params, body }) => {
    permit(db, user, params.subject, 'can_manage_groups');
    if (!body.label?.trim()) throw mockError(400, 'VALIDATION_ERROR', { label: ['FIELD_REQUIRED'] });
    if (body.label.trim().length > 50) throw mockError(400, 'VALIDATION_ERROR', { label: ['INVALID'] });
    if (db.groups.some((g) => g.subject_id === params.subject && g.label === body.label.trim())) throw mockError(409, 'GROUP_LABEL_EXISTS');
    const g = { id: crypto.randomUUID(), subject_id: params.subject, label: body.label.trim() }; db.groups.push(g); return reply(201, groupShape(g, db));
  } },
  { method: 'PATCH', path: '/subjects/:subject/groups/:group/', handler: ({ db, user, params, body }) => {
    permit(db, user, params.subject, 'can_manage_groups');
    const g = requireRecord(db.groups.find((g) => g.id === params.group && g.subject_id === params.subject));
    if (!body.label?.trim()) throw mockError(400, 'VALIDATION_ERROR', { label: ['FIELD_REQUIRED'] });
    if (body.label.trim().length > 50) throw mockError(400, 'VALIDATION_ERROR', { label: ['INVALID'] });
    if (db.groups.some((row) => row.id !== g.id && row.subject_id === params.subject && row.label === body.label.trim())) throw mockError(409, 'GROUP_LABEL_EXISTS');
    g.label = body.label.trim(); return groupShape(g, db);
  } },
  { method: 'DELETE', path: '/subjects/:subject/groups/:group/', handler: ({ db, user, params }) => {
    permit(db, user, params.subject, 'can_manage_groups');
    requireRecord(db.groups.find((g) => g.id === params.group && g.subject_id === params.subject));
    db.groups = db.groups.filter((g) => g.id !== params.group);
    db.memberships.filter((m) => m.group_id === params.group).forEach((m) => { m.group_id = null; });
    return reply(204);
  } },
  { method: 'GET', path: '/memberships/:member/permissions/', handler: ({ db, user, params }) => effective(permissionTarget(db, user, params.member, false), db) },
  { method: 'PATCH', path: '/memberships/:member/permissions/', handler: ({ db, user, params, body }) => {
    const m = permissionTarget(db, user, params.member, true);
    const overrides = body.permissions;
    if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides) || Object.entries(overrides).some(([k, v]) => !PERMISSION_KEYS.includes(k) || (v !== null && typeof v !== 'boolean'))) throw mockError(400, 'VALIDATION_ERROR', { permissions: ['INVALID'] });
    if (m.role === 'STUDENT') throw mockError(403, 'STUDENT_PERMS_FIXED');
    const grantor = db.memberships.find((row) => row.subject_id === m.subject_id && row.user_id === user.id && row.is_active);
    const allowed = user.is_staff || user.is_superadmin ? Object.fromEntries(PERMISSION_KEYS.map((key) => [key, true])) : effective(grantor, db).permissions;
    if (Object.entries(overrides).some(([key, value]) => value === true && !allowed[key])) throw mockError(403, 'DELEGATION_EXCEEDED');
    const merged = { ...m.permission_overrides };
    for (const [key, value] of Object.entries(overrides)) {
      if (value === null) delete merged[key]; else merged[key] = value;
    }
    m.permission_overrides = merged; return effective(m, db);
  } },
];
