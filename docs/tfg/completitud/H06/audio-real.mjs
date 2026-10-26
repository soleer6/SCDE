import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const fx=JSON.parse(readFileSync(join(process.env.LOCALAPPDATA,'SCDE/integration/fixtures-claude-h04.local.json'),'utf8'));
const app='http://localhost:5173';
const dir=join(process.env.TEMP,'scde-pw');
const b=await chromium.launch({channel:'msedge',headless:true});
const errors=[];
const p=await (await b.newContext({locale:'es-ES',viewport:{width:1366,height:900}})).newPage();
p.on('pageerror',e=>errors.push(e.message));
await p.goto(app+'/login');await p.locator('input[type=email]').fill(fx.teacher);await p.locator('input[type=password]').fill(fx.password);await p.locator('button[type=submit]').click();
await p.waitForURL(u=>!u.pathname.startsWith('/login'));
await p.goto(`${app}/instances/${fx.instanceId}/grade`);
const input=p.locator('.gr-audio__file input');await input.waitFor({state:'attached'});
const before=await p.locator('.gr-audio__list li').count();
// invalid file -> readable error, nothing created
await input.setInputFiles(join(dir,'basura.wav'));
await p.getByText(/No se ha podido leer el audio|Formato de audio no admitido|No se ha podido guardar el audio/).first().waitFor();
assert.equal(await p.locator('.gr-audio__list li').count(),before);
// valid file
await input.setInputFiles(join(dir,'nota.wav'));
await p.getByText('Audio guardado').waitFor();
await p.waitForFunction(n=>document.querySelectorAll('.gr-audio__list li').length===n+1,before);
const src=await p.locator('.gr-audio__list audio').last().getAttribute('src');
const r=await fetch(src);assert.equal(r.status,200);const buf=Buffer.from(await r.arrayBuffer());assert.equal(buf.slice(0,4).toString(),'RIFF');
await p.screenshot({path:join(dir,'h06-audio-real.png'),fullPage:true});
// reload: still listed, delete own
await p.reload();await p.locator('.gr-audio__list li').first().waitFor();
const n=await p.locator('.gr-audio__list li').count();
await p.getByRole('button',{name:/^Eliminar audio/}).last().click();
await p.waitForFunction(k=>document.querySelectorAll('.gr-audio__list li').length===k-1||!document.querySelector('.gr-audio__list'),n);
assert.deepEqual(errors,[]);console.log('H06 audio OK');await b.close();
