import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const fx=JSON.parse(readFileSync(join(process.env.LOCALAPPDATA,'SCDE/integration/fixtures-claude-h05.local.json'),'utf8'));
const app='http://localhost:5173',base='http://127.0.0.1:8000/api/v1';
const login=async e=>(await (await fetch(base+'/auth/login/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:e,password:fx.password})})).json());
const mgr=await login(fx.manager);
const H={Authorization:'Bearer '+mgr.access_token,'Content-Type':'application/json'};
const ex=await (await fetch(`${base}/exams/${fx.examId}/`,{headers:H})).json();
console.log('perms',JSON.stringify(ex.student_permissions));
const b=await chromium.launch({channel:'msedge',headless:true});
const errors=[];
async function check(expectBtn){
 const p=await (await b.newContext({locale:'es-ES',viewport:{width:1366,height:900}})).newPage();
 p.on('pageerror',e=>errors.push(e.message));
 await p.goto(app+'/login');await p.locator('input[type=email]').fill(fx.requester);await p.locator('input[type=password]').fill(fx.password);await p.locator('button[type=submit]').click();
 await p.waitForURL(u=>!u.pathname.startsWith('/login'));
 await p.goto(`${app}/exams/${fx.examId}`);
 await p.waitForSelector('.react-pdf__Page__canvas',{timeout:20000}).catch(()=>{});
 await p.waitForTimeout(1500);
 const n=await p.getByRole('button',{name:'Descargar PDF'}).count();
 await p.screenshot({path:join(process.env.TEMP,'scde-pw',`h05-${expectBtn}.png`),fullPage:true});
 console.log('button count',n,'expected',expectBtn?1:0);
 assert.equal(n,expectBtn?1:0);
 if(expectBtn){const [d]=await Promise.all([p.waitForEvent('download'),p.getByRole('button',{name:'Descargar PDF'}).click()]);console.log('downloaded',d.suggestedFilename());}
}
const set=async v=>{const r=await fetch(`${base}/exams/${fx.examId}/`,{method:'PATCH',headers:H,body:JSON.stringify({student_permissions:{...ex.student_permissions,can_download_pages:v}})});console.log('PATCH',v,r.status);};
await set(false);await check(false);
await set(true);await check(true);
await set(ex.student_permissions.can_download_pages);
assert.deepEqual(errors,[]);console.log('H05 OK');await b.close();
