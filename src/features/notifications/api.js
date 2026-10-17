import { api } from '../../lib/api/client.js';
export const getNotifications = (page) => api.get('/notifications/', { page });
export const getUnreadCount = () => api.get('/notifications/count/');
export async function markRead(notification_ids) {
  const result = await api.patch('/notifications/read/', { notification_ids });
  window.dispatchEvent(new Event('scde:notifications-read'));
  return result;
}
