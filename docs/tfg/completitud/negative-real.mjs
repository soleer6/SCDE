import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const fx = JSON.parse(readFileSync(join(process.env.LOCALAPPDATA, 'SCDE/integration/fixtures-claude-negative.local.json'), 'utf8'));
const b = await chromium.launch({channel:'msedge',headless:true});
try {
 const page = await b.newPage({locale:'es-ES',viewport:{width:1366,height:860}});
 const errors=[];
 page.on('pageerror', e=>errors.push(e.message));
 await page.goto('http://localhost:5173/login');
 await page.locator('input[type=email]').fill(fx.teacher);
 await page.locator('input[type=password]').fill(fx.password);
 await page.locator('button[type=submit]').click();
 await page.waitForURL(u=>!u.pathname.startsWith('/login'));
 await page.goto(`http://localhost:5173/instances/${fx.instanceId}/grade`);
 const input=page.getByRole('textbox',{name:/Nota de Penaliz/});
 await input.waitFor();
 assert.equal(await page.getByText('Datos de demostraci?n',{exact:true}).count(),0);
 const save=async(value)=>{
  const response=page.waitForResponse(r=>r.request().method()==='PUT'&&r.url().includes(`/problems/${fx.problemId}/grade/`));
  await input.fill(value); await input.press('Tab');
  const r=await response; assert.equal(r.status(),200); return r.json();
 };
 const criterion=page.getByRole('checkbox',{name:'Correct solution',exact:true});
 if(!await criterion.isChecked()){const response=page.waitForResponse(r=>r.request().method()==='PUT'&&r.url().includes('/rubric/'));await criterion.click();assert.equal((await response).status(),200);await page.waitForLoadState('networkidle');}
 const first=await save('-12'); assert.equal(Number(first.score),-12);
 await page.waitForLoadState('networkidle');
 const read=async()=>page.evaluate(async(id)=>{const {api}=await import('/src/lib/api/client.js');return api.get(`/instances/${id}/`);},fx.instanceId);
 assert.equal(Number((await read()).total_score),0);
 await page.reload(); await input.waitFor(); assert.equal(await input.inputValue(),'-12');
 const second=await save('-1,5'); assert.equal(Number(second.score),-1.5);
 await page.waitForLoadState('networkidle'); assert.equal(Number((await read()).total_score),8.5);
 // The server must retain the upper bound and the UI must reject before sending.
 let writes=0; const listener=r=>{if(r.method()==='PUT'&&r.url().includes('/grade/'))writes++;};page.on('request',listener);
 await input.fill('11');await input.press('Tab');await page.getByRole('alert').waitFor();assert.equal(writes,0);page.off('request',listener);
 await input.fill('-1,5');await input.press('Tab');assert.equal(await page.getByRole('alert').count(),0);assert.equal(await page.getByText('+-2',{exact:true}).count(),0);
 await page.screenshot({path:join(process.env.TEMP,'scde-pw','negative-real.png'),fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('PASS navegador real/Django: negativo persistido, total cero, recarga, coma decimal, suma positiva y l?mite superior sin PUT; sin pageerrors');
} finally {await b.close();}
