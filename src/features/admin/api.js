import { api } from '../../lib/api/client.js';

export const getUsers = (query) => api.get('/users/', query);
export const createUser = (body) => api.post('/users/', body);
export const updateUser = (id, body) => api.patch(`/users/${id}/`, body);
export const resetPassword = (id) => api.post(`/users/${id}/reset-password/`);
export const getCurrentCourse = () => api.get('/courses/current/');
export const getCourse = (id) => api.get(`/courses/${encodeURIComponent(id)}/`);
export const createCourse = (body) => api.post('/courses/', body);
export const updateCourse = (id, body) => api.patch(`/courses/${id}/`, body);
export const getConfig = () => api.get('/config/');
export const updateConfig = (body) => api.patch('/config/', body);
export const getAudit = (query) => api.get('/audit-logs/', query);
export const exportUsers = () => api.blob('/users/export/', { export_format: 'json' });
export const searchCatalog = (query) => api.get('/search/', query);
export const importUsers = (form) => api.upload('/users/import/', form);
