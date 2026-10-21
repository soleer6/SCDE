import { mockError, paginate } from '../../lib/mock/router.js';
const owned = (db, user) => {
  if (!user?.is_active) throw mockError(403, 'PERMISSION_DENIED');
  return db.notifications.filter((n) => n.user_id === user.id);
};
const shape = ({ user_id: _owner, ...notification }) => notification;
export const mocks = [
  { method: 'GET', path: '/notifications/', handler: ({ db, user, query }) => paginate(owned(db, user)
    .filter((n) => query.get('status') ? n.status === query.get('status') : n.status !== 'ARCHIVED')
    .filter((n) => !query.get('notification_type') || n.notification_type === query.get('notification_type'))
    .sort((a, b) => b.created_at.localeCompare(a.created_at)).map(shape), query) },
  { method: 'GET', path: '/notifications/count/', handler: ({ db, user }) => ({ unread_count: owned(db, user).filter((n) => n.status === 'UNREAD').length }) },
  { method: 'PATCH', path: '/notifications/read/', handler: ({ db, user, body }) => {
    let marked_read = 0;
    for (const n of owned(db, user)) if ((!body.notification_ids?.length || body.notification_ids.includes(n.id)) && n.status === 'UNREAD') { n.status = 'READ'; marked_read++; }
    return { marked_read };
  } },
];
