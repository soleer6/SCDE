import { mockError, paginate, reply } from '../../lib/mock/router.js';

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
function validateCourse(body) {
  if (!body.label?.trim()) throw mockError(400, 'VALIDATION_ERROR', { label: ['FIELD_REQUIRED'] });
  if (body.start_date && body.end_date && body.start_date > body.end_date) throw mockError(400, 'VALIDATION_ERROR', { end_date: ['INVALID'] });
}
const staff = (handler) => (ctx) => { requireStaff(ctx.user); return handler(ctx); };
export const mocks = [
  { method: 'GET', path: '/users/', handler: staff(({ db, query, user }) => {
    const search = (query.get('search') ?? '').toLowerCase();
    return paginate(db.users.filter((u) => u.organization_id === user.organization_id && `${u.email} ${u.first_name} ${u.last_name} ${u.nia}`.toLowerCase().includes(search)).map(userShape), query);
  }) },
  { method: 'GET', path: '/users/export/', handler: staff(({ db, user }) => reply(200, new Blob([JSON.stringify(db.users.filter((u) => u.organization_id === user.organization_id).map(userShape))], { type: 'application/json' }))) },
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
  { method: 'GET', path: '/audit-logs/', handler: staff(({ db, query }) => paginate(db.audit_logs, query)) },
];
