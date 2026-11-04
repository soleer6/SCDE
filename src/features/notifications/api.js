import { api } from '../../lib/api/client.js';
export const getNotifications = (page, filters = {}) => api.get('/notifications/', { page, ...filters });
export const getUnreadCount = () => api.get('/notifications/count/');
export async function markRead(notification_ids) {
  const result = await api.patch('/notifications/read/', { notification_ids });
  window.dispatchEvent(new Event('scde:notifications-read'));
  return result;
}
