import { mockError } from '../../lib/mock/router.js';
import { validateEmail } from '../admin/mocks.js';
import { DEFAULT_PERMISSIONS, PERMISSION_KEYS } from '../../lib/permissions.js';

const shape = (user) => Object.fromEntries(['id', 'email', 'first_name', 'last_name', 'nia', 'dni', 'organization_id', 'email_notifications_enabled'].map((key) => [key, user[key]]));
export const mocks = [
  // Fallback for the administration-only worktree. The workspace feature is
  // registered first in a composition and keeps ownership of this endpoint.
  { method: 'GET', path: '/my-subjects/', handler: ({ user, db }) => {
    if (!user?.is_active) throw mockError(403, 'PERMISSION_DENIED');
    const course = db.courses.find(c => c.is_active);
    return db.memberships.filter(m => m.user_id === user.id && m.is_active)
      .flatMap(m => {
        const subject = db.subjects.find(s => s.id === m.subject_id && s.course_id === course?.id);
        return subject ? [{ id: subject.id, name: subject.name, code: subject.code, semester: subject.semester,
          role: m.role, membership_id: m.id,
          effective_permissions: Object.fromEntries(PERMISSION_KEYS.map(key => [key, Boolean(user.is_staff || user.is_superadmin ||
            (m.role !== 'STUDENT' && (m.permission_overrides?.[key] ?? db.org_config.role_permission_defaults?.[m.role]?.[key] ?? DEFAULT_PERMISSIONS[m.role]?.[key])))])),
          group_label: db.groups.find(g => g.id === m.group_id)?.label ?? '',
          coordinator_email: db.users.find(u => u.id === subject.coordinator_id)?.email ?? '' }] : [];
      }).sort((a, b) => a.name.localeCompare(b.name));
  } },
  { method: 'GET', path: '/profile/', handler: ({ user }) => {
    if (!user?.is_active) throw mockError(403, 'PERMISSION_DENIED');
    return shape(user);
  } },
  { method: 'PATCH', path: '/profile/', handler: ({ user, body, db }) => {
    if (!user?.is_active) throw mockError(403, 'PERMISSION_DENIED');
    if (body.email !== undefined) { validateEmail(body.email, db, user.id); user.email = body.email; }
    if (body.email_notifications_enabled !== undefined) user.email_notifications_enabled = body.email_notifications_enabled;
    return shape(user);
  } },
];
