import { mockError, paginate, reply } from '../../lib/mock/router.js';
import { importRowError, readImportFile } from './import-files.js';

export function requireStaff(user) {
  if (!user?.is_active || !(user.is_staff || user.is_superadmin)) throw mockError(403, 'PERMISSION_DENIED');
}
export function requireRecord(record) {
  if (!record) throw mockError(404, 'NOT_FOUND');
  return record;
}
export function validateEmail(email, db, id) {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw mockError(400, 'VALIDATION_ERROR', { email: ['INVALID_EMAIL'] });
  if (db.users.some((u) => u.id !== id && u.email.toLowerCase() === email.toLowerCase())) throw mockError(400, 'VALIDATION_ERROR', { email: ['EMAIL_ALREADY_EXISTS'] });
}
export const userShape = (u) => Object.fromEntries(['id', 'email', 'first_name', 'last_name', 'nia', 'is_active', 'is_staff', 'organization_id', 'email_notifications_enabled', 'created_at', 'updated_at'].map((k) => [k, u[k]]));
const now = () => new Date().toISOString();
const courseShape = (c, db) => ({ id: c.id, label: c.label, start_date: c.start_date, end_date: c.end_date, is_active: c.is_active, subject_count: db.subjects.filter((s) => s.course_id === c.id).length, created_at: c.created_at ?? '2026-09-01T00:00:00Z', updated_at: c.updated_at ?? '2026-09-01T00:00:00Z' });
const subjectDetail = (s, db) => ({
  id: s.id, name: s.name, code: s.code, semester: s.semester, course_id: s.course_id,
  coordinator_id: s.coordinator_id, coordinator_email: db.users.find((u) => u.id === s.coordinator_id)?.email ?? '',
  created_at: s.created_at ?? '2026-09-01T00:00:00Z', updated_at: s.updated_at ?? '2026-09-01T00:00:00Z',
  groups: db.groups.filter((g) => g.subject_id === s.id).map((g) => ({ id: g.id, label: g.label })),
  member_counts: Object.fromEntries(['COORDINATOR', 'TEACHER', 'STUDENT'].map((role, i) => [ ['coordinators', 'teachers', 'students'][i], db.memberships.filter((m) => m.subject_id === s.id && m.is_active && m.role === role).length ])),
});
function validateCourse(body) {
  if (!body.label?.trim()) throw mockError(400, 'VALIDATION_ERROR', { label: ['FIELD_REQUIRED'] });
  if (body.start_date && body.end_date && body.start_date > body.end_date) throw mockError(400, 'VALIDATION_ERROR', { end_date: ['INVALID'] });
}
const staff = (handler) => (ctx) => { requireStaff(ctx.user); return handler(ctx); };
async function importUsers({ db, form, user }) {
  const rows = await readImportFile(form);
  const result = { created: 0, reactivated: 0, updated: 0, total_processed: rows.length, total_errors: 0, errors: [] };
  rows.forEach((value, index) => {
    try {
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw mockError(400, 'VALIDATION_ERROR');
      for (const key of ['first_name', 'last_name', 'email']) if (typeof value[key] !== 'string' || !value[key].trim()) throw mockError(400, 'VALIDATION_ERROR', { [key]: ['FIELD_REQUIRED'] });
      for (const key of ['dni', 'nia']) if (value[key] !== undefined && typeof value[key] !== 'string') throw mockError(400, 'VALIDATION_ERROR', { [key]: ['INVALID'] });
      const email = value.email.trim();
      const existing = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
      if (existing && existing.organization_id !== user.organization_id) throw mockError(400, 'VALIDATION_ERROR', { email: ['EMAIL_ALREADY_EXISTS'] });
      validateEmail(email, db, existing?.id);
      const fields = { email, first_name: value.first_name.trim(), last_name: value.last_name.trim(), ...(value.dni !== undefined ? { dni: value.dni } : {}), ...(value.nia !== undefined ? { nia: value.nia } : {}), updated_at: now() };
      if (existing) {
        result[existing.is_active ? 'updated' : 'reactivated']++;
        Object.assign(existing, fields, { is_active: true });
      } else {
        db.users.push({ ...fields, id: crypto.randomUUID(), nia: fields.nia ?? '', dni: fields.dni ?? '', organization_id: user.organization_id, is_active: true, is_staff: false, email_notifications_enabled: true, created_at: now() });
        result.created++;
      }
    } catch (err) { result.errors.push(importRowError(index, err)); }
  });
  result.total_errors = result.errors.length;
  return result;
}
export const mocks = [
  { method: 'POST', path: '/users/import/', handler: staff(importUsers) },
  { method: 'GET', path: '/users/', handler: staff(({ db, query, user }) => {
    return paginate(db.users.filter((u) => u.organization_id === user.organization_id).map(userShape), query);
  }) },
  { method: 'GET', path: '/search/', handler: staff(({ db, query }) => {
    const search = (query.get('search') ?? '').toLowerCase();
    const course = query.get('course_id');
    const rows = course
      ? db.subjects.filter((s) => s.course_id === course && `${s.name} ${s.code}`.toLowerCase().includes(search)).map((s) => subjectDetail(s, db))
      : db.courses.filter((c) => c.label.toLowerCase().includes(search)).map((c) => courseShape(c, db));
    return paginate(rows, query);
  }) },
  { method: 'GET', path: '/users/export/', handler: staff(({ db, user }) => reply(200, new Blob([JSON.stringify(db.users.filter((u) => u.organization_id === user.organization_id).map((u) => ({ ...userShape(u), dni: u.dni ?? '' })))], { type: 'application/json' }))) },
  { method: 'POST', path: '/users/', handler: staff(({ body, db, user }) => {
    validateEmail(body.email, db);
    for (const key of ['first_name', 'last_name']) if (!body[key]?.trim()) throw mockError(400, 'VALIDATION_ERROR', { [key]: ['FIELD_REQUIRED'] });
    const row = { ...body, id: crypto.randomUUID(), organization_id: user.organization_id, is_staff: body.is_staff ?? false, is_active: true, nia: body.nia ?? '', dni: body.dni ?? '', email_notifications_enabled: true, created_at: now(), updated_at: now() };
    db.users.push(row); return reply(201, userShape(row));
  }) },
  { method: 'PATCH', path: '/users/:id/', handler: staff(({ body, params, db, user }) => {
    const row = requireRecord(db.users.find((u) => u.id === params.id && u.organization_id === user.organization_id));
    if (body.email !== undefined) validateEmail(body.email, db, row.id);
    Object.assign(row, body, { updated_at: now() }); return userShape(row);
  }) },
  { method: 'POST', path: '/users/:id/reset-password/', handler: staff(({ params, db, user }) => {
    requireRecord(db.users.find((u) => u.id === params.id && u.organization_id === user.organization_id));
    // The inventory declares no response schema. Consumers only inspect HTTP success.
    return reply(200);
  }) },
  { method: 'GET', path: '/courses/current/', handler: ({ db }) => courseShape(requireRecord(db.courses.find((c) => c.is_active)), db) },
  { method: 'GET', path: '/courses/:id/', handler: ({ db, params }) => courseShape(requireRecord(db.courses.find((c) => c.id === params.id)), db) },
  { method: 'POST', path: '/courses/', handler: staff(({ db, body }) => {
    validateCourse(body);
    const row = { ...body, id: crypto.randomUUID(), start_date: body.start_date ?? null, end_date: body.end_date ?? null, is_active: false, created_at: now(), updated_at: now() };
    db.courses.push(row); return reply(201, courseShape(row, db));
  }) },
  { method: 'PATCH', path: '/courses/:id/', handler: staff(({ db, body, params }) => {
    const row = requireRecord(db.courses.find((c) => c.id === params.id)); validateCourse({ ...row, ...body });
    Object.assign(row, body, { updated_at: now() }); return courseShape(row, db);
  }) },
  { method: 'GET', path: '/config/', handler: staff(({ db }) => db.org_config) },
  { method: 'PATCH', path: '/config/', handler: staff(({ db, body }) => { Object.assign(db.org_config, body); return db.org_config; }) },
  { method: 'GET', path: '/audit-logs/', handler: staff(({ db, query }) => {
    const rows = db.audit_logs.filter((row) => {
      for (const [param, field] of [['actor_id', 'actor'], ['entity_id', 'entity_id'], ['entity_type', 'entity_type'], ['event_type', 'event_type'], ['ip_address', 'ip_address']]) {
        if (query.get(param) && row[field] !== query.get(param)) return false;
      }
      return (!query.get('timestamp_from') || Date.parse(row.timestamp) >= Date.parse(query.get('timestamp_from')))
        && (!query.get('timestamp_to') || Date.parse(row.timestamp) <= Date.parse(query.get('timestamp_to')));
    });
    return paginate(rows, query);
  }) },
];
