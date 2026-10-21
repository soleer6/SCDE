import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Administration-only companion: no course creation, deletes or grading writes.
export async function runAdminSmoke(fixtureFile) {
  const fixture = JSON.parse(await readFile(fixtureFile, 'utf8'));
  const origin = new URL(process.env.SCDE_REAL_API || 'http://127.0.0.1:8000');
  assert.ok(['127.0.0.1', 'localhost'].includes(origin.hostname), 'Local API required');
  const checks = [];
  // Keep fixture-owned IDs across builds without writing next to credentials.
  const reportDir = resolve('src/features/admin/real-backend');
  const reportFile = resolve(reportDir, 'admin-smoke-results.local');
  let previous;
  try { previous = JSON.parse(await readFile(reportFile, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const artifacts = previous?.organizationId === fixture.organizationId ? previous.artifacts : {};
  const pending = [];
  const sessions = {};
  const stamp = Date.now();
  async function request(path, { role = 'manager', method = 'GET', body, status = 200, auth = true } = {}) {
    const response = await fetch(new URL(`/api/v1${path}`, origin), {
      method, headers: { Accept: 'application/json', 'Content-Type': 'application/json',
        ...(auth ? { Authorization: `Bearer ${sessions[role].access_token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000),
    });
    const data = response.status === 204 ? null : await response.json();
    // Never include login bodies, passwords or token responses in diagnostics.
    assert.equal(response.status, status, `${method} ${path}: expected ${status}, got ${response.status}; code=${data?.error_code || 'none'}`);
    return data;
  }
  async function check(name, run) {
    try { await run(); checks.push({ name, passed: true }); console.log(`OK ${name}`); }
    catch (error) { checks.push({ name, passed: false, error: error.message }); console.error(`FAIL ${name}: ${error.message}`); }
  }
  // Fail closed before any mutation if any account belongs to another organization.
  for (const role of ['manager', 'teacher', 'student']) {
    sessions[role] = await request('/auth/login/', { auth: false, method: 'POST', body: { email: fixture[role], password: fixture.password } });
    assert.equal(sessions[role].user.organization_id, fixture.organizationId, 'Fixture organization mismatch');
  }
  if (!artifacts.subjectId) {
    const course = await request('/courses/current/');
    const subjects = await request(`/search/?course_id=${course.id}&q=OPS-`);
    const existing = subjects.results.find(s => s.code?.startsWith('OPS-') && s.name?.startsWith('Administración real '));
    if (existing) {
      const subject = await request(`/subjects/${existing.id}/`);
      assert.equal(subject.coordinator_id, sessions.manager.user.id, 'Synthetic subject must belong to this fixture manager');
      artifacts.subjectId = subject.id;
      const members = (await request(`/subjects/${subject.id}/members/`)).results;
      for (const role of ['teacher', 'student']) artifacts[`${role}MembershipId`] = members.find(m => m.user_id === sessions[role].user.id)?.id;
      artifacts.groupId = (await request(`/subjects/${subject.id}/groups/`)).results.find(g => ['Laboratorio real', 'Laboratorio verificado'].includes(g.label))?.id;
    }
  }
  const subjectBody = { name: `Administración real ${stamp}`, code: `OPS-${stamp}`, coordinator_id: sessions.manager.user.id };
  if (artifacts.subjectId) {
    const existing = await request(`/subjects/${artifacts.subjectId}/`);
    subjectBody.code = existing.code;
    subjectBody.name = existing.name.replace(/ verificada$/, '');
  }
  await check('subject: create in own active course, persist edit, reject duplicate', async () => {
    const course = await request('/courses/current/');
    const created = artifacts.subjectId ? await request(`/subjects/${artifacts.subjectId}/`) : await request('/subjects/', { method: 'POST', body: subjectBody, status: 201 });
    artifacts.subjectId = created.id;
    assert.equal(created.course_id, course.id);
    assert.equal(created.coordinator_id, sessions.manager.user.id);
    assert.equal((await request('/subjects/', { method: 'POST', body: subjectBody, status: 409 })).error_code, 'CODE_ALREADY_EXISTS');
    const name = `${subjectBody.name} verificada`;
    await request(`/subjects/${created.id}/`, { method: 'PATCH', body: { name, semester: '1' } });
    const saved = await request(`/subjects/${created.id}/`);
    assert.equal(saved.name, name);
    assert.equal(saved.semester, '1');
  });
  const root = () => { assert.ok(artifacts.subjectId, 'Subject creation required'); return `/subjects/${artifacts.subjectId}`; };
  await check('groups: create, persist rename, reject duplicate and invalid label', async () => {
    const created = artifacts.groupId ? (await request(`${root()}/groups/`)).results.find(g => g.id === artifacts.groupId)
      : await request(`${root()}/groups/`, { method: 'POST', body: { label: 'Laboratorio real' }, status: 201 });
    artifacts.groupId = created.id;
    assert.equal(created.subject_id, artifacts.subjectId);
    assert.equal((await request(`${root()}/groups/`, { method: 'POST', body: { label: created.label }, status: 409 })).error_code, 'GROUP_LABEL_EXISTS');
    await request(`${root()}/groups/${created.id}/`, { method: 'PATCH', body: { label: 'Laboratorio verificado' } });
    const saved = (await request(`${root()}/groups/`)).results.find(g => g.id === created.id);
    assert.equal(saved.label, 'Laboratorio verificado');
    assert.equal(saved.member_count, artifacts.studentMembershipId ? 1 : 0);
    const invalid = await request(`${root()}/groups/`, { method: 'POST', body: { label: '' }, status: 400 });
    assert.equal(invalid.error_code, 'VALIDATION_ERROR');
    assert.ok(invalid.errors.label);
  });
  await check('members: assign teacher/student, persist group, reject duplicate/coordinator', async () => {
    assert.ok(artifacts.groupId, 'Group creation required');
    for (const role of ['teacher', 'student']) {
      if (artifacts[`${role}MembershipId`]) continue;
      const member = await request(`${root()}/members/`, { method: 'POST', status: 201,
        body: { user_id: sessions[role].user.id, role: role.toUpperCase(), group_id: role === 'student' ? artifacts.groupId : null } });
      artifacts[`${role}MembershipId`] = member.id;
    }
    const list = (await request(`${root()}/members/`)).results;
    assert.equal(list.find(m => m.id === artifacts.teacherMembershipId).role, 'TEACHER');
    assert.equal(list.find(m => m.id === artifacts.studentMembershipId).role, 'STUDENT');
    assert.equal(list.find(m => m.id === artifacts.studentMembershipId).group_id, artifacts.groupId);
    assert.equal((await request(`${root()}/groups/`)).results.find(g => g.id === artifacts.groupId).member_count, 1);
    assert.equal((await request(`${root()}/members/`, { method: 'POST', status: 409,
      body: { user_id: sessions.teacher.user.id, role: 'TEACHER' } })).error_code, 'ALREADY_MEMBER');
    const invalid = await request(`${root()}/members/`, { method: 'POST', status: 400,
      body: { user_id: sessions.teacher.user.id, role: 'COORDINATOR' } });
    assert.ok(invalid.errors.role);
  });
  for (const role of ['teacher', 'student']) {
    await check(`${role}: administration writes and member/group lists denied`, async () => {
      const cases = [
        ['/users/', 'GET'], ['/subjects/', 'POST', subjectBody],
        [`${root()}/`, 'PATCH', { name: 'Unauthorized' }],
        [`${root()}/members/`, 'GET'], [`${root()}/groups/`, 'GET'],
        [`${root()}/groups/`, 'POST', { label: 'Unauthorized' }],
        [`${root()}/groups/${artifacts.groupId}/`, 'PATCH', { label: 'Unauthorized' }],
        [`${root()}/members/`, 'POST', { user_id: sessions.student.user.id, role: 'STUDENT' }],
        [`/memberships/${artifacts.teacherMembershipId}/permissions/`, 'PATCH', { permissions: { can_manage_groups: true } }],
      ];
      for (const [path, method, body] of cases) {
        const denied = await request(path, { role, method, body, status: 403 });
        assert.equal(denied.error_code, path === '/users/' || path === '/subjects/' ? 'ORG_MANAGER_REQUIRED' : 'PERMISSION_DENIED');
      }
      assert.equal((await request(`${root()}/`)).name, `${subjectBody.name} verificada`);
      assert.equal((await request(`${root()}/groups/`)).results.find(g => g.id === artifacts.groupId).label, 'Laboratorio verificado');
    });
  }
  await check('permissions: merge, null restores inheritance, persistence and delegation limit', async () => {
    assert.ok(artifacts.teacherMembershipId, 'Teacher membership required');
    const path = `/memberships/${artifacts.teacherMembershipId}/permissions/`;
    try {
      await request(path, { method: 'PATCH', body: { permissions: { can_manage_groups: true, can_create_rubric: false } } });
      assert.equal((await request(path)).permissions.can_manage_groups, true);
      await request(`${root()}/groups/`, { role: 'teacher' });
      await request(path, { method: 'PATCH', body: { permissions: { can_manage_groups: null, can_delegate_perms: true } } });
      const inherited = await request(path);
      assert.ok(!inherited.permissions.can_manage_groups);
      assert.ok(!inherited.permissions.can_create_rubric);
      const raw = (await request(`${root()}/members/`)).results.find(m => m.id === artifacts.teacherMembershipId).permission_overrides;
      assert.equal(raw.can_create_rubric, false);
      assert.ok(!Object.hasOwn(raw, 'can_manage_groups'));
      const denied = await request(path, { role: 'teacher', method: 'PATCH', status: 403, body: { permissions: { can_manage_groups: true } } });
      assert.equal(denied.error_code, 'DELEGATION_EXCEEDED');
      assert.ok(!(await request(path)).permissions.can_manage_groups);
      const student = await request(`/memberships/${artifacts.studentMembershipId}/permissions/`, { method: 'PATCH', status: 403, body: { permissions: { can_manage_groups: true } } });
      assert.equal(student.error_code, 'STUDENT_PERMS_FIXED');
    } finally {
      await request(path, { method: 'PATCH', body: { permissions: { can_manage_groups: null, can_create_rubric: null, can_delegate_perms: null } } });
    }
    assert.equal((await request(path)).has_overrides, false);
  });
  await check('notifications: real count/read transport (empty fixture limitations in report)', async () => {
    const teacher = await request('/notifications/', { role: 'teacher' });
    const student = await request('/notifications/', { role: 'student' });
    if (!teacher.results.length || !student.results.length) {
      pending.push('Notification fixture is empty: actual read persistence and recipient isolation require synthetic notifications. Docker access denied in this sandbox.');
      const before = (await request('/notifications/count/', { role: 'student' })).unread_count;
      const untouched = await request('/notifications/read/', { role: 'student', method: 'PATCH', body: { notification_ids: [crypto.randomUUID()] } });
      assert.equal(untouched.marked_read, 0);
      assert.equal((await request('/notifications/count/', { role: 'student' })).unread_count, before);
      const invalid = await request('/notifications/read/', { role: 'student', method: 'PATCH', body: { notification_ids: ['invalid'] }, status: 400 });
      assert.equal(invalid.error_code, 'VALIDATION_ERROR');
      assert.ok(Object.keys(invalid.errors).length);
      console.log('LIMIT notifications: empty fixture; only count, unknown ID and validation checked');
      return;
    }
    const id = student.results[0].id;
    const count = (await request('/notifications/count/', { role: 'student' })).unread_count;
    assert.ok(!teacher.results.some(n => n.id === id));
    assert.equal((await request('/notifications/read/', { role: 'teacher', method: 'PATCH', body: { notification_ids: [id] } })).marked_read, 0);
    const expected = student.results[0].status === 'UNREAD' ? 1 : 0;
    assert.equal((await request('/notifications/read/', { role: 'student', method: 'PATCH', body: { notification_ids: [id] } })).marked_read, expected);
    assert.equal((await request('/notifications/count/', { role: 'student' })).unread_count, count - expected);
    assert.equal((await request('/notifications/', { role: 'student' })).results.find(n => n.id === id).status, 'READ');
    assert.equal((await request('/notifications/read/', { role: 'student', method: 'PATCH', body: { notification_ids: [id] } })).marked_read, 0);
  });
  await check('backend observation: student can GET another membership permissions in own organization', async () => {
    const response = await request(`/memberships/${artifacts.teacherMembershipId}/permissions/`, { role: 'student' });
    assert.equal(response.role, 'TEACHER');
    pending.push('Backend permission GET returns 200 to another student in the same organization without checking can_delegate_perms; PATCH is correctly denied. Backend read-only: authorization review pending.');
  });
  await mkdir(reportDir, { recursive: true });
  await writeFile(reportFile, JSON.stringify({ date: new Date().toISOString(), organizationId: fixture.organizationId, checks, artifacts, pending }, null, 2));
  console.log(`${checks.filter(c => c.passed).length}/${checks.length} administration checks passed.`);
  if (checks.some(c => !c.passed)) process.exitCode = 1;
}
