import http from 'node:http';
import {randomBytes, createHash, webcrypto, timingSafeEqual} from 'node:crypto';
import {lstat, open, opendir, realpath, writeFile} from 'node:fs/promises';
import {basename, resolve, join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {generatePassword} from '../extension/src/password-generator.js';
import {inspectWithClamAV} from './clamav.mjs';

const MARKER='SENTINEL_SYNTHETIC_TEST_ONLY_V1';
const LIMIT=8*1024*1024;
export function auditPassword(password) {
 const lower=password.toLowerCase();
 const reasons=[];
 if(password.length<12) reasons.push('Use at least 12 characters; prefer a long unique generated password.');
 if(/^(password|123456|qwerty|letmein|admin|welcome)/i.test(password)) reasons.push('Common words or predictable prefixes are easy to guess.');
 if(/(.)\1{2,}|1234|abcd|qwer/i.test(password)) reasons.push('Avoid repeated characters and keyboard or counting sequences.');
 if(/(?:19|20)\d{2}/.test(lower)) reasons.push('Years and dates are predictable.');
 const health=reasons.length>1?'Very weak':reasons.length?'Weak':password.length>=20?'Stronger':'Moderate';
 return {health,reasons:reasons.length?reasons:['Use this only for one account. No breach lookup or safety guarantee.']};
}
function syntheticMatch(bytes) {
 const text=bytes.toString('utf8');
 if(text.includes(MARKER))return true;
 if(bytes.length>64*1024)return false;
 try {
  const item=JSON.parse(text);
  if(item.type!=='synthetic-test')return false;
  if(item.encoding==='base64' && typeof item.payload==='string')return Buffer.from(item.payload,'base64').toString('utf8')===MARKER;
  if(item.encoding==='hex-fragments' && Array.isArray(item.order) && item.order.length<=8 && Array.isArray(item.fragments) && item.fragments.length<=8 && item.fragments.every(p=>typeof p==='string' && p.length<=128) && item.order.every(i=>Number.isInteger(i) && i>=0 && i<item.fragments.length))return Buffer.from(item.order.map(i=>item.fragments[i]).join(''),'hex').toString('utf8')===MARKER;
 }catch{}
 return false;
}
const allowedCodes=new Set(['http','credentials','ip','internationalized','port','shortened','reward_payment','risk_list','pressure','payment','reward','link']);
function equal(a,b){return typeof a==='string'&&/^[a-f0-9]{64}$/.test(a)&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));}
function keys(body,list){return body&&typeof body==='object'&&!Array.isArray(body)&&Object.keys(body).every(k=>list.includes(k));}

export async function startRuntime({port=0,onShutdown=()=>{}}={}) {
 const desktopToken=randomBytes(32).toString('hex');
 let browserToken='',extensionId='',unlocked=false,scan=null,closed=false,revision=0,activeScan=Promise.resolve(),closing;
 const events=[];
 const accounts=[
  {id:'mail',name:'Orbit Mail',user:'alex@example.test',host:'mail.example.test',password:'password123'},
  {id:'school',name:'School Portal',user:'student@example.test',host:'school.example.test',password:'Sunshine2026!'},
  {id:'notes',name:'Field Notes',user:'alex@example.test',host:'notes.example.test',password:'vN7!mQ2#zR8$hT4@xP6?'},
  {id:'games',name:'Arcade',user:'player@example.test',host:'arcade.example.test',password:'Sunshine2026!'},
 ];
 function event(source,kind,codes=[]){events.unshift({id:randomBytes(8).toString('hex'),at:new Date().toISOString(),source,kind,codes});events.splice(64);}
 function state(){return {revision,mode:'synthetic_demo',connected:true,unlocked,extensionId,accounts:accounts.map(({password,...a})=>({...a,...auditPassword(password),reused:accounts.filter(b=>b.password===password).length>1})),events,scan:scan?Object.fromEntries(Object.entries(scan).filter(([k])=>k!=='cancel')):null};}
 async function runScan(path,current) {
  const start=Date.now(); const queue=[{path,depth:0}];
  try {
   while(queue.length && current.visited<256 && current.checked<64){
    if(closed||current.cancel){current.status='cancelled';return;}
    if(Date.now()-start>90000){current.status='timed_out';return;}
    const item=queue.shift(); const stat=await lstat(item.path);current.visited++;
    if(stat.isSymbolicLink()){current.skipped++;continue;}
    if(stat.isDirectory()){
     if(item.depth>=4){current.skipped++;continue;}
     const dir=await opendir(item.path);
     for await(const child of dir){if(queue.length+current.visited>=256){current.skipped++;break;}queue.push({path:join(item.path,child.name),depth:item.depth+1});}
     continue;
    }
    if(!stat.isFile()||stat.size>LIMIT){current.skipped++;continue;}
    const handle=await open(item.path,'r');
    try {
     const before=await handle.stat(); if(!before.isFile()||before.size>LIMIT||before.ino!==stat.ino||before.dev!==stat.dev){current.skipped++;continue;}
     const chunks=[];const hash=createHash('sha256');let count=0;
     for await(const chunk of handle.createReadStream({autoClose:false,highWaterMark:65536})){
      if(current.cancel||closed){current.status='cancelled';return;}
      if(Date.now()-start>90000){current.status='timed_out';return;}
      count+=chunk.length;if(count>LIMIT){current.skipped++;break;}hash.update(chunk);chunks.push(chunk);
     }
     const after=await handle.stat();
     if(count>LIMIT)continue;
     if(before.ino!==after.ino||before.size!==after.size||before.mtimeMs!==after.mtimeMs||count!==before.size){current.errors++;continue;}
     const bytes=Buffer.concat(chunks);const digest=hash.digest('hex');current.checked++;current.bytes+=count;
     const name=basename(item.path).slice(0,80);
     current.files.push({name,sha256:digest,bytes:count});
     if(syntheticMatch(bytes))current.findings.push({name,kind:'synthetic_test',reason:'Harmless Sentinel test marker detected; this is not malware.',sha256:digest});
     {
      current.engine='ClamAV 1.5.4 harmless-sample adapter + bounded byte inspection';
      const result=await inspectWithClamAV(bytes,()=>current.cancel||closed||Date.now()-start>90000);
      current.findings.push({name,kind:'provider_'+result.status,reason:result.reason,sha256:digest});
      if(!['no_detection','synthetic_match'].includes(result.status))current.skipped++;
      const final=await handle.stat();
      if(final.size!==after.size||final.mtimeMs!==after.mtimeMs){current.errors++;}
     }
    } finally {await handle.close();}
   }
   current.status=current.cancel||closed?'cancelled':Date.now()-start>90000?'timed_out':queue.length||current.errors||current.skipped?'partial':'completed';
   event('desktop','scan_completed',current.findings.some(f=>f.kind==='synthetic_test')?['synthetic_test']:[]);
  }catch{current.errors++;current.status='failed';event('desktop','scan_failed');}
 }
 const server=http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');res.setHeader('X-Content-Type-Options','nosniff');
  const origin=req.headers.origin;
  const browserOrigin=extensionId?'chrome-extension://'+extensionId:null;
  const localHost=req.headers.host===server.address()?.address+':'+server.address()?.port;
  const respond=(status,data)=>{res.writeHead(status);res.end(JSON.stringify(data));};
  if(!localHost)return respond(403,{error:'forbidden'});
  if(origin && origin!==browserOrigin)return respond(403,{error:'forbidden'});
  if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
  if(req.method==='OPTIONS'){
   if(!origin||origin!==browserOrigin)return respond(403,{error:'forbidden'});
   res.setHeader('Access-Control-Allow-Methods','POST');res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type,X-Sentinel-Extension');return respond(204,{});
  }
  const credential=req.headers.authorization?.replace(/^Bearer /,'');
  const desktop=equal(credential,desktopToken)&&!origin;
  const browser=browserToken&&equal(credential,browserToken)&&req.headers['x-sentinel-extension']===extensionId&&(!origin||origin===browserOrigin);
  if(req.method!=='POST'||(!desktop&&!browser))return respond(403,{error:'forbidden'});
  req.setTimeout(5000,()=>req.destroy());
  let body;
  try{let size=0;const chunks=[];for await(const c of req){size+=c.length;if(size>4096)return respond(413,{error:'request_too_large'});chunks.push(c);}body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return respond(400,{error:'invalid_request'});}
  if(!keys(body,['id','path','extensionId','risk','codes']))return respond(400,{error:'invalid_request'});
  if(req.url==='/state'&&keys(body,[])){const snapshot=state();if(browser)snapshot.scan=null;return respond(200,snapshot);}
  if(req.url==='/shutdown'&&desktop&&keys(body,[])){res.once('finish',()=>{void close().then(onShutdown);});return respond(200,{ok:true});}
  if(req.url==='/event'&&browser&&keys(body,['risk','codes'])&&['suspicious','unknown'].includes(body.risk)&&Array.isArray(body.codes)&&body.codes.length<=16&&body.codes.every(c=>allowedCodes.has(c))){event('browser',body.risk,Array.from(new Set(body.codes)));return respond(200,{ok:true});}
  if(req.url==='/pair'&&desktop&&keys(body,['extensionId'])&&typeof body.extensionId==='string'&&/^[a-p]{32}$/.test(body.extensionId)){extensionId=body.extensionId;browserToken=randomBytes(32).toString('hex');return respond(200,{token:browserToken,port:server.address().port,extensionId});}
  if(req.url==='/unlock'&&keys(body,[])){unlocked=true;return respond(200,{ok:true});}
  if(req.url==='/lock'&&keys(body,[])){unlocked=false;return respond(200,{ok:true});}
  if(['/rotate','/reveal'].includes(req.url)&&keys(body,['id'])){
   if(!unlocked)return respond(423,{error:'demo_locked'});
   const account=accounts.find(a=>a.id===body.id);if(!account)return respond(400,{error:'invalid_account'});
   if(req.url==='/rotate'){
    let generated='';
    for(let attempt=0;attempt<32;attempt++){const candidate=generatePassword(24,webcrypto);if(auditPassword(candidate).health==='Stronger'&&!accounts.some(a=>a.password===candidate)){generated=candidate;break;}}
    if(!generated)return respond(503,{error:'generation_unavailable'});
    account.password=generated;revision++;event(desktop?'desktop':'browser','demo_password_rotated');return respond(200,{ok:true});
   }
   return respond(200,{password:account.password,mode:'synthetic_demo'});
  }
  if(req.url==='/cancel'&&desktop&&keys(body,[])){if(scan?.status==='running')scan.cancel=true;return respond(200,{ok:true});}
  if(req.url==='/scan'&&desktop&&keys(body,['path'])){
   if(scan?.status==='running')return respond(409,{error:'scan_busy'});
   const ordinaryPath=typeof body.path==='string'&&(process.platform==='win32'?/^[a-df-z]:[\\/]/i.test(body.path):/^\/(?!\/)/.test(body.path));
   if(!ordinaryPath||body.path.length>1024||/^E:/i.test(body.path)||body.path.includes('\0'))return respond(400,{error:'selection_unsupported'});
   scan={id:randomBytes(12).toString('hex'),status:'running',coverage:'partial',engine:'Bounded read-only SHA-256 and harmless synthetic signatures',visited:0,checked:0,skipped:0,errors:0,bytes:0,files:[],findings:[],cancel:false};
   activeScan=runScan(resolve(body.path),scan);return respond(200,{id:scan.id});
  }
  return respond(desktop?400:403,{error:desktop?'invalid_request':'forbidden'});
 });
 server.maxConnections=8;server.requestTimeout=5000;server.headersTimeout=5000;
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
 function close(){if(!closing){closed=true;if(scan)scan.cancel=true;closing=(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await activeScan;})();}return closing;}
 return {desktopToken,url:'http://127.0.0.1:'+server.address().port,port:server.address().port,close};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const runtime=await startRuntime({onShutdown:()=>process.exit(0)});
 await writeFile(new URL('../desktop/console-build/demo-runtime.json',import.meta.url),JSON.stringify({url:runtime.url,token:runtime.desktopToken}),{mode:0o600});
 process.on('SIGTERM',async()=>{await runtime.close();process.exit(0);});
}
