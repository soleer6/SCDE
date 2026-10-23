import { chromium } from 'playwright-core';
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
export const APP = 'http://localhost:5173';
export const OUT = process.env.SHOTS || join(process.env.TEMP, 'scde-pw', 'shots');
mkdirSync(OUT, { recursive: true });
export function fixture(name = 'fixtures-claude.local.json') {
  return JSON.parse(readFileSync(join(process.env.LOCALAPPDATA, 'SCDE/integration', name), 'utf8').trimStart());
}
export async function browser() {
  return chromium.launch({ channel: 'msedge', headless: true });
}
export async function session(b, fx, role, opts = {}) {
  const ctx = await b.newContext({ viewport: { width: 1366, height: 860 }, locale: 'es-ES', ...opts });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[${role}] ${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => logs.push(`[${role}] pageerror: ${e.message}`));
  page.on('response', (r) => { if (r.status() >= 400 && r.url().includes(':8000')) logs.push(`[${role}] HTTP ${r.status()} ${r.request().method()} ${r.url().replace(/^.*\/api\/v1/, '')}`); });
  await page.goto(`${APP}/login`);
  await page.locator('input[type=email]').fill(fx[role]);
  await page.locator('input[type=password]').fill(fx.password);
  await page.locator('button[type=submit]').click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 });
  await page.waitForLoadState('networkidle');
  return { ctx, page, logs };
}
export async function shot(page, name, full = true) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: full });
}
