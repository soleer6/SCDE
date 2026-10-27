// Edge + real Django, dedicated synthetic accounts; no project dependency.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(resolve(process.env.SCDE_PLAYWRIGHT_MODULE)).href);
const runtime = join(process.env.LOCALAPPDATA, 'SCDE/integration');
const platform = JSON.parse(await readFile(join(runtime, 'fixtures-b-h17.local.json'), 'utf8'));
const tenant = JSON.parse(await readFile(join(runtime, 'fixtures-b.local.json'), 'utf8'));
const out = process.env.SCDE_EVIDENCE_DIR || join(process.env.TEMP, 'scde-h17-evidence');
await mkdir(out, { recursive: true });
const app = process.env.SCDE_APP_URL || 'http://127.0.0.1:5176';
const api = 'http://127.0.0.1:8000/api/v1';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const checks = [];
const errors = [];
async function login(email, password) {
  const context = await browser.newContext({ locale: 'es-ES', viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${app}/login`);
  await page.locator('input[type=email]').fill(email);
  await page.locator('input[type=password]').fill(password);
  await page.locator('button[type=submit]').click();
  await page.waitForURL(u => !u.pathname.startsWith('/login'));
  const token = await page.evaluate(() => localStorage.getItem('scde.access'));
  return { context, page, token };
}
const subdomain = `h17-${Date.now()}`;
const initialEmail = `manager-${subdomain}@scde.local`;
const body = { name: 'Campus sintético H17', subdomain, plan: 'FREE', initial_manager: {
  email: initialEmail, first_name: 'H17', last_name: 'Manager',
} };
try {
  const regular = await login(tenant.manager, tenant.password);
  await regular.page.goto(`${app}/admin/organizations`);
  await regular.page.getByText('Solo los superadministradores pueden crear organizaciones.', { exact: true }).waitFor();
  assert.equal(await regular.page.locator('form').count(), 0);
  const denied = await regular.context.request.post(`${api}/organizations/`, { headers: { Authorization: `Bearer ${regular.token}` }, data: body });
  assert.equal(denied.status(), 403);
  const deniedBody = await denied.json();
  checks.push(`H17 normal manager: direct UI denied, real POST 403/${deniedBody.error_code}`);
  const superadmin = await login(platform.superadmin, platform.password);
  const { page, context, token } = superadmin;
  await page.goto(`${app}/admin/organizations`);
  const fill = async email => {
    for (const [label, value] of [['Nombre de la organización', body.name], ['Subdominio', subdomain],
      ['Email del gestor inicial', email], ['Nombre del gestor inicial', 'H17'], ['Apellidos del gestor inicial', 'Manager']]) {
      await page.getByLabel(label, { exact: true }).fill(value);
    }
  };
  await fill('a@b'); // HTML email accepts this, Django validates it as invalid.
  const invalid = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/organizations/'));
  await page.getByRole('button', { name: 'Crear organización', exact: true }).click();
  const invalidResponse = await invalid;
  assert.equal(invalidResponse.status(), 400);
  assert((await invalidResponse.json()).errors['initial_manager.email']);
  await page.waitForFunction(() => document.activeElement?.getAttribute('type') === 'email' && document.activeElement?.getAttribute('aria-invalid') === 'true');
  assert.equal(await page.getByLabel('Subdominio', { exact: true }).inputValue(), subdomain);
  checks.push('H17 real nested manager validation: dotted field mapped, focus and draft preserved');
  await page.screenshot({ path: join(out, 'H17-validation-real.png'), fullPage: true });
  // The corrected backend reports a field conflict and rolls back atomically.
  await page.getByLabel('Email del gestor inicial', { exact: true }).fill(tenant.manager);
  const existingEmailResponse = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/organizations/'));
  await page.getByRole('button', { name: 'Crear organización', exact: true }).click();
  const existingEmail = await existingEmailResponse;
  assert.equal(existingEmail.status(), 409);
  const emailConflict = await existingEmail.json();
  assert.equal(emailConflict.error_code, 'EMAIL_ALREADY_EXISTS');
  assert.deepEqual(emailConflict.errors['initial_manager.email'], ['EMAIL_ALREADY_EXISTS']);
  await page.waitForFunction(() => document.activeElement?.getAttribute('type') === 'email' && document.activeElement?.getAttribute('aria-invalid') === 'true');
  await page.getByRole('button', { name: 'Crear organización', exact: true }).waitFor({ state: 'visible' });
  assert.equal(await page.getByRole('region', { name: 'Organización creada' }).count(), 0);
  assert.equal(await page.getByLabel('Subdominio', { exact: true }).inputValue(), subdomain);
  checks.push('H17 existing manager email: 409 EMAIL_ALREADY_EXISTS, focused field, no false success and editable draft retained');
  await page.getByLabel('Email del gestor inicial', { exact: true }).fill(initialEmail);
  const createdResponse = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/organizations/'));
  await page.getByRole('button', { name: 'Crear organización', exact: true }).click();
  const response = await createdResponse;
  assert.equal(response.status(), 201);
  const org = await response.json();
  assert.deepEqual(Object.keys(org).sort(), ['auth_mode', 'created_at', 'id', 'is_active', 'name', 'plan', 'subdomain'].sort());
  assert.equal(org.subdomain, subdomain);
  await page.getByRole('region', { name: 'Organización creada' }).waitFor();
  await page.screenshot({ path: join(out, 'H17-created-real.png'), fullPage: true });
  const usersResponse = await context.request.get(`${api}/users/?search=${encodeURIComponent(initialEmail)}`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(usersResponse.status(), 200);
  const manager = (await usersResponse.json()).results.find(u => u.email === initialEmail);
  assert(manager);
  assert.equal(manager.organization_id, org.id);
  assert.equal(manager.is_staff, true);
  assert.equal(manager.is_active, true);
  assert(!('password' in manager));
  checks.push('H17 201 response matches contract and initial active manager belongs to the new organization');
  const foreign = await regular.context.request.get(`${api}/users/${manager.id}/`, { headers: { Authorization: `Bearer ${regular.token}` } });
  assert.equal(foreign.status(), 404);
  checks.push('H17 tenant isolation: original manager cannot retrieve new organization manager (404)');
  await page.getByRole('button', { name: 'Crear otra organización', exact: true }).click();
  assert.equal(await page.getByLabel('Nombre de la organización', { exact: true }).inputValue(), '');
  await fill(`duplicate-${initialEmail}`);
  const duplicateResponse = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/organizations/'));
  await page.getByRole('button', { name: 'Crear organización', exact: true }).click();
  const duplicate = await duplicateResponse;
  assert.equal(duplicate.status(), 409);
  assert.equal((await duplicate.json()).error_code, 'SUBDOMAIN_ALREADY_EXISTS');
  await page.waitForFunction(() => document.activeElement?.getAttribute('aria-invalid') === 'true');
  assert.equal(await page.getByLabel('Subdominio', { exact: true }).inputValue(), subdomain);
  const rolledBack = await context.request.get(`${api}/users/?search=${encodeURIComponent(`duplicate-${initialEmail}`)}`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal((await rolledBack.json()).count, 0);
  checks.push('H17 duplicate subdomain: 409, focused error, preserved draft and no extra manager');
  await page.setViewportSize({ width: 360, height: 844 });
  await page.screenshot({ path: join(out, 'H17-mobile-real.png'), fullPage: true });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  checks.push('H17 mobile 360px without page overflow');
  assert.deepEqual(errors, []);
  await writeFile(join(out, 'result.json'), JSON.stringify({ checks, pageErrors: errors, realBackend: true }, null, 2));
  console.log(JSON.stringify({ passed: checks.length, checks, evidence: out }, null, 2));
} finally { await browser.close(); }
