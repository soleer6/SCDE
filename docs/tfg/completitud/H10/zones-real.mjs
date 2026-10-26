import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const fx=JSON.parse(readFileSync(join(process.env.LOCALAPPDATA,'SCDE/integration/fixtures-claude-authors.local.json'),'utf8'));
const app='http://localhost:5173';
const b=await chromium.launch({channel:'msedge',headless:true});
const errors=[];
const ctx=await b.newContext({locale:'es-ES',viewport:{width:1366,height:900}});
const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));
let pdfStatus=null;p.on('response',r=>{if(r.url().includes('blank-pdf')){pdfStatus=r.status();}});
await p.goto(app+'/login');await p.locator('input[type=email]').fill(fx.manager);await p.locator('input[type=password]').fill(fx.password);await p.locator('button[type=submit]').click();
await p.waitForURL(u=>!u.pathname.startsWith('/login'));
await p.goto(`${app}/exams/${fx.examId}/setup`);
await p.getByRole('heading',{name:'Zonas de reconocimiento'}).waitFor();
// enable page 1 profile if missing
const enable=p.getByRole('button',{name:/Configurar zonas de la página 1/});
if(await enable.count()){await enable.click();}
await p.locator('.zones-sheet').waitFor();
await p.waitForFunction(()=>{const c=document.querySelector('.zones-sheet .react-pdf__Page__canvas');if(!c||c.width<100)return false;const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let dark=0;for(let i=0;i<d.length;i+=4)if(d[i+3]>0&&d[i]<230&&d[i+1]<230&&d[i+2]<230)dark++;return dark>5;});
assert.equal(pdfStatus,200);
// draw a rectangle by dragging on the sheet: it fills the numeric form
const sheet=await p.locator('.zones-sheet').boundingBox();
await p.mouse.move(sheet.x+sheet.width*.1,sheet.y+sheet.height*.3);await p.mouse.down();
await p.mouse.move(sheet.x+sheet.width*.6,sheet.y+sheet.height*.4,{steps:8});await p.mouse.up();
assert.equal(await p.locator('.zones-rect--draft').count(),1);
const drawn=await Promise.all(['Izquierda','Arriba','Ancho','Alto'].map(k=>p.getByLabel(new RegExp('^'+k)).first().inputValue()));
assert.ok(Math.abs(Number(drawn[0])-10)<2&&Math.abs(Number(drawn[1])-30)<2&&Math.abs(Number(drawn[2])-50)<2&&Math.abs(Number(drawn[3])-10)<2,drawn.join());
// add a zone via numeric form and check overlay on top of PDF
const before=await p.locator('.zones-rect:not(.zones-rect--draft)').count();
await p.getByLabel(/^Tipo/).selectOption('OCR_TEXT');
await p.getByLabel(/^Dato/).fill('name');
for(const [k,v] of [['Izquierda','10'],['Arriba','5'],['Ancho','50'],['Alto','5']]) await p.getByLabel(new RegExp('^'+k)).first().fill(v);
await p.getByRole('button',{name:/^Añadir zona/}).click();
await p.waitForFunction(n=>document.querySelectorAll('.zones-rect:not(.zones-rect--draft)').length>n,before);
await p.locator('.zones-sheet').screenshot({path:join(process.env.TEMP,'scde-pw','h10-zones-real.png')});
assert.deepEqual(errors,[]);
console.log('H10 OK',before,'->',await p.locator('.zones-rect:not(.zones-rect--draft)').count());
await b.close();
