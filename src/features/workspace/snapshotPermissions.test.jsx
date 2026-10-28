import { beforeEach, expect, it } from 'vitest';
import { api } from '../../lib/api/client.js';
import { tokenStore } from '../../lib/api/tokens.js';
import { db, q } from '../../lib/mock/db.js';
import { PERMISSION_KEYS } from '../../lib/permissions.js';
import '../../app/i18n.js';

beforeEach(() => { localStorage.clear(); db.reset(); });

async function login(email = 'javier.ruiz@uam.es', password = 'prof123') {
  const data = await api.post('/auth/login/', { email, password }, { auth: false });
  tokenStore.set(data.access_token, data.refresh_token);
}
const subject = async () => (await api.get('/my-subjects/')).find((s) => s.id === 's-mat101');

it('replaces the historical H41 false→true reproduction with false→false for the SAME membership', async () => {
  await login();
  const before = await subject();
  db.org_config.role_permission_defaults = { TEACHER: { can_create_exams: true } };
  const after = await subject();
  expect(after.membership_id).toBe(before.membership_id);
  expect(before.effective_permissions.can_create_exams).toBe(false);
  expect(after.effective_permissions.can_create_exams).toBe(false);
  expect(Object.keys(after.effective_permissions).sort()).toEqual([...PERMISSION_KEYS].sort());
  expect(after).not.toHaveProperty('role_permission_snapshot');
  expect(await api.get('/exams/e-mat-p2/')).not.toHaveProperty('student_permissions');
  const payload = { name: 'Snapshot regression' };
  await expect(api.patch('/exams/e-mat-p2/', payload)).rejects.toMatchObject({ status: 403 });
  const member = q.membership('u-javier', 's-mat101');
  member.permission_overrides.can_create_exams = true;
  expect((await subject()).effective_permissions.can_create_exams).toBe(true);
  expect(await api.get('/exams/e-mat-p2/')).toHaveProperty('student_permissions');
  await expect(api.patch('/exams/e-mat-p2/', payload)).resolves.toMatchObject(payload);
  for (const override of [false, null]) {
    member.permission_overrides.can_create_exams = override;
    expect((await subject()).effective_permissions.can_create_exams).toBe(false);
    await expect(api.patch('/exams/e-mat-p2/', payload)).rejects.toMatchObject({ status: 403 });
  }
});

it('retains every role base, and snapshots stay internal when serializing exams and discovery', async () => {
  for (const [email, password] of [
    ['maria.perez@uam.es', 'prof123'],
    ['javier.ruiz@uam.es', 'prof123'],
    ['elena.rodriguez@estudiante.uam.es', 'est123'],
  ]) {
    await login(email, password);
    const before = await subject();
    db.org_config.role_permission_defaults[before.role] = Object.fromEntries(
      Object.entries(before.effective_permissions).map(([key, value]) => [key, !value]),
    );
    const after = await subject();
    expect(after).toEqual(before);
    expect(await api.get('/exams/e-mat-p2/')).not.toHaveProperty('role_permission_snapshot');
  }
});

it('annotation authorization retains original view-all despite changed defaults, with explicit false/null', async () => {
  await login();
  const path = '/instances/i-e-mat-p1-1/annotations/';
  expect(await api.get(path)).toEqual([]);
  db.org_config.role_permission_defaults = { TEACHER: { can_view_all_instances: false } };
  expect(await api.get(path)).toEqual([]);
  const member = q.membership('u-javier', 's-mat101');
  member.permission_overrides.can_view_all_instances = false;
  await expect(api.get(path)).rejects.toMatchObject({ status: 403 });
  member.permission_overrides.can_view_all_instances = null;
  expect(await api.get(path)).toEqual([]);
});
