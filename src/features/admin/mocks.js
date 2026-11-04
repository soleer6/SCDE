import { mockError, paginate, reply } from '../../lib/mock/router.js';
import { importRowError, readImportFile } from './import-files.js';
import { organizationMocks } from './organizations-mocks.js';
import { captureMembershipPermissions } from '../../lib/mock/membershipPermissions.js';

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
function filteredUsers(db, query, user) {
  for (const key of ['is_active', 'is_staff']) {
    if (query.get(key) && !['true', 'false'].includes(query.get(key).toLowerCase())) throw mockError(400, 'INVALID_FILTER', { [key]: ['Use true or false.'] });
  }
  const text = key => (query.get(key) || '').trim().toLowerCase();
  return db.users.filter(row => user.is_superadmin || row.organization_id === user.organization_id)
    .filter(row => !text('search') || ['first_name', 'last_name', 'email'].some(key => (row[key] || '').toLowerCase().includes(text('search'))))
    .filter(row => !text('email') || row.email.toLowerCase().includes(text('email')))
    .filter(row => !text('nia') || (row.nia || '').toLowerCase() === text('nia'))
    .filter(row => ['is_active', 'is_staff'].every(key => !text(key) || row[key] === (text(key) === 'true')))
    .sort((a, b) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name));
}
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
  ...organizationMocks,
  { method: 'POST', path: '/users/import/', handler: staff(importUsers) },
  { method: 'GET', path: '/users/', handler: staff(({ db, query, user }) => {
    return paginate(filteredUsers(db, query, user).map(userShape), query);
  }) },
  { method: 'GET', path: '/search/', handler: staff(({ db, query, user }) => {
    const search = (query.get('search') ?? '').toLowerCase();
    const course = query.get('course_id');
    const subject = query.get('subject_id');
    const exam = query.get('exam_id');
    const ownCourses = db.courses.filter(c => (c.organization_id ?? db.organizations[0].id) === user.organization_id);
    const ownSubjects = db.subjects.filter(s => ownCourses.some(c => c.id === s.course_id));
    const ownExams = db.exams.filter(e => ownSubjects.some(s => s.id === e.subject_id));
    let rows;
    if (exam) rows = db.instances.filter(i => i.exam_id === exam && ownExams.some(e => e.id === i.exam_id)).map(i => ({
      id: i.id, student_email: db.users.find(u => u.id === i.student_id)?.email ?? null,
      model_label: db.models.find(m => m.id === i.model_id)?.label ?? null,
      status: i.status, has_issues: i.has_issues, total_score: i.total_score == null ? null : String(i.total_score),
      created_at: i.created_at, updated_at: i.updated_at,
    })).filter(i => `${i.student_email ?? ''} ${i.model_label ?? ''}`.toLowerCase().includes(search))
      .filter(i => !query.get('status') || i.status === query.get('status'))
      .filter(i => !['true', 'false'].includes(query.get('has_issues')) || i.has_issues === (query.get('has_issues') === 'true'));
    else if (subject) rows = ownExams.filter(e => e.subject_id === subject && e.name.toLowerCase().includes(search)).map(e => ({
      id: e.id, name: e.name, date: e.date ?? null, subject_id: e.subject_id,
      subject_name: ownSubjects.find(s => s.id === e.subject_id).name, subject_code: ownSubjects.find(s => s.id === e.subject_id).code,
      model_count: db.models.filter(m => m.exam_id === e.id).length, instance_count: db.instances.filter(i => i.exam_id === e.id).length,
    }));
    else if (course) rows = ownSubjects.filter(s => s.course_id === course && `${s.name} ${s.code}`.toLowerCase().includes(search)).map(s => subjectDetail(s, db));
    else rows = ownCourses.filter(c => c.label.toLowerCase().includes(search)).map(c => courseShape(c, db));
    return paginate(rows, query);
  }) },
  { method: 'GET', path: '/users/export/', handler: staff(({ db, user, query }) => {
    const format = (query.get('export_format') || 'csv').toLowerCase();
    if (!['json', 'csv'].includes(format)) throw mockError(400, 'INVALID_FORMAT');
    const columns = ['first_name', 'last_name', 'email', 'dni', 'nia', 'is_active', 'is_staff'];
    const rows = filteredUsers(db, query, user).map(row => Object.fromEntries(columns.map(key => [key, row[key] ?? ''])));
    const csv = value => `"${String(value === true ? 'True' : value === false ? 'False' : value).replaceAll('"', '""')}"`;
    const body = format === 'json' ? JSON.stringify(rows) : [columns.join(','), ...rows.map(row => columns.map(key => csv(row[key])).join(','))].join('\r\n') + '\r\n';
    return reply(200, new Blob([body], { type: format === 'json' ? 'application/json' : 'text/csv' }));
  }) },
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
    if (!row.is_active) throw mockError(409, 'COURSE_ARCHIVED');
    Object.assign(row, body, { updated_at: now() }); return courseShape(row, db);
  }) },
  { method: 'GET', path: '/config/', handler: staff(({ db }) => db.org_config) },
  { method: 'PATCH', path: '/config/', handler: staff(({ db, body }) => {
    db.memberships.forEach((membership) => captureMembershipPermissions(db, membership));
    Object.assign(db.org_config, body); return db.org_config;
  }) },
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
