// Edge + Django acceptance. Only this task's synthetic tenant is modified.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(resolve(process.env.SCDE_PLAYWRIGHT_MODULE)).href);
const fx = JSON.parse((await readFile(join(process.env.LOCALAPPDATA, 'SCDE/integration/fixtures-a-h01.local.json'), 'utf8')).trimStart());
const api = 'http://127.0.0.1:8000/api/v1';
const app = process.env.SCDE_APP_URL || 'http://127.0.0.1:5176';
const out = process.env.SCDE_EVIDENCE_DIR || join(process.env.TEMP, 'scde-h01-evidence');
await mkdir(out, { recursive: true });
async function login(email, password) {
  const r = await fetch(`${api}/auth/login/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  assert.equal(r.status, 200); return r.json();
}
const manager = await login(fx.manager, fx.managerPassword);
async function patch(path, body) {
  const r = await fetch(`${api}${path}`, { method: 'PATCH', headers: { Authorization: `Bearer ${manager.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal(r.status, 200); return r.json();
}
const permissions = (value) => patch(`/memberships/${fx.membershipId}/permissions/`, { permissions: { can_create_exams: value, can_create_rubric: false, can_assign_correctors: false } });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const checks = [], errors = [];
let context;
async function signedContext(role, password = fx.password) {
  const data = await login(fx[role], password);
  const ctx = await browser.newContext({ locale: 'es-ES', viewport: { width: 1366, height: 900 } });
  await ctx.addInitScript(({ data }) => {
    localStorage.setItem('scde.access', data.access_token); localStorage.setItem('scde.refresh', data.refresh_token);
    localStorage.setItem('scde.user', JSON.stringify({ id: data.user.id, organizationId: data.user.organization_id, firstName: data.user.first_name, lastName: data.user.last_name, isStaff: false }));
    localStorage.setItem('scde.lang', 'es');
  }, { data });
  return ctx;
}
try {
  await patch('/config/', { role_permission_defaults: {} }); await permissions(false);
  context = await signedContext('teacher');
  const page = await context.newPage(); page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${app}/subjects/${fx.subjectId}`);
  const ready = () => page.getByRole('table', { name: 'Exámenes', exact: true }).waitFor();
  const create = page.getByRole('button', { name: 'Nuevo examen', exact: true });
  const refocus = async () => {
    await Promise.all([page.waitForResponse((r) => r.url().endsWith('/my-subjects/') && r.status() === 200), page.evaluate(() => window.dispatchEvent(new Event('focus')))]);
    await ready();
  };
  await ready(); assert.equal(await create.count(), 0);
  await permissions(true); await refocus(); await create.click();
  await page.getByRole('dialog').waitFor();
  await permissions(false); await refocus();
  assert.equal(await create.count(), 0); assert.equal(await page.getByRole('dialog').count(), 0);
  checks.push('concesión y revocación reales: botón y diálogo retirados al refoco');
  await patch('/config/', { role_permission_defaults: { TEACHER: { can_create_exams: true } } });
  await permissions(null); await refocus(); await create.waitFor();
  await patch('/config/', { role_permission_defaults: { TEACHER: { can_create_exams: false } } });
  await refocus(); assert.equal(await create.count(), 0);
  checks.push('default organizativo vivo + null hereda, sin fallback del rol');
  await page.goto(`${app}/exams/${fx.examId}/setup`);
  await page.getByText('No tienes permisos para configurar este examen', { exact: true }).waitFor();
  await permissions(true);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.getByRole('tab', { name: 'Datos', exact: true }).waitFor();
  await page.goto(`${app}/subjects/${fx.subjectId}`); await ready();
  await page.setViewportSize({ width: 360, height: 800 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: join(out, 'H01-grant-mobile360.png'), fullPage: true });
  checks.push('guard directo de configuración y móvil360 sin overflow');
  // Hold the next discovery response to inspect the loading state, then simulate a
  // transport error; all other checks use actual Django responses without routing.
  let release, started;
  const waiting = new Promise((r) => { started = r; });
  await page.route('**/api/v1/my-subjects/', async (route) => { started(); await new Promise((r) => { release = r; }); await route.fulfill({ status: 503, contentType: 'application/json', body: '{"error_code":"SERVER_ERROR"}' }); });
  await page.evaluate(() => window.dispatchEvent(new Event('focus'))); await waiting;
  assert.equal(await create.count(), 0); release();
  await page.getByRole('button', { name: 'Reintentar', exact: true }).waitFor();
  assert.equal(await create.count(), 0);
  await page.unroute('**/api/v1/my-subjects/');
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click(); await create.waitFor();
  checks.push('carga/error 503 inducido deniegan controles, reintento HTTP real recupera');
  assert.match(fx.membershipId, /^[a-f0-9-]{36}$/); assert.match(fx.organizationId, /^[a-f0-9-]{36}$/);
  const active = (value) => execFileSync('docker', ['exec', '-e', 'PYTHONPATH=/app:/runtime', 'scde-integration-api-1', 'python', '-c',
    `import django; django.setup(); from apps.subjects.models.subjects import SubjectMembership; assert SubjectMembership.unfiltered.filter(pk='${fx.membershipId}', organization_id='${fx.organizationId}', subject__code='H01').update(is_active=${value}) == 1`]);
  try { active('False'); await refocus(); assert.equal(await create.count(), 0); }
  finally { active('True'); }
  await refocus(); await create.waitFor();
  checks.push('membresía inactiva retira controles; restauración y refoco recuperan');
  await context.close(); context = await signedContext('foreign', fx.foreignPassword);
  const foreign = await context.newPage();
  await foreign.goto(`${app}/subjects/${fx.subjectId}`);
  await foreign.getByRole('button', { name: 'Reintentar', exact: true }).waitFor();
  assert.equal(await foreign.getByRole('button', { name: 'Nuevo examen' }).count(), 0);
  await foreign.screenshot({ path: join(out, 'H01-foreign-denied.png'), fullPage: true });
  checks.push('tenant extranjero: 404 real, sin controles ni datos ajenos');
  assert.deepEqual(errors, []);
  await writeFile(join(out, 'browser-result.json'), JSON.stringify({ checks, errors, induced: ['503 discovery response only'], app }, null, 2));
  console.log(JSON.stringify({ checks: checks.length, errors: errors.length }));
} finally {
  await patch('/config/', { role_permission_defaults: {} });
  await patch(`/memberships/${fx.membershipId}/permissions/`, { permissions: { can_create_exams: null, can_create_rubric: null, can_assign_correctors: null } });
  await browser.close();
}
