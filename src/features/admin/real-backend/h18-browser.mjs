// Real Edge/Django acceptance for the synthetic archive. No destructive requests.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(resolve(process.env.SCDE_PLAYWRIGHT_MODULE)).href);
const runtime = join(process.env.LOCALAPPDATA, 'SCDE/integration');
const base = JSON.parse(await readFile(join(runtime, 'fixtures-b.local.json'), 'utf8'));
const fx = JSON.parse(await readFile(join(runtime, 'fixtures-b-h18.local.json'), 'utf8'));
assert.equal(fx.organizationId, base.organizationId);
const out = process.env.SCDE_EVIDENCE_DIR || join(process.env.TEMP, 'scde-h18-evidence');
await mkdir(out, { recursive: true });
const app = process.env.SCDE_APP_URL || 'http://127.0.0.1:5176';
const api = 'http://127.0.0.1:8000/api/v1';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const checks = [], probes = [], errors = [];
try {
  const context = await browser.newContext({ locale: 'es-ES', viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${app}/login`);
  await page.locator('input[type=email]').fill(base.manager);
  await page.locator('input[type=password]').fill(base.password);
  await page.locator('button[type=submit]').click();
  await page.waitForURL(url => !url.pathname.startsWith('/login'));
  const token = await page.evaluate(() => localStorage.getItem('scde.access'));
  const headers = { Authorization: `Bearer ${token}` };
  const writes = [];
  page.on('request', request => {
    if (request.url().startsWith(api) && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) writes.push(`${request.method()} ${new URL(request.url()).pathname}`);
  });
  await page.goto(`${app}/admin/courses`);
  const row = page.getByRole('row').filter({ hasText: fx.courseLabel });
  await row.waitFor();
  assert(await row.getByRole('button', { name: 'Editar curso', exact: true }).isDisabled());
  await row.getByRole('link', { name: 'Consultar', exact: true }).click();
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/search/?') && new URL(r.url()).searchParams.get('subject_id') === fx.subjectId),
    page.getByRole('button', { name: 'Consultar Asignatura histórica H18', exact: true }).click(),
  ]);
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/search/?') && new URL(r.url()).searchParams.get('exam_id') === fx.examId),
    page.getByRole('button', { name: 'Consultar Examen histórico H18', exact: true }).click(),
  ]);
  await page.locator('tbody tr').first().waitFor();
  assert.equal(await page.locator('tbody tr').count(), 25);
  assert.equal(await page.getByRole('button', { name: 'Guardar', exact: true }).count(), 0);
  checks.push('H18 archived course link with editing disabled, complete course/subject/exam/instance navigation');
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/search/?') && new URL(r.url()).searchParams.get('page') === '2'),
    page.getByRole('button', { name: 'Siguiente', exact: true }).click(),
  ]);
  await page.locator('tbody tr').first().waitFor();
  assert.equal(await page.locator('tbody tr').count(), 3);
  await page.screenshot({ path: join(out, 'H18-page2-real.png'), fullPage: true });
  checks.push('H18 real second page: 25 + 3 historical instances');
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/search/?') && new URL(r.url()).searchParams.get('has_issues') === 'true'),
    page.getByLabel('Incidencias', { exact: true }).selectOption('true'),
  ]);
  await page.getByRole('button', { name: `Consultar ${base.student}`, exact: true }).waitFor();
  assert(await page.getByRole('button', { name: 'Anterior', exact: true }).isDisabled());
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/search/?') && new URL(r.url()).searchParams.get('status') === 'ARCHIVED'),
    page.getByLabel('Estado', { exact: true }).selectOption('ARCHIVED'),
  ]);
  await page.getByLabel('Buscar en este nivel').fill(base.student);
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/search/?') && new URL(r.url()).searchParams.get('search') === base.student),
    page.getByRole('button', { name: 'Buscar', exact: true }).click(),
  ]);
  await page.getByRole('button', { name: `Consultar ${base.student}`, exact: true }).click();
  const dialog = page.getByRole('dialog');
  assert((await dialog.innerText()).includes(fx.instanceId));
  assert((await dialog.innerText()).includes('0.00'));
  assert.equal(await dialog.locator('input,select,textarea').count(), 0);
  await page.screenshot({ path: join(out, 'H18-instance-real.png'), fullPage: true });
  checks.push('H18 combined search/status/issues and read-only terminal detail with zero grade preserved');
  await page.setViewportSize({ width: 360, height: 844 });
  await page.screenshot({ path: join(out, 'H18-mobile-real.png'), fullPage: true });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: `Consultar ${base.student}`, exact: true }).waitFor();
  assert.equal(await page.getByLabel('Estado', { exact: true }).inputValue(), 'ARCHIVED');
  assert.equal(await page.getByLabel('Incidencias', { exact: true }).inputValue(), 'true');
  await page.getByRole('link', { name: 'Asignatura histórica H18', exact: true }).click();
  await page.getByRole('button', { name: 'Consultar Examen histórico H18', exact: true }).waitFor();
  await page.goBack();
  await page.getByRole('button', { name: `Consultar ${base.student}`, exact: true }).waitFor();
  assert.equal(await page.getByLabel('Buscar en este nivel').inputValue(), base.student);
  checks.push('H18 reload/browser back retain hierarchy and filters; mobile 360px without page overflow');
  await page.getByLabel('Buscar en este nivel').fill('no-such-historical-record');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await page.getByText('No hay resultados en este nivel', { exact: true }).waitFor();
  assert.deepEqual(writes, []);
  checks.push('H18 empty state and zero UI writes across the entire historical journey');
  const foreign = JSON.parse(await readFile(join(runtime, 'fixtures.local.json'), 'utf8'));
  assert.notEqual(foreign.organizationId, fx.organizationId);
  const foreignSearch = await context.request.get(`${api}/search/?exam_id=${foreign.examId}`, { headers });
  assert.equal(foreignSearch.status(), 200);
  assert.equal((await foreignSearch.json()).count, 0);
  const studentLogin = await context.request.post(`${api}/auth/login/`, { data: { email: base.student, password: base.password } });
  assert.equal(studentLogin.status(), 200);
  const studentToken = (await studentLogin.json()).access_token;
  const denied = await context.request.get(`${api}/search/?exam_id=${fx.examId}`, { headers: { Authorization: `Bearer ${studentToken}` } });
  assert.equal(denied.status(), 403);
  assert(!('results' in await denied.json()));
  checks.push('H18 real isolation: foreign tenant exam returns empty results, student search denied 403');

  // Direct HTTP probes use this newly created synthetic archive only, after
  // recording the read-only UI journey. No DELETE, transitions or purges.
  for (const [name, path, data] of [
    ['course', `/courses/${fx.courseId}/`, { label: fx.courseLabel }],
    ['subject', `/subjects/${fx.subjectId}/`, { name: 'Asignatura histórica H18' }],
    ['exam', `/exams/${fx.examId}/`, { name: 'Examen histórico H18' }],
  ]) {
    const response = await context.request.patch(`${api}${path}`, { headers, data });
    const result = await response.json();
    assert([403, 409].includes(response.status()), `${name}: ${response.status()} ${result.error_code}`);
    if (response.status() === 409) assert.equal(result.error_code, 'COURSE_ARCHIVED');
    probes.push({ entity: name, status: response.status(), code: result.error_code, rejected: true });
  }
  const response = await context.request.patch(`${api}/instances/${fx.instanceId}/`, { headers, data: { model_id: fx.alternateModelId } });
  if (response.status() === 200) {
    const persisted = await context.request.get(`${api}/instances/${fx.instanceId}/`, { headers });
    assert.equal((await persisted.json()).model_id, fx.alternateModelId);
    const restore = await context.request.patch(`${api}/instances/${fx.instanceId}/`, { headers, data: { model_id: fx.modelId } });
    assert.equal(restore.status(), 200);
    const restored = await context.request.get(`${api}/instances/${fx.instanceId}/`, { headers });
    assert.equal((await restored.json()).model_id, fx.modelId);
    probes.push({ entity: 'instance', status: 200, rejected: false, persistedChange: true, originalModelRestored: true });
  } else {
    assert.equal(response.status(), 409);
    assert.equal((await response.json()).error_code, 'COURSE_ARCHIVED');
    probes.push({ entity: 'instance', status: 409, code: 'COURSE_ARCHIVED', rejected: true });
  }
  checks.push('H18 direct archive probes: course/subject/exam reject writes (403/409); instance result recorded separately');
  assert.deepEqual(errors, []);
  await writeFile(join(out, 'result.json'), JSON.stringify({ checks, pageErrors: errors, uiWrites: writes, probes,
    backendArchiveGuardComplete: probes.every(p => p.rejected), realBackend: true }, null, 2));
  console.log(JSON.stringify({ passed: checks.length, checks, probes, evidence: out }, null, 2));
} finally { await browser.close(); }
