import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

// HTTP evidence for the running API, including uncommitted #1 when loaded.
// This does not validate the grading/results UI or close backend task #1.
const fixture = JSON.parse(await readFile(process.env.SCDE_FIXTURE_FILE || join(process.env.LOCALAPPDATA, 'SCDE/integration/fixtures-codex.local.json'), 'utf8'));
const origin = new URL(process.env.SCDE_REAL_API || 'http://127.0.0.1:8000');
assert.ok(['localhost', '127.0.0.1'].includes(origin.hostname));
const checks = [];
const pending = ['Backend #1 remains uncommitted/unvalidated; running API results do not certify its committed implementation.', 'Grading UI still hydrates grades from browser storage; HTTP persistence does not close the frontend journey.', 'No visual browser review performed.'];
const sessions = {};
async function request(path, role, method = 'GET', body, expected = 200, attempt = 0) {
  const response = await fetch(new URL(`/api/v1${path}`, origin), {
    method, headers: { 'Content-Type': 'application/json', ...(sessions[role] ? { Authorization: `Bearer ${sessions[role].access_token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000),
  });
  const data = await response.json();
  // Respect the real login throttle; never disable it or change identities/IPs.
  if (response.status === 429 && attempt < 2) {
    const seconds = Number(response.headers.get('retry-after'));
    if (Number.isFinite(seconds) && seconds > 0 && seconds <= 60) {
      console.log(`HTTP 429: waiting ${seconds}s as requested by the API`);
      await new Promise(resolve => setTimeout(resolve, seconds * 1000));
      return request(path, role, method, body, expected, attempt + 1);
    }
  }
  assert.equal(response.status, expected, `${method} ${path}: HTTP ${response.status}, code=${data.error_code || 'none'}`);
  return data;
}
async function check(name, run) {
  try { await run(); checks.push({ name, passed: true }); console.log(`OK ${name}`); }
  catch (error) { checks.push({ name, passed: false, error: error.message }); console.error(`FAIL ${name}: ${error.message}`); }
}
for (const role of ['manager', 'teacher', 'student', 'publishedStudent']) {
  sessions[role] = await request('/auth/login/', role, 'POST', { email: fixture[role], password: fixture.password });
  assert.equal(sessions[role].user.organization_id, fixture.organizationId);
}
let teacherGrade;
await check('teacher: persisted partial grade visible in an independent JWT session', async () => {
  const first = await request(`/instances/${fixture.instanceId}/`, 'teacher');
  teacherGrade = first.grades?.find(grade => grade.problem_id === fixture.problemId);
  assert.ok(teacherGrade, 'No persisted per-problem grade exposed; run smoke.mjs first, then resolve backend #1 if still absent');
  const second = await request('/auth/login/', 'teacher', 'POST', { email: fixture.teacher, password: fixture.password });
  assert.equal(second.user.organization_id, fixture.organizationId);
  sessions.teacher = second;
  const reread = await request(`/instances/${fixture.instanceId}/`, 'teacher');
  assert.equal(reread.grades.find(grade => grade.problem_id === fixture.problemId).score, teacherGrade.score);
});
await check('teacher: missing old_score on an existing grade conflicts without changing it', async () => {
  assert.ok(teacherGrade);
  const response = await request(`/instances/${fixture.instanceId}/problems/${fixture.problemId}/grade/`, 'teacher', 'PUT', { score: teacherGrade.score, old_score: null }, 409);
  assert.equal(response.error_code, 'VERSION_CONFLICT');
  const reread = await request(`/instances/${fixture.instanceId}/`, 'teacher');
  assert.equal(reread.grades.find(grade => grade.problem_id === fixture.problemId).score, teacherGrade.score);
});
await check('student: real published breakdown identifies the problem during the open review', async () => {
  const review = await request(`/exams/${fixture.examId}/review/`, 'publishedStudent');
  assert.equal(review.status, 'OPEN');
  const instance = await request(`/instances/${fixture.publishedInstanceId}/`, 'publishedStudent');
  assert.equal(instance.status, 'IN_REVIEW');
  assert.ok((instance.rubric ?? instance.grades ?? []).some(problem => problem.problem_id === fixture.problemId), 'ReviewRequestForm cannot select a real problem without backend #1 identifiers');
});
await check('student: submit real review request, persist across login and deduplicate', async () => {
  const path = `/instances/${fixture.publishedInstanceId}/review-requests/`;
  const before = await request(path, 'publishedStudent');
  const existing = before.find(item => item.problem_id === fixture.problemId);
  const body = { problems: [{ problem_id: fixture.problemId, message: 'Validación sintética del recorrido P1.' }] };
  const created = await request(path, 'publishedStudent', 'POST', body, 201);
  assert.equal(created.length, existing ? 0 : 1);
  const next = await request('/auth/login/', 'publishedStudent', 'POST', { email: fixture.publishedStudent, password: fixture.password });
  assert.equal(next.user.organization_id, fixture.organizationId);
  sessions.publishedStudent = next;
  const persisted = (await request(path, 'publishedStudent')).find(item => item.problem_id === fixture.problemId);
  assert.ok(persisted?.id);
  assert.equal(persisted.id, existing?.id ?? created[0].id);
  assert.deepEqual(await request(path, 'publishedStudent', 'POST', body, 201), []);
  if (existing) pending.push('Review request already existed: this run proves read/deduplication, not creation of a new row.');
});
await check('student: another student sees no requests and cannot submit on this instance', async () => {
  const path = `/instances/${fixture.publishedInstanceId}/review-requests/`;
  assert.deepEqual(await request(path, 'student'), []);
  const denied = await request(path, 'student', 'POST', { problems: [{ problem_id: fixture.problemId }] }, 409);
  assert.equal(denied.error_code, 'NOT_INSTANCE_OWNER');
});
await writeFile(resolve('src/features/admin/real-backend/core-journeys-results.local'), JSON.stringify({ date: new Date().toISOString(), organizationId: fixture.organizationId, checks, pending }, null, 2));
console.log(`${checks.filter(check => check.passed).length}/${checks.length} HTTP core checks passed; frontend and committed backend #1 remain separate.`);
if (checks.some(check => !check.passed)) process.exitCode = 1;
