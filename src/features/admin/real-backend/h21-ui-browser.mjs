// Real Edge + Django CSV/JSON/UI acceptance; credentials never leave runtime.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(resolve(process.env.SCDE_PLAYWRIGHT_MODULE)).href);
const runtime = join(process.env.LOCALAPPDATA, 'SCDE/integration');
const base = JSON.parse(await readFile(join(runtime, 'fixtures-b.local.json'), 'utf8'));
const fx = JSON.parse(await readFile(join(runtime, 'fixtures-b-h21-ui.local.json'), 'utf8'));
assert.equal(fx.organizationId, base.organizationId);
const app = process.env.SCDE_APP_URL || 'http://127.0.0.1:5176';
const api = 'http://127.0.0.1:8000/api/v1';
const out = process.env.SCDE_EVIDENCE_DIR || join(process.env.TEMP, 'scde-task23-final-H21');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const checks = [], errors = [];
let restore;
// A minimal CSV reader for quoted commas, quotes and newlines in real downloads.
function parseCsv(text) {
  const rows = []; let row = [], value = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"' && quoted && text[i + 1] === '"') { value += '"'; i++; }
    else if (ch === '"') quoted = !quoted;
    else if (!quoted && (ch === ',' || ch === '\n')) {
      row.push(value.replace(/\r$/, '')); value = '';
      if (ch === '\n') { rows.push(row); row = []; }
    } else value += ch;
  }
  if (value || row.length) { row.push(value); rows.push(row); }
  return rows;
}
try {
  const context = await browser.newContext({ locale: 'es-ES', acceptDownloads: true, viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', err => errors.push(err.message));
  await page.goto(`${app}/login`);
  await page.locator('input[type=email]').fill(base.manager);
  await page.locator('input[type=password]').fill(base.password);
  await page.locator('button[type=submit]').click();
  await page.waitForURL(url => !url.pathname.startsWith('/login'));
  const token = await page.evaluate(() => localStorage.getItem('scde.access'));
  const headers = { Authorization: `Bearer ${token}` };
  const apply = async expectedSearch => {
    const response = page.waitForResponse(r => r.url().includes('/users/?') && new URL(r.url()).searchParams.get('search') === expectedSearch);
    await page.getByRole('button', { name: 'Buscar', exact: true }).click();
    const result = await response; assert.equal(result.status(), 200); return result.json();
  };
  const download = async () => {
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exportar usuarios', exact: true }).click();
    const file = await pending;
    return { name: file.suggestedFilename(), text: await readFile(await file.path(), 'utf8') };
  };
  await page.goto(`${app}/admin/users`);
  await page.getByLabel('Buscar usuarios', { exact: true }).fill(fx.tag);
  await page.getByLabel('Estado de cuenta').selectOption('false');
  await page.getByLabel('Tipo de usuario').selectOption('false');
  await page.getByLabel('Filtrar por email').fill('@scde.local');
  assert.equal((await apply(fx.tag)).count, fx.count);
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/users/?') && new URL(r.url()).searchParams.get('page') === '2'),
    page.getByRole('button', { name: 'Siguiente', exact: true }).click(),
  ]);
  await page.locator('tbody tr').first().waitFor();
  assert.equal(await page.locator('tbody tr').count(), 6);
  checks.push('H21 server filters with false/AND apply before pagination (31 matches, 25+6)');
  await page.getByLabel('Formato de exportación').selectOption('csv');
  await page.reload();
  await page.locator('tbody tr').first().waitFor();
  assert.equal(await page.getByLabel('Estado de cuenta').inputValue(), 'false');
  assert.equal(await page.getByLabel('Formato de exportación').inputValue(), 'csv');
  assert.equal(new URL(page.url()).searchParams.get('page'), '2');
  const csv = await download();
  assert.equal(csv.name, 'users.csv');
  const table = parseCsv(csv.text);
  assert.equal(table.length, fx.count + 1);
  assert.deepEqual(table[0], ['first_name', 'last_name', 'email', 'dni', 'nia', 'is_active', 'is_staff']);
  assert(table.slice(1).every(row => row[5] === 'False' && row[6] === 'False'));
  assert(table.some(row => row[1] === 'Coma, "Texto"'));
  await page.screenshot({ path: join(out, 'H21-users-desktop-real.png'), fullPage: true });
  checks.push('H21 reload preserves page/filters/format and CSV includes all 31 matches with quoted fields');
  await page.getByLabel('Buscar usuarios', { exact: true }).fill('unapplied-draft');
  await page.getByLabel('Formato de exportación').selectOption('json');
  const json = await download();
  assert.equal(json.name, 'users.json');
  const rows = JSON.parse(json.text);
  assert.equal(rows.length, fx.count);
  assert(rows.every(row => row.is_active === false && row.is_staff === false));
  assert.deepEqual(rows.map(row => row.email).sort(), table.slice(1).map(row => row[2]).sort());
  checks.push('H21 JSON and CSV contain identical full filtered set; unapplied draft cannot change export');
  await page.getByLabel('Buscar usuarios', { exact: true }).fill(fx.tag);
  await page.getByLabel('Filtrar por NIA').fill(fx.nia.toLowerCase());
  const one = await apply(fx.tag);
  assert.equal(one.count, 1);
  const target = one.results[0];
  assert.equal(target.email, fx.email);
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/users/?') && new URL(r.url()).searchParams.get('page') === '2'),
    page.goBack(),
  ]);
  await page.locator('tbody tr').first().waitFor();
  assert.equal(await page.locator('tbody tr').count(), 6);
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/users/?') && new URL(r.url()).searchParams.get('nia') === fx.nia.toLowerCase()),
    page.goForward(),
  ]);
  await page.getByRole('button', { name: 'Editar usuario', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Editar usuario', exact: true }).click();
  await page.getByLabel('Nuevo DNI (opcional)').waitFor();
  assert.equal(await page.getByLabel('Nuevo DNI (opcional)').inputValue(), '');
  const saved = page.waitForResponse(r => r.request().method() === 'PATCH' && r.url().endsWith(`/users/${target.id}/`));
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  assert.equal((await saved).status(), 200);
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.locator('tbody tr').first().waitFor();
  const unchanged = JSON.parse((await download()).text)[0];
  const initialDni = rows.find(row => row.email === fx.email).dni;
  assert.equal(unchanged.dni, initialDni);
  const newDni = initialDni === fx.newDni ? fx.oldDni : fx.newDni;
  await page.getByRole('button', { name: 'Editar usuario', exact: true }).click();
  await page.getByLabel('Nuevo DNI (opcional)').fill(newDni);
  restore = async () => {
    const result = await context.request.patch(`${api}/users/${target.id}/`, { headers, data: { dni: initialDni } });
    assert.equal(result.status(), 200);
  };
  const changed = page.waitForResponse(r => r.request().method() === 'PATCH' && r.url().endsWith(`/users/${target.id}/`));
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  assert.equal((await changed).status(), 200);
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.locator('tbody tr').first().waitFor();
  assert.equal(JSON.parse((await download()).text)[0].dni, newDni);
  checks.push('H21 all five filters combine, NIA matches case-insensitively; blank DNI preserves and explicit new DNI persists');
  await page.setViewportSize({ width: 360, height: 844 });
  await page.screenshot({ path: join(out, 'H21-mobile-real.png'), fullPage: true });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  checks.push('H21 mobile 360px without page overflow');
  const invalid = new URL(page.url()); invalid.searchParams.set('is_active', 'invalid');
  await page.goto(invalid.href);
  const alert = page.getByRole('alert'); await alert.waitFor();
  assert((await alert.innerText()).includes('Estado de cuenta'));
  assert(!(await alert.innerText()).includes('Use true or false.'));
  assert(await page.getByRole('button', { name: 'Exportar usuarios', exact: true }).isDisabled());
  const invalidExport = await context.request.get(`${api}/users/export/?is_active=invalid&export_format=json`, { headers });
  assert.equal(invalidExport.status(), 400);
  assert.equal((await invalidExport.json()).error_code, 'INVALID_FILTER');
  assert.equal(invalidExport.headers()['content-disposition'], undefined);
  await page.screenshot({ path: join(out, 'H21-invalid-filter-real.png'), fullPage: true });
  checks.push('H21 real INVALID_FILTER localized, invalid list prevents UI export and API export produces no attachment');
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/users/?') && !new URL(r.url()).searchParams.has('is_active') && !new URL(r.url()).searchParams.has('search')),
    page.getByRole('button', { name: 'Limpiar filtros', exact: true }).click(),
  ]);
  await page.locator('tbody tr').first().waitFor();
  await page.getByLabel('Buscar usuarios', { exact: true }).fill(`no-match-${fx.tag}`);
  assert.equal((await apply(`no-match-${fx.tag}`)).count, 0);
  await page.getByText('No hay registros', { exact: true }).waitFor();
  assert.deepEqual(JSON.parse((await download()).text), []);
  await page.getByLabel('Formato de exportación').selectOption('csv');
  assert.equal(parseCsv((await download()).text).length, 1);
  checks.push('H21 empty list exports empty JSON and CSV header only with identical criteria');
  assert.deepEqual(errors, []);
  await writeFile(join(out, 'result.json'), JSON.stringify({ checks, pageErrors: errors, realBackend: true }, null, 2));
  console.log(JSON.stringify({ passed: checks.length, checks, evidence: out }, null, 2));
} finally { try { if (restore) await restore(); } finally { await browser.close(); } }
