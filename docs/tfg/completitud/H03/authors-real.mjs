import { chromium } from 'playwright-core';
import { readFileSync,writeFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const fixturePath=join(process.env.LOCALAPPDATA,'SCDE/integration/fixtures-claude-authors.local.json');
const fx=JSON.parse(readFileSync(fixturePath,'utf8'));
const base='http://127.0.0.1:8000/api/v1';
const app='http://localhost:5173';
async function login(role){const r=await fetch(base+'/auth/login/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:fx[role],password:fx.password})});assert.equal(r.status,200);return r.json();}
const authA=await login('teacher'),authB=await login('otherTeacher');
const headers=auth=>({Authorization:'Bearer '+auth.access_token,'Content-Type':'application/json'});
async function list(auth){const r=await fetch(`${base}/instances/${fx.instanceId}/annotations/`,{headers:headers(auth)});assert.equal(r.status,200);return r.json();}
async function create(auth,data,instanceId=fx.instanceId){const r=await fetch(`${base}/instances/${instanceId}/annotations/`,{method:'POST',headers:headers(auth),body:JSON.stringify({page_number:1,x:0,y:0,...data})});assert.equal(r.status,201);return r.json();}
if(!fx.blueId){fx.blueId=(await create(authB,{annotation_type:'STYLUS',payload:JSON.stringify({v:1,strokes:[{points:[{x:.2,y:.35},{x:.5,y:.35}],color:'#1448d6',width:.008,tool:'pen'}]})})).id;writeFileSync(fixturePath,JSON.stringify(fx,null,2));}
if(!fx.otherCommentId){fx.otherCommentId=(await create(authB,{annotation_type:'TEXT',payload:'Comentario sintético del segundo docente'})).id;writeFileSync(fixturePath,JSON.stringify(fx,null,2));}
async function payload(id){const a=(await list(authB)).find(a=>a.id===id);return (await fetch(a.download_url)).text();}
const blueBefore=await payload(fx.blueId), commentBefore=await payload(fx.otherCommentId);
const b=await chromium.launch({channel:'msedge',headless:true});
const errors=[];
async function pdfReady(p){await p.waitForFunction(()=>{const c=document.querySelector('.react-pdf__Page__canvas');if(!c||c.width<100)return false;const data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let dark=0;for(let i=0;i<data.length;i+=32)if(data[i+3]>0&&data[i]<150&&data[i+1]<150&&data[i+2]<150)dark++;return dark>100;});}
async function session(role){const ctx=await b.newContext({locale:'es-ES',viewport:{width:1366,height:860}});const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(app+'/login');await p.locator('input[type=email]').fill(fx[role]);await p.locator('input[type=password]').fill(fx.password);await p.locator('button[type=submit]').click();await p.waitForURL(u=>!u.pathname.startsWith('/login'));return p;}
try {
 const a=await session('teacher');await a.goto(`${app}/instances/${fx.instanceId}/grade`);
 const editable=a.locator('.gr-ink:not(.is-readonly)');await editable.waitFor();
 await a.waitForFunction(()=>[...document.querySelectorAll('.gr-ink')].length===2&&[...document.querySelectorAll('.gr-ink')].every(c=>c.width>100));
 const foreign=a.locator('.gr-ink.is-readonly');
 const bluePixel=()=>foreign.evaluate(c=>Array.from(c.getContext('2d').getImageData(Math.floor(c.width*.3),Math.floor(c.height*.35),1,1).data));
 const before=await bluePixel();assert.ok(before[2]>before[0]&&before[3]>0);
 // Append an eraser to A's layer over B's blue line: B must remain visible.
 await a.getByRole('button',{name:'Goma',exact:true}).click();
 await editable.scrollIntoViewIfNeeded();const box=await editable.boundingBox();
 await a.mouse.move(box.x+box.width*.2,box.y+box.height*.35);await a.mouse.down();
 await a.mouse.move(box.x+box.width*.5,box.y+box.height*.35,{steps:12});await a.mouse.up();
 await a.waitForTimeout(1600);await a.waitForLoadState('networkidle');
 assert.deepEqual(await bluePixel(),before);
 let failed=false;
 await a.route('**/api/v1/**',async route=>{
  const req=route.request();const body=req.postDataJSON();
  if(!failed&&['POST','PUT'].includes(req.method())&&req.url().includes('/annotations/')&&(body?.annotation_type==='TEXT'||typeof body?.payload==='string'&&!body.payload.startsWith('{'))){failed=true;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error_code:'UNKNOWN'})});}
  else await route.continue();
 });
 const comment=a.getByRole('textbox',{name:'Comentario para el estudiante',exact:true});
 const draft='Comentario propio conservado '+Date.now();await comment.fill(draft);
 await a.getByRole('alert').filter({hasText:'Se conservan en pantalla'}).waitFor();assert.equal(await comment.inputValue(),draft);
 await a.screenshot({path:join(process.env.TEMP,'scde-pw','authors-retry-real.png'),fullPage:true});
 await a.getByRole('button',{name:'Reintentar',exact:true}).click();
 await a.waitForFunction(()=>!document.querySelector('[role="alert"]'));
 await a.waitForLoadState('networkidle');assert.ok(failed);
 assert.equal(await payload(fx.blueId),blueBefore);assert.equal(await payload(fx.otherCommentId),commentBefore);
 await a.reload();await comment.waitFor();assert.equal(await comment.inputValue(),draft);
 await a.getByText(commentBefore,{exact:true}).waitFor();
 await pdfReady(a);
 await a.screenshot({path:join(process.env.TEMP,'scde-pw','authors-teacher-real.png'),fullPage:true});
 const other=await session('otherTeacher');await other.goto(`${app}/instances/${fx.instanceId}/grade`);
 await other.getByText(draft,{exact:true}).waitFor();assert.equal(await other.getByRole('textbox',{name:'Comentario para el estudiante',exact:true}).inputValue(),commentBefore);
 // The second synthetic student's instance is IN_REVIEW. Copy the two authors'
 // records there to test the permitted student view without publishing or
 // changing the workflow of the correction instance (PENDING_REVIEW).
 fx.studentCopies??={};
 for(const source of await list(authA)){
  if(!['TEXT','STYLUS'].includes(source.annotation_type)||source.problem_id)continue;
  const content=await (await fetch(source.download_url)).text();
  const author=source.author_id===authA.user.id?authA:authB;
  if(!fx.studentCopies[source.id])fx.studentCopies[source.id]=(await create(author,{annotation_type:source.annotation_type,payload:content},fx.otherInstanceId)).id;
  else {const r=await fetch(`${base}/annotations/${fx.studentCopies[source.id]}/`,{method:'PUT',headers:headers(author),body:JSON.stringify({payload:content})});assert.equal(r.status,200);}
 }
 writeFileSync(fixturePath,JSON.stringify(fx,null,2));
 const student=await session('otherStudent');await student.goto(`${app}/exams/${fx.examId}`);
 await student.getByText(draft,{exact:true}).waitFor();await student.getByText(commentBefore,{exact:true}).waitFor();
 await student.waitForFunction(()=>document.querySelectorAll('.gr-ink.is-readonly').length>=2);
 assert.equal(await student.locator('.gr-ink:not(.is-readonly)').count(),0);
 await pdfReady(student);
 await student.screenshot({path:join(process.env.TEMP,'scde-pw','authors-student-real.png'),fullPage:true});
 await student.setViewportSize({width:390,height:844});await student.waitForTimeout(500);
 await student.screenshot({path:join(process.env.TEMP,'scde-pw','authors-student-mobile.png'),fullPage:true});
 const overflow=await student.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,elements:[...document.querySelectorAll('*')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(0,12).map(e=>({tag:e.tagName,class:e.className,right:e.getBoundingClientRect().right}))}));
 assert.ok(overflow.scroll<=overflow.width+1,JSON.stringify(overflow));
 assert.deepEqual(errors,[]);
 console.log('PASS Edge/Django real: dos docentes, dos capas, goma aislada por píxel, contenido ajeno intacto, guardado 503/reintento/recarga y alumno con todos los comentarios/capas. Sin pageerrors.');
}finally{await b.close();}
