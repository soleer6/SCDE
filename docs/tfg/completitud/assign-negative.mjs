import {readFileSync} from 'node:fs';import {join} from 'node:path';
const fx=JSON.parse(readFileSync(join(process.env.LOCALAPPDATA,'SCDE/integration/fixtures-claude-negative.local.json'),'utf8'));
const base='http://127.0.0.1:8000/api/v1';
const login=await fetch(base+'/auth/login/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:fx.manager,password:fx.password})});if(!login.ok)throw Error('login '+login.status);
const auth=await login.json();const headers={'Authorization':'Bearer '+auth.access_token,'Content-Type':'application/json'};
const users=await (await fetch(base+'/users/?search='+encodeURIComponent(fx.teacher),{headers})).json();const teacher=users.results.find(u=>u.email===fx.teacher);if(!teacher)throw Error('teacher missing');
const rules=await (await fetch(`${base}/exams/${fx.examId}/assignment-rules/`,{headers})).json();
if(!rules.some(r=>r.problems.includes(fx.problemId))){const res=await fetch(`${base}/exams/${fx.examId}/assignment-rules/`,{method:'POST',headers,body:JSON.stringify({correctors:[teacher.id],problems:[fx.problemId],groups:[],models_filter:[]})});if(!res.ok)throw Error('rule '+res.status+' '+await res.text());}
console.log('Asignaci?n de problema manual al docente sint?tico lista');
