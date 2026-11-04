import { beforeEach, expect, it } from 'vitest';
import { api } from '../../lib/api/client.js';
import { db } from '../../lib/mock/db.js';
import { mockFetch } from '../../lib/mock/router.js';
import { tokenStore } from '../../lib/api/tokens.js';
import { loginAs, resetDemo } from '../admin/test-utils.jsx';

beforeEach(async () => { await resetDemo(); await loginAs(); });
const configure = (value) => api.patch('/config/', { role_permission_defaults: {
  TEACHER: { can_create_exams: value, can_manage_groups: value },
  COORDINATOR: { can_manage_groups: value },
} });
const permissions = (id) => api.get(`/memberships/${id}/permissions/`);
const override = (id, value) => api.patch(`/memberships/${id}/permissions/`, { permissions: { can_create_exams: value } });
const createSubject = (code) => api.post('/subjects/', { code, name: code, coordinator_id: 'u-maria' });
const assign = (subject, user, role = 'TEACHER') => api.post(`/subjects/${subject}/members/`, { user_id: user, role });
const importSubject = (code) => {
  const rows = [{ code, name: code, coordinator_email: 'maria.perez@uam.es', teachers: ['javier.ruiz@uam.es'], students: [{ email: 'elena.rodriguez@estudiante.uam.es' }] }];
  const form = new FormData(); form.append('file', new File([JSON.stringify(rows)], 'subjects.json', { type: 'application/json' }));
  return api.upload('/subjects/import/', form);
};

it('fixes existing ADMIN effective permissions while new assignments capture the new defaults', async () => {
  expect((await permissions('m-2')).permissions.can_create_exams).toBeUndefined();
  const subject = await createSubject('RF155-assign');
  const old = await assign(subject.id, 'u-javier');
  await configure(true);
  expect((await permissions(old.id)).permissions.can_create_exams).toBeUndefined();
  expect((await permissions('m-2')).permissions.can_create_exams).toBeUndefined();
  await loginAs('javier.ruiz@uam.es', 'prof123');
  await expect(api.get(`/subjects/${subject.id}/groups/`)).rejects.toMatchObject({ status: 403 });
  await loginAs();
  await api.patch(`/memberships/${old.id}/permissions/`, { permissions: { can_manage_groups: true } });
  await loginAs('javier.ruiz@uam.es', 'prof123');
  expect((await api.get(`/subjects/${subject.id}/groups/`)).results).toEqual([]);
  await loginAs();
  await api.patch(`/memberships/${old.id}/permissions/`, { permissions: { can_manage_groups: null } });
  const newer = await assign(subject.id, 'u-elena');
  expect((await permissions(newer.id)).permissions.can_create_exams).toBe(true);
  await configure(false);
  expect((await permissions(newer.id)).permissions.can_create_exams).toBe(true);
  for (const [id, base] of [[old.id, false], [newer.id, true]]) {
    for (const value of [true, false, null]) {
      const response = await override(id, value);
      expect(response.permissions.can_create_exams).toBe(value ?? base);
      expect(response.has_overrides).toBe(value !== null);
      expect(response).not.toHaveProperty('role_permission_snapshot');
    }
  }
}, 15000);

it('uses each fixed role base during coordinator promotion and demotion', async () => {
  await configure(false);
  const subject = await createSubject('RF155-roles');
  const teacher = await assign(subject.id, 'u-javier');
  const coordinator = db.memberships.find((m) => m.subject_id === subject.id && m.role === 'COORDINATOR');
  await override(teacher.id, true);
  await configure(true);
  await api.patch(`/subjects/${subject.id}/`, { coordinator_id: 'u-javier' });
  expect(await permissions(teacher.id)).toMatchObject({ role: 'COORDINATOR', has_overrides: false });
  expect((await permissions(teacher.id)).permissions).not.toHaveProperty('can_manage_groups');
  expect(await permissions(coordinator.id)).toMatchObject({ role: 'TEACHER', has_overrides: false });
  expect((await permissions(coordinator.id)).permissions).not.toHaveProperty('can_create_exams');
  await api.patch(`/subjects/${subject.id}/`, { coordinator_id: 'u-maria' });
  expect((await permissions(teacher.id)).permissions).not.toHaveProperty('can_create_exams');
});

it('captures imported roles once and reactivates the same coordinator without adopting new defaults', async () => {
  await configure(false);
  expect(await importSubject('RF155-import')).toEqual({ created: 1, total_errors: 0, errors: [] });
  const subject = db.subjects.find((s) => s.code === 'RF155-import');
  const rows = db.memberships.filter((m) => m.subject_id === subject.id);
  const ids = rows.map((m) => m.id);
  const snapshots = rows.map((m) => structuredClone(m.role_permission_snapshot));
  const coordinator = rows.find((m) => m.role === 'COORDINATOR');
  // Import is the backend lifecycle path that reactivates an existing coordinator.
  coordinator.is_active = false; db.persist();
  await configure(true);
  expect(await importSubject('RF155-import')).toEqual({ created: 1, total_errors: 0, errors: [] });
  const after = db.memberships.filter((m) => m.subject_id === subject.id);
  expect(after.map((m) => m.id)).toEqual(ids);
  expect(after.map((m) => m.role_permission_snapshot)).toEqual(snapshots);
  expect(coordinator.is_active).toBe(true);
  expect((await permissions(rows.find((m) => m.role === 'TEACHER').id)).permissions).not.toHaveProperty('can_create_exams');
  expect((await permissions(coordinator.id)).permissions).not.toHaveProperty('can_manage_groups');
  expect((await permissions(rows.find((m) => m.role === 'STUDENT').id)).permissions).toEqual({});
  await importSubject('RF155-import-new');
  const newer = db.subjects.find((s) => s.code === 'RF155-import-new');
  const teacher = db.memberships.find((m) => m.subject_id === newer.id && m.role === 'TEACHER');
  expect((await permissions(teacher.id)).permissions.can_create_exams).toBe(true);
});

it('keeps HTTP permission shapes, sparse GET and full PATCH without exposing the internal snapshot', async () => {
  const headers = { Authorization: `Bearer ${tokenStore.getAccess()}`, 'Content-Type': 'application/json' };
  const get = await mockFetch('http://localhost/api/v1/memberships/m-2/permissions/', { headers });
  expect(get.status).toBe(200);
  const shape = await get.json();
  expect(Object.keys(shape).sort()).toEqual(['has_overrides', 'is_staff_bypass', 'permissions', 'role']);
  expect(Object.values(shape.permissions).every((value) => value === true)).toBe(true);
  const patch = await mockFetch('http://localhost/api/v1/memberships/m-2/permissions/', { method: 'PATCH', headers, body: JSON.stringify({ permissions: { can_create_exams: false } }) });
  expect(patch.status).toBe(200);
  expect(await patch.json()).toMatchObject({ ...shape, has_overrides: true, permissions: { can_create_exams: false } });
  const members = await api.get('/subjects/s-mat101/members/');
  expect(members.results.every((row) => !Object.hasOwn(row, 'role_permission_snapshot'))).toBe(true);
});
