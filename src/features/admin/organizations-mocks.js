import { extendSeed } from '../../lib/mock/db.js';
import { mockError, reply } from '../../lib/mock/router.js';

// Separate tenant keeps the platform account out of the university's directory.
extendSeed(db => {
  if (!db.organizations.some(o => o.id === 'org-platform')) db.organizations.push({
    id: 'org-platform', name: 'SCDE Demo', subdomain: 'platform', plan: 'FREE', auth_mode: 'JWT', is_active: true,
  });
  if (!db.users.some(u => u.id === 'u-superadmin')) db.users.push({
    id: 'u-superadmin', email: 'superadmin@scde.demo', password: 'super123', first_name: 'Superadmin', last_name: 'Demo',
    organization_id: 'org-platform', is_staff: true, is_superadmin: true, is_active: true,
    email_notifications_enabled: true, dni: '', nia: '', created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z',
  });
});

export const organizationMocks = [{ method: 'POST', path: '/organizations/', handler: ({ db, user, body }) => {
  if (!user?.is_active || !user.is_superadmin) throw mockError(403, 'SUPERADMIN_REQUIRED');
  const errors = {};
  for (const [key, max] of [['name', 255], ['subdomain', 63]]) {
    if (typeof body[key] !== 'string' || !body[key].trim()) errors[key] = ['FIELD_REQUIRED'];
    else if (body[key].trim().length > max) errors[key] = ['INVALID'];
  }
  if (body.subdomain && !/^[-a-zA-Z0-9_]+$/.test(body.subdomain.trim())) errors.subdomain = ['INVALID'];
  if (body.plan !== undefined && !['FREE', 'PREMIUM'].includes(body.plan)) errors.plan = ['INVALID'];
  const manager = body.initial_manager;
  if (!manager || typeof manager !== 'object') errors.initial_manager = ['FIELD_REQUIRED'];
  else {
    const nested = {};
    if (typeof manager.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(manager.email.trim())) nested.email = ['INVALID'];
    for (const key of ['first_name', 'last_name']) {
      if (typeof manager[key] !== 'string' || !manager[key].trim()) nested[key] = ['FIELD_REQUIRED'];
      else if (manager[key].trim().length > 150) nested[key] = ['INVALID'];
    }
    for (const [field, codes] of Object.entries(nested)) errors[`initial_manager.${field}`] = codes;
  }
  if (Object.keys(errors).length) throw mockError(400, 'VALIDATION_ERROR', errors);
  if (db.organizations.some(o => o.subdomain === body.subdomain.trim())) throw mockError(409, 'SUBDOMAIN_ALREADY_EXISTS', { subdomain: ['SUBDOMAIN_ALREADY_EXISTS'] });
  // Validate before mutating either collection: failed registration is atomic.
  if (db.users.some(u => u.email.toLowerCase() === manager.email.trim().toLowerCase())) throw mockError(500, 'INTERNAL_ERROR');
  const created_at = new Date().toISOString();
  const org = { id: crypto.randomUUID(), name: body.name.trim(), subdomain: body.subdomain.trim(), plan: body.plan ?? 'FREE', auth_mode: 'JWT', is_active: true, created_at };
  const initial = { id: crypto.randomUUID(), organization_id: org.id, email: manager.email.trim().toLowerCase(),
    first_name: manager.first_name.trim(), last_name: manager.last_name.trim(), dni: manager.dni ?? '', nia: manager.nia ?? '',
    password: crypto.randomUUID(), is_staff: true, is_superadmin: false, is_active: true, email_notifications_enabled: true,
    created_at, updated_at: created_at };
  db.organizations.push(org);
  db.users.push(initial);
  return reply(201, org);
} }];
