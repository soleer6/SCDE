import { api } from '../../lib/api/client.js';
export const getProfile = () => api.get('/profile/');
export const updateProfile = (body) => api.patch('/profile/', body);
