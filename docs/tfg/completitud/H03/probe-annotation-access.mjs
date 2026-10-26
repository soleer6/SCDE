import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
const path=join(process.env.LOCALAPPDATA,'SCDE/integration/fixtures-claude-authors.local.json');
const fx=JSON.parse(readFileSync(path,'utf8'));
const base='http://127.0.0.1:8000/api/v1';
async function auth(role){const r=await fetch(base+'/auth/login/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:fx[role],password:fx.password})});if(!r.ok)throw Error('login '+role+' '+r.status);return {Authorization:'Bearer '+(await r.json()).access_token,'Content-Type':'application/json'};}
const headers=await auth('teacher');
if(!fx.probeAnnotationId){
 const r=await fetch(`${base}/instances/${fx.instanceId}/annotations/`,{method:'POST',headers,body:JSON.stringify({annotation_type:'STYLUS',payload:JSON.stringify({v:1,strokes:[{points:[{x:.2,y:.2},{x:.5,y:.2}],color:'#d6342c',width:.006,tool:'pen'}]}),page_number:1,x:0,y:0})});if(r.status!==201)throw Error('create '+r.status+' '+await r.text());fx.probeAnnotationId=(await r.json()).id;writeFileSync(path,JSON.stringify(fx,null,2));
}
const other=await auth('otherStudent');
const detail=await fetch(`${base}/instances/${fx.instanceId}/`,{headers:other});
const annotations=await fetch(`${base}/instances/${fx.instanceId}/annotations/`,{headers:other});
const list=annotations.ok?await annotations.json():[];
const own=list.find(a=>a.id===fx.probeAnnotationId);
const payload=own?.download_url?await fetch(own.download_url):null;
console.log(JSON.stringify({syntheticOnly:true,otherStudentsInstanceDetail:detail.status,otherStudentsAnnotations:annotations.status,leaksProbeAnnotation:!!own,presignedPayloadStatus:payload?.status}));
