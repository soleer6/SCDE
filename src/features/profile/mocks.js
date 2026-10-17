import { mockError } from '../../lib/mock/router.js';
import { validateEmail } from '../admin/mocks.js';

const shape = (user) => Object.fromEntries(['id', 'email', 'first_name', 'last_name', 'nia', 'dni', 'organization_id', 'email_notifications_enabled'].map((key) => [key, user[key]]));
export const mocks = [
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
