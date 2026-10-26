import { api } from '../../lib/api/client.js';
export const getProfile = () => api.get('/profile/');
export const getSubjectRoles = () => api.get('/my-subjects/');
export const updateProfile = (body) => api.patch('/profile/', body);
