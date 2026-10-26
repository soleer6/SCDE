// Real Edge + Django acceptance. Prerequisite: h19-fixture.py in the b tenant.
// Playwright is provided externally; no project dependency or browser install.
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(pathToFileURL(resolve(process.env.SCDE_PLAYWRIGHT_MODULE)).href);
const fx = JSON.parse(await readFile(join(process.env.LOCALAPPDATA, 'SCDE/integration/fixtures-b.local.json'), 'utf8'));
const out = process.env.SCDE_EVIDENCE_DIR || join(process.env.TEMP, 'scde-task23-evidence');
await mkdir(out, { recursive: true });
const app = process.env.SCDE_APP_URL || 'http://127.0.0.1:5176';
const api = 'http://127.0.0.1:8000/api/v1';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const checks = [];
try {
  const context = await browser.newContext({ locale: 'es-ES', viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  await page.goto(`${app}/login`);
  await page.locator('input[type=email]').fill(fx.student);
  await page.locator('input[type=password]').fill(fx.password);
  await page.locator('button[type=submit]').click();
  await page.waitForURL(u => !u.pathname.startsWith('/login'));
  const token = await page.evaluate(() => localStorage.getItem('scde.access'));
  const get = async (path, auth = token) => {
    const response = await context.request.get(`${api}${path}`, { headers: { Authorization: `Bearer ${auth}` } });
    assert.equal(response.status(), 200);
    return response.json();
  };
  const teacherLogin = await context.request.post(`${api}/auth/login/`, { data: { email: fx.teacher, password: fx.password } });
  assert.equal(teacherLogin.status(), 200);
  const teacherToken = (await teacherLogin.json()).access_token;
  const otherBefore = await get('/notifications/count/', teacherToken);
  const archivedBefore = await get('/notifications/?status=ARCHIVED');
  const generalBefore = await get('/notifications/?status=UNREAD&notification_type=GENERAL');
  assert(generalBefore.count >= 31, 'Create a fresh H19 notification batch');
  await page.goto(`${app}/notifications`);
  await page.getByLabel('Estado de notificación').selectOption('UNREAD');
  await page.getByLabel('Tipo de notificación').selectOption('GENERAL');
  await page.waitForLoadState('networkidle');
  assert.equal(await page.locator('tbody tr').count(), generalBefore.results.length);
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/notifications/?') && new URL(r.url()).searchParams.get('page') === '2'),
    page.getByRole('button', { name: 'Siguiente', exact: true }).click(),
  ]);
  await page.getByText(/Página 2 de/).waitFor();
  await page.locator('tbody tr').first().waitFor();
  await page.waitForLoadState('networkidle');
  assert((await page.locator('tbody tr').count()) > 0);
  await page.screenshot({ path: join(out, 'H19-page2-real.png'), fullPage: true });
  checks.push('H19 real combined UNREAD/GENERAL filter and second page');
  await page.getByLabel('Tipo de notificación').selectOption('REVIEW_OPENED');
  await page.waitForLoadState('networkidle');
  assert(await page.getByRole('button', { name: 'Anterior', exact: true }).isDisabled());
  assert((await get('/notifications/?status=UNREAD&notification_type=REVIEW_OPENED')).count > 0);
  checks.push('H19 changing filter resets page');
  await page.getByRole('button', { name: 'Marcar todas como leídas', exact: true }).click();
  await page.getByText('No tienes notificaciones', { exact: true }).waitFor();
  assert.equal((await get('/notifications/count/')).unread_count, 0);
  assert.deepEqual(await get('/notifications/count/', teacherToken), otherBefore);
  assert.equal((await get('/notifications/?status=ARCHIVED')).count, archivedBefore.count);
  checks.push('H19 all account pages/types marked, other recipient and archive unchanged');
  await page.reload();
  await page.getByLabel('Estado de notificación').selectOption('UNREAD');
  await page.getByText('No tienes notificaciones', { exact: true }).waitFor();
  checks.push('H19 reload preserves read state and shows empty unread list');
  await page.getByLabel('Estado de notificación').selectOption('ARCHIVED');
  await page.waitForLoadState('networkidle');
  assert((await page.locator('tbody').innerText()).includes('Archivada'));
  await page.screenshot({ path: join(out, 'H19-archived-real.png'), fullPage: true });
  checks.push('H19 archived filter/status shown correctly');
  const subjects = await get('/my-subjects/');
  assert(subjects.length > 0);
  await page.goto(`${app}/profile`);
  const region = page.getByRole('region', { name: 'Mis asignaturas y roles' });
  await region.locator('tbody tr').first().waitFor();
  assert.equal(await region.locator('tbody tr').count(), subjects.length);
  for (const subject of subjects) {
    const row = region.getByRole('row').filter({ hasText: subject.code });
    assert((await row.innerText()).includes(subject.name));
    assert((await row.innerText()).includes({ STUDENT: 'Estudiante', TEACHER: 'Docente', COORDINATOR: 'Coordinador' }[subject.role]));
    if (subject.group_label) assert((await row.innerText()).includes(subject.group_label));
  }
  checks.push('H20 profile subjects/roles/groups match own real active-course memberships');
  await page.screenshot({ path: join(out, 'H20-profile-real.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: join(out, 'H20-profile-mobile.png'), fullPage: true });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > innerWidth).map(e => ({ tag: e.tagName, class: e.className, width: e.getBoundingClientRect().width })).slice(0, 16))));
  checks.push('H20 mobile 390px without page overflow');
  assert.deepEqual(pageErrors, []);
  await writeFile(join(out, 'result.json'), JSON.stringify({ checks, pageErrors, realBackend: true }, null, 2));
  console.log(JSON.stringify({ passed: checks.length, checks, evidence: out }, null, 2));
} finally { await browser.close(); }
