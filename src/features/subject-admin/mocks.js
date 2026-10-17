import { mockError, paginate, reply } from '../../lib/mock/router.js';
import { DEFAULT_PERMISSIONS, PERMISSION_KEYS } from '../../lib/permissions.js';
import { requireRecord, requireStaff } from '../admin/mocks.js';

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
export const mocks = [
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
    const target = db.users.find((u) => u.id === body.user_id && u.organization_id === user.organization_id && u.is_active);
    if (!target) throw mockError(400, 'VALIDATION_ERROR', { user_id: ['INVALID'] });
    if (!Object.hasOwn(DEFAULT_PERMISSIONS, body.role)) throw mockError(400, 'VALIDATION_ERROR', { role: ['INVALID'] });
    if (body.group_id && !db.groups.some((g) => g.id === body.group_id && g.subject_id === params.subject)) throw mockError(400, 'VALIDATION_ERROR', { group_id: ['INVALID'] });
    if (db.memberships.some((m) => m.subject_id === params.subject && m.user_id === body.user_id && m.is_active)) throw mockError(409, 'CONFLICT');
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
    const g = { id: crypto.randomUUID(), subject_id: params.subject, label: body.label.trim() }; db.groups.push(g); return reply(201, groupShape(g, db));
  } },
  { method: 'PATCH', path: '/subjects/:subject/groups/:group/', handler: ({ db, user, params, body }) => {
    permit(db, user, params.subject, 'can_manage_groups');
    const g = requireRecord(db.groups.find((g) => g.id === params.group && g.subject_id === params.subject));
    if (!body.label?.trim()) throw mockError(400, 'VALIDATION_ERROR', { label: ['FIELD_REQUIRED'] });
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
    if (!overrides || Array.isArray(overrides) || Object.entries(overrides).some(([k, v]) => !PERMISSION_KEYS.includes(k) || typeof v !== 'boolean')) throw mockError(400, 'VALIDATION_ERROR', { permissions: ['INVALID'] });
    m.permission_overrides = overrides; return effective(m, db);
  } },
];
