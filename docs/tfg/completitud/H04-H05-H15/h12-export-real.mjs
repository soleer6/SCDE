import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const fx=JSON.parse(readFileSync(join(process.env.LOCALAPPDATA,'SCDE/integration/fixtures-claude-h15.local.json'),'utf8'));
const app='http://localhost:5173';
const b=await chromium.launch({channel:'msedge',headless:true});
const errors=[];
const p=await (await b.newContext({locale:'es-ES',acceptDownloads:true,viewport:{width:1366,height:900}})).newPage();
p.on('pageerror',e=>errors.push(e.message));
await p.goto(app+'/login');await p.locator('input[type=email]').fill(fx.manager);await p.locator('input[type=password]').fill(fx.password);await p.locator('button[type=submit]').click();
await p.waitForURL(u=>!u.pathname.startsWith('/login'));
await p.goto(`${app}/exams/${fx.examId}`);
for(const [name,ext,check] of [['Exportar notas','csv',t=>t.startsWith('NIA,')],['Exportar JSON','json',t=>Array.isArray(JSON.parse(t))&&JSON.parse(t).length>=1]]){
 const [d]=await Promise.all([p.waitForEvent('download'),p.getByRole('button',{name}).click()]);
 assert.ok(d.suggestedFilename().endsWith('.'+ext),d.suggestedFilename());
 const t=readFileSync(await d.path(),'utf8');assert.ok(check(t),t.slice(0,80));console.log(ext,'OK',d.suggestedFilename());
}
assert.deepEqual(errors,[]);await b.close();
