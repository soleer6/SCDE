import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';

const fixtureFile = process.argv[2] || join(process.env.LOCALAPPDATA, 'SCDE/integration/fixtures.local.json');
const fixture = JSON.parse(await readFile(fixtureFile, 'utf8'));
const origin = new URL(process.env.SCDE_REAL_API || 'http://127.0.0.1:8000');
if (!['127.0.0.1', 'localhost'].includes(origin.hostname)) throw new Error('This mutating smoke test only runs on the isolated local fixture.');
const checks = [];
async function check(name, run) {
  try { await run(); checks.push({ name, passed: true }); console.log(`OK ${name}`); }
  catch (error) { checks.push({ name, passed: false, error: error.message }); console.error(`FAIL ${name}: ${error.message}`); }
}
async function request(path, { method = 'GET', body, token, status = 200, form } = {}) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(new URL(`/api/v1${path}`, origin), {
    method, headers, body: form || (body === undefined ? undefined : JSON.stringify(body)), signal: AbortSignal.timeout(30000),
  });
  const data = response.status === 204 ? null : (response.headers.get('content-type')?.includes('json') ? await response.json() : await response.text());
  assert.equal(response.status, status, `${method} ${path}: expected ${status}, got ${response.status}; ${JSON.stringify(data).slice(0,350)}`);
  return data;
}
async function login(email) {
  const data = await request('/auth/login/', { method: 'POST', body: { email, password: fixture.password } });
  assert.ok(data.access_token && data.refresh_token && data.user.id);
  assert.equal(data.user.organization_id, fixture.organizationId);
  return data;
}
const sessions = {};
await check('health: PostgreSQL + Redis', async () => {
  const response = await fetch(new URL('/health/', origin));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, 'healthy');
});
await check('CORS: browser authorization preflight', async () => {
  const response = await fetch(new URL('/api/v1/profile/', origin), { method: 'OPTIONS', headers: {
    Origin: 'http://127.0.0.1:5176', 'Access-Control-Request-Method': 'PATCH', 'Access-Control-Request-Headers': 'authorization,content-type',
  }});
  assert.equal(response.headers.get('access-control-allow-origin'), 'http://127.0.0.1:5176');
  assert.match(response.headers.get('access-control-allow-headers'), /authorization/i);
});
for (const role of ['manager', 'teacher', 'student', 'publishedStudent']) {
  await check(`JWT login: ${role}`, async () => { sessions[role] = await login(fixture[role]); });
}
await check('unauthenticated requests are rejected', async () => {
  const data = await request('/profile/', { status: 401 });
  assert.ok(data.error_code);
});
for (const role of ['manager', 'teacher', 'student']) {
  await check(`profile/subjects/tasks/notifications: ${role}`, async () => {
    const token = sessions[role].access_token;
    const profile = await request('/profile/', { token });
    assert.equal(profile.email, fixture[role]);
    assert.ok(!('password' in profile));
    const subjects = await request('/my-subjects/', { token });
    assert.ok(Array.isArray(subjects) && subjects.length > 0);
    fixture.subjectId ||= subjects[0].id;
    await request('/my-exams/', { token });
    const list = await request('/notifications/', { token });
    assert.ok(Array.isArray(list.results));
    assert.equal(typeof (await request('/notifications/count/', { token })).unread_count, 'number');
    if (role !== 'student') await request('/my-tasks/', { token });
  });
}
await check('student cannot manage users', async () => {
  await request('/users/', { token: sessions.student.access_token, status: 403 });
});
await check('profile preferences persist in PostgreSQL', async () => {
  const token = sessions.student.access_token;
  const before = await request('/profile/', { token });
  try {
    await request('/profile/', { token, method: 'PATCH', body: { email_notifications_enabled: !before.email_notifications_enabled } });
    assert.equal((await request('/profile/', { token })).email_notifications_enabled, !before.email_notifications_enabled);
  } finally {
    await request('/profile/', { token, method: 'PATCH', body: { email_notifications_enabled: before.email_notifications_enabled } });
  }
});
await check('manager: users, courses, config, members, groups, audit', async () => {
  const token = sessions.manager.access_token;
  const users = await request('/users/?page_size=2', { token });
  assert.equal(users.results.length, 2);
  assert.ok(users.count >= 4 && users.total_pages >= 2);
  const current = await request('/courses/current/', { token });
  assert.ok(current.id && current.is_active);
  const courses = await request('/search/', { token });
  assert.ok(courses.results.some(item => item.id === current.id));
  const subjects = await request(`/search/?course_id=${current.id}`, { token });
  assert.ok(subjects.results.some(item => item.id === fixture.subjectId));
  const config = await request('/config/', { token });
  assert.equal(config.default_ocr_engine, 'tesseract');
  await request('/config/', { token, method: 'PATCH', body: { default_language: config.default_language } });
  const members = await request(`/subjects/${fixture.subjectId}/members/`, { token });
  assert.ok(members.results.length >= 4);
  const groups = await request(`/subjects/${fixture.subjectId}/groups/`, { token });
  assert.ok(Array.isArray(groups.results) || Array.isArray(groups));
  await request('/audit-logs/', { token });
});
await check('manager: create and edit a real user, reject duplicate', async () => {
  const token = sessions.manager.access_token;
  const body = { email: `integration-${Date.now()}@scde.local`, first_name: 'Integration', last_name: 'Test' };
  const created = await request('/users/', { token, method: 'POST', body, status: 201 });
  assert.ok(created.id && !('password' in created));
  const updated = await request(`/users/${created.id}/`, { token, method: 'PATCH', body: { last_name: 'Verified' } });
  assert.equal(updated.last_name, 'Verified');
  const duplicate = await request('/users/', { token, method: 'POST', body, status: 409 });
  assert.ok(duplicate.error_code);
});
await check('manager: JSON import via browser multipart transport', async () => {
  const form = new FormData();
  form.set('file', new Blob([JSON.stringify([{ email: `import-${Date.now()}@scde.local`, first_name: 'Import', last_name: 'Test' }])], { type: 'application/json' }), 'integration.json');
  const data = await request('/users/import/', { token: sessions.manager.access_token, method: 'POST', form });
  assert.equal(data.created, 1);
  assert.equal(data.total_errors, 0);
});
await check('teacher: exam, models, instance, pages and annotations', async () => {
  const token = sessions.teacher.access_token;
  const exam = await request(`/exams/${fixture.examId}/`, { token });
  assert.equal(exam.id, fixture.examId);
  await request(`/instances/${fixture.instanceId}/`, { token });
  const pages = await request(`/instances/${fixture.instanceId}/pages/`, { token });
  assert.equal(pages.length, 3);
  const annotations = await request(`/instances/${fixture.instanceId}/annotations/`, { token });
  assert.ok(Array.isArray(annotations));
});
await check('teacher: actual scanned PDF download from MinIO', async () => {
  const response = await fetch(new URL(`/api/v1/instances/${fixture.instanceId}/download/`, origin), { headers: { Authorization: `Bearer ${sessions.teacher.access_token}` } });
  assert.equal(response.status, 200);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(bytes.subarray(0,5).toString(), '%PDF-');
  assert.ok(bytes.length > 1000);
});
await check('teacher: annotations round-trip through real S3 signed URLs and CORS', async () => {
  const token = sessions.teacher.access_token;
  const payload = `Integration annotation ${Date.now()}`;
  const annotation = await request(`/instances/${fixture.instanceId}/annotations/`, {
    token, method: 'POST', status: 201,
    body: { annotation_type: 'TEXT', page_number: 1, x: 0.2, y: 0.2, payload },
  });
  assert.ok(annotation.id && annotation.download_url);
  const response = await fetch(annotation.download_url, { headers: { Origin: 'http://127.0.0.1:5176' } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), 'http://127.0.0.1:5176');
  assert.equal(await response.text(), payload);
});
await check('teacher: save grade + reject stale update + persist total', async () => {
  const token = sessions.teacher.access_token;
  const path = `/instances/${fixture.instanceId}/problems/${fixture.problemId}/grade/`;
  // This fixture owns a single problem, so its known partial grade equals total.
  const instance = await request(`/instances/${fixture.instanceId}/`, { token });
  const old_score = instance.total_score;
  const score = Number(old_score) === 7 ? '8.00' : '7.00';
  const grade = await request(path, { token, method: 'PUT', body: { score, old_score } });
  assert.equal(Number(grade.score), Number(score));
  const conflict = await request(path, { token, method: 'PUT', body: { score: '9.00', old_score }, status: 409 });
  assert.equal(conflict.error_code, 'VERSION_CONFLICT');
  assert.equal(Number((await request(`/instances/${fixture.instanceId}/`, { token })).total_score), Number(score));
});
await check('student: published result is scoped to their own exam', async () => {
  const token = sessions.publishedStudent.access_token;
  const data = await request(`/instances/${fixture.publishedInstanceId}/`, { token });
  assert.equal(Number(data.total_score), 8);
  await request(`/instances/${fixture.instanceId}/`, { token, status: 403 });
});
await check('student: restricted PDF uses the real encrypted transport', async () => {
  const session = sessions.publishedStudent;
  const response = await fetch(new URL(`/api/v1/instances/${fixture.publishedInstanceId}/download/`, origin), { headers: { Authorization: `Bearer ${session.access_token}` } });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /application\/octet-stream/);
  const bytes = new Uint8Array(await response.arrayBuffer());
  // Backend: instance_service.derive_user_key/encrypt_pdf. This check documents
  // the transport; the current grading frontend still needs this decoding step.
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`scdee-pdf-key-${session.user.id}`));
  const key = await crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['decrypt']);
  const decoded = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, key, bytes.slice(12));
  assert.equal(Buffer.from(decoded).subarray(0,5).toString(), '%PDF-');
});
await check('JWT refresh rotates tokens and logout revokes refresh', async () => {
  const session = await login(fixture.manager);
  const rotated = await request('/auth/refresh/', { method: 'POST', body: { refresh_token: session.refresh_token } });
  assert.ok(rotated.access_token && rotated.refresh_token);
  assert.notEqual(rotated.refresh_token, session.refresh_token);
  await request('/auth/logout/', { token: rotated.access_token, method: 'POST', body: { refresh_token: rotated.refresh_token }, status: 204 });
  await request('/auth/refresh/', { method: 'POST', body: { refresh_token: rotated.refresh_token }, status: 401 });
});
const report = { date: new Date().toISOString(), origin: origin.origin, checks };
await writeFile(join(dirname(fixtureFile), 'smoke-results.local.json'), JSON.stringify(report, null, 2));
console.log(`${checks.filter(c => c.passed).length}/${checks.length} real backend checks passed.`);
if (checks.some(c => !c.passed)) process.exitCode = 1;
