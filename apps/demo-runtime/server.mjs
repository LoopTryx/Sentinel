import {watchtowerPreferences} from './watchtower-observe.mjs';
import {rememberBrowserDomain,forgetBrowserDomains} from './watchtower-browser.mjs';
import http from 'node:http';
import {createAiHandoff} from './sentinel-ai.mjs';
import {createLocalQueue} from './local-ai-queue.mjs';
import {createLocalAi} from './local-ai.mjs';
import {observeWifi} from './wifi.mjs';
import {observeUsb} from './usb-observe.mjs';
import {createObservationMonitor} from './observation-monitor.mjs';
import {randomBytes, createHash, webcrypto, timingSafeEqual} from 'node:crypto';
import {lstat, open, opendir, realpath, writeFile} from 'node:fs/promises';
import {basename, resolve, join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {generatePassword} from '../extension/src/password-generator.js';
import {inspectWithClamAV} from './clamav.mjs';
import {inspectNative} from './native-inspection.mjs';
import {createNativeActionService} from './native-action-service.mjs';
import {fileURLToPath} from 'node:url';

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

export async function startRuntime({port=0,onShutdown=()=>{},nativeExecutable=null,nativeAppDir=null,autoObserve=false,localExplanations=autoObserve}={}) {
 const aiHandoff=createAiHandoff();
 const localAi=createLocalAi();const chatAi=createLocalAi({profile:'chat'});if(autoObserve)void localAi.warm().catch(()=>{});
 const chatQueue=createLocalQueue(chatAi);const runChat=(...args)=>chatQueue.run(...args);
 const localRequests=new Map();let localTail=Promise.resolve(),localPending=0,activeLocalRef=null;
 function startLocalExplanation(handoff){
  for(const [ref,row]of localRequests)if(row.expiresAt<=Date.now())localRequests.delete(ref);
  if(localRequests.has(handoff.finding.ref)&&!localRequests.get(handoff.finding.ref).error)return;
  if(localPending>=8)return;
  localPending++;
  const row={question:handoff.question.slice(0,512),expiresAt:handoff.expiresAt,error:null,promise:null,cancelled:false};
  row.promise=localTail.then(async()=>{if(closed)throw Error('local_model_unavailable');if(row.cancelled)throw Error('local_cancelled_or_timed_out');activeLocalRef=handoff.finding.ref;const result=handoff.finding.source.endsWith('_message')?await runChat('Assess whether this message is likely to be a scam using the supplied context.',handoff.finding,{classification:true}):await localAi.answer(row.question,handoff.finding);if(row.cancelled)throw Error('local_cancelled_or_timed_out');aiHandoff.publishQuick(handoff.finding.ref,result);return result;}).catch(error=>{row.error=['local_model_unavailable','local_cancelled_or_timed_out','local_response_unavailable','local_model_busy'].includes(error.message)?error.message:'local_response_unavailable';throw error;}).finally(()=>{if(activeLocalRef===handoff.finding.ref)activeLocalRef=null;localPending--;});
  localTail=row.promise.catch(()=>{});localRequests.set(handoff.finding.ref,row);
 }

 const wifiMonitor=autoObserve?createObservationMonitor({collect:observeWifi,intervalMs:30000}):null;
 const usbMonitor=autoObserve?createObservationMonitor({collect:observeUsb,intervalMs:15000}):null;
 const desktopToken=randomBytes(32).toString('hex');
 const nativeActionToken=randomBytes(32).toString('hex');
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
 let nativeSnapshot=null;
 let nativeService=null;

 let nativeActionInFlight=false;
 async function runNativeScan(path,current){
  try{
   const stat=await lstat(path);
   if(stat.isSymbolicLink()||(!stat.isFile()&&!stat.isDirectory()))throw new Error();
   const receive=next=>{
    nativeSnapshot=next;
    current.visited=next.reports.length;
    current.checked=next.reports.filter(r=>r.state==='completed').length;
    current.skipped=next.reports.filter(r=>r.state!=='completed').length;
    current.bytes=next.reports.reduce((n,r)=>n+Number(r.inspectedBytes),0);
    current.files=next.reports.filter(r=>r.state==='completed').map(r=>({name:r.reportRef,sha256:r.sha256,bytes:Number(r.inspectedBytes)}));
    // Legacy UI requires a complete digest. Partial-byte evidence stays in the
    // canonical /inspection response until the shared UI contract is adopted.
    current.findings=next.reports.filter(r=>r.state==='completed').flatMap(r=>r.findings.map(kind=>({name:r.reportRef,kind,reason:'Bounded local indicator; review the inspection report. This does not prove malware.',sha256:r.sha256}))).slice(0,128);
   };
   let result;
   if(nativeAppDir){
    if(nativeService)await nativeService.close();
    if(closed||current.cancel){current.status='cancelled';return;}
    nativeService=createNativeActionService({executable:nativeExecutable,path,kind:stat.isDirectory()?'folder':'file',appDir:nativeAppDir,onSnapshot:receive});
    result=await nativeService.ready;
   }else result=await inspectNative({executable:nativeExecutable,path,kind:stat.isDirectory()?'folder':'file',cancelled:()=>closed||current.cancel,onSnapshot:receive});
   current.status=result.snapshot?.cancellationRequested?'cancelled':result.status==='cancelled'||result.status==='timed_out'?result.status:result.status==='finished'?'partial':'failed';
   if(current.status==='failed')current.errors++;
   event('desktop',current.status==='failed'?'scan_failed':current.status==='cancelled'?'scan_cancelled':'scan_completed');
  }catch{current.errors++;current.status='failed';event('desktop','scan_failed');}
 }
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
  req.setTimeout(req.url==='/ai-chat'?65000:req.url==='/ai-quick'?40000:5000,()=>req.destroy());
  let body;
  const bodyLimit=req.url==='/ai-answer'&&desktop&&equal(req.headers['x-sentinel-native-action'],nativeActionToken)?24000:req.url==='/ai-message'&&browser?12000:4096;
  try{let size=0;const chunks=[];for await(const c of req){size+=c.length;if(size>bodyLimit)return respond(413,{error:'request_too_large'});chunks.push(c);}body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return respond(400,{error:'invalid_request'});}
  if(req.url==='/ai-chat'||req.url==='/ai-chat-status'||req.url==='/ai-chat-cancel'){
   if(!desktop||!equal(req.headers['x-sentinel-native-action'],nativeActionToken))return respond(403,{error:'forbidden'});
   if(req.url==='/ai-chat-status'&&Object.keys(body).length===0)return respond(200,chatAi.status());
   if(req.url==='/ai-chat-cancel'&&Object.keys(body).length===0){chatQueue.cancelConsole();return respond(200,{ok:true});}
   if(req.url==='/ai-chat'&&Object.keys(body).sort().join(',')==='findingRef,question')try{const finding=body.findingRef===null?null:aiHandoff.resolve(body.findingRef);return respond(200,await runChat(body.question,finding));}catch(error){return respond(400,{error:['quick_question_too_long','local_model_busy','local_model_unavailable','local_cancelled_or_timed_out','finding_unknown_or_expired'].includes(error.message)?error.message:'local_response_unavailable'});}
   return respond(400,{error:'invalid_request'});
  }
  if(req.url==='/ai-local-status'||req.url==='/ai-quick'||req.url==='/ai-quick-cancel'){
   if(!desktop)return respond(403,{error:'forbidden'});
   if(req.url==='/ai-local-status'&&Object.keys(body).length===0)return respond(200,localAi.status());
   if(req.url==='/ai-quick-cancel'){if(Object.keys(body).length===0){localAi.cancel();return respond(200,{ok:true});}if(Object.keys(body).join(',')==='findingRef'&&(body.findingRef===null||typeof body.findingRef==='string'&&/^[a-f0-9]{32}$/.test(body.findingRef))){const row=localRequests.get(body.findingRef);if(row)row.cancelled=true;if(activeLocalRef===body.findingRef)localAi.cancel();return respond(200,{ok:true});}return respond(400,{error:'invalid_request'});}
   if(req.url==='/ai-quick'&&Object.keys(body).sort().join(',')==='findingRef,question'){
    try{const finding=body.findingRef===null?null:aiHandoff.resolve(body.findingRef);const prepared=localRequests.get(body.findingRef);const result=prepared&&prepared.question===body.question?await prepared.promise:await localAi.answer(body.question,finding);if(body.findingRef!==null)aiHandoff.publishQuick(body.findingRef,result);return respond(200,result);}catch(error){return respond(400,{error:['quick_question_too_long','local_model_busy','local_model_unavailable','local_cancelled_or_timed_out','local_response_unavailable','finding_unknown_or_expired'].includes(error.message)?error.message:'local_response_unavailable'});}
   }return respond(400,{error:'invalid_request'});
  }
  if(req.url==='/ai-open'||req.url==='/ai-message'||req.url==='/ai-handoff'||req.url==='/ai-inbox'||req.url==='/ai-finding'||req.url==='/ai-answer'||req.url==='/ai-result'){
   try{
    if(req.url==='/ai-open'){if(!browser||Object.keys(body).join(',')!=='ref')return respond(403,{error:'forbidden'});return respond(200,aiHandoff.open(body.ref));}
    if(req.url==='/ai-message'){if(!browser)return respond(403,{error:'forbidden'});const handoff=aiHandoff.createMessage(body);if(localExplanations)startLocalExplanation(handoff);return respond(200,handoff);}
    if(req.url==='/ai-handoff'){
     if(!browser)return respond(403,{error:'forbidden'});
     const handoff=aiHandoff.create(body);if(localExplanations)startLocalExplanation(handoff);return respond(200,handoff);
    }
    if(req.url==='/ai-result'&&browser&&Object.keys(body).length===1)return respond(200,{result:aiHandoff.answer(body.ref),quick:aiHandoff.quick(body.ref),localError:localRequests.get(body.ref)?.error??null});
    if(req.url==='/ai-answer'){
     if(!desktop||!equal(req.headers['x-sentinel-native-action'],nativeActionToken))return respond(403,{error:'forbidden'});
     if(Object.keys(body).sort().join(',')!=='ref,result')return respond(400,{error:'invalid_request'});
     aiHandoff.publish(body.ref,body.result);return respond(200,{ok:true});
    }
    if(!desktop)return respond(403,{error:'forbidden'});
    if(req.url==='/ai-inbox'&&Object.keys(body).length===0)return respond(200,{handoff:aiHandoff.take()});
    if(req.url==='/ai-finding'&&Object.keys(body).length===1&&typeof body.ref==='string')return respond(200,{finding:aiHandoff.resolve(body.ref)});
    return respond(400,{error:'invalid_request'});
   }catch(error){return respond(400,{error:['replayed_handoff','handoff_capacity','finding_unknown_or_expired'].includes(error.message)?error.message:'invalid_handoff'});}
  }
  if(!keys(body,['id','path','extensionId','risk','codes','reportRef','actionRef','restoreRef','name','user','host','password']))return respond(400,{error:'invalid_request'});
  if(req.url==='/account-update'){
   if(!desktop||!equal(req.headers['x-sentinel-native-action'],nativeActionToken))return respond(403,{error:'native_approval_required'});
   const text=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.length<=max&&!/[\x00-\x1f\x7f]/.test(v);
   if(!keys(body,['id','name','user','host','password'])||!text(body.name,80)||!text(body.user,254)||!text(body.host,253)||!/^[a-zA-Z0-9.-]+$/.test(body.host)||(Object.hasOwn(body,'password')&&(!text(body.password,256))))return respond(400,{error:'invalid_login'});
   const account=accounts.find(a=>a.id===body.id);if(!account)return respond(400,{error:'invalid_account'});
   if(accounts.some(a=>a.id!==body.id&&a.user===body.user.trim()&&a.host===body.host.toLowerCase()))return respond(409,{error:'account_exists'});
   Object.assign(account,{name:body.name.trim(),user:body.user.trim(),host:body.host.toLowerCase()});
   if(Object.hasOwn(body,'password'))account.password=body.password;
   revision++;event('desktop','account_updated');return respond(200,{ok:true});
  }
  if(req.url==='/account-add'||req.url==='/account-remove'){
   if(!desktop||!equal(req.headers['x-sentinel-native-action'],nativeActionToken))return respond(403,{error:'native_approval_required'});
   if(req.url==='/account-remove'){
    if(!keys(body,['id'])||typeof body.id!=='string')return respond(400,{error:'invalid_account'});
    const index=accounts.findIndex(a=>a.id===body.id);if(index<0)return respond(400,{error:'invalid_account'});
    accounts.splice(index,1);revision++;event('desktop','account_removed');return respond(200,{ok:true});
   }
   const text=(value,max)=>typeof value==='string'&&value.trim().length>0&&value.length<=max&&!/[\x00-\x1f\x7f]/.test(value);
   if(!keys(body,['name','user','host','password'])||!text(body.name,80)||!text(body.user,254)||!text(body.host,253)||!/^[a-zA-Z0-9.-]+$/.test(body.host))return respond(400,{error:'invalid_login'});
   if(Object.hasOwn(body,'password')&&!text(body.password,256))return respond(400,{error:'invalid_login'});
   if(accounts.length>=128)return respond(409,{error:'account_limit'});
   if(accounts.some(a=>a.user===body.user.trim()&&a.host.toLowerCase()===body.host.toLowerCase()))return respond(409,{error:'account_exists'});
   let password=body.password||'';for(let attempt=0;!password&&attempt<32;attempt++){const candidate=generatePassword(24,webcrypto);if(auditPassword(candidate).health==='Stronger'&&!accounts.some(a=>a.password===candidate)){password=candidate;break;}}
   if(!password)return respond(503,{error:'generation_unavailable'});
   const id='account_'+randomBytes(8).toString('hex');accounts.push({id,name:body.name.trim(),user:body.user.trim(),host:body.host.toLowerCase(),password});revision++;event('desktop','account_added');return respond(200,{ok:true,id});
  }
  if(req.url==='/watchtower-domain'){if(!browser)return respond(403,{error:'forbidden'});if(keys(body,['host'])&&Object.keys(body).length===1&&body.host===null){forgetBrowserDomains();return respond(200,{ok:true});}if(!keys(body,['host','codes'])||(body.codes!==undefined&&(!Array.isArray(body.codes)||body.codes.length>2||!body.codes.every(code=>['portal_credentials','portal_payment'].includes(code))))||!rememberBrowserDomain(body.host,Date.now(),body.codes??[]))return respond(400,{error:'invalid_request'});return respond(200,{ok:true});}
  if(req.url==='/watchtower-preference'){if(!desktop)return respond(403,{error:'forbidden'});if(!keys(body,['host','risk'])||Object.keys(body).length!==2)return respond(400,{error:'invalid_request'});try{return respond(200,await watchtowerPreferences.change(body.host,body.risk));}catch{return respond(503,{error:'preferences_unavailable'});}}
  if(req.url==='/wifi'){
   if(!desktop)return respond(403,{error:'forbidden'});
   if(!keys(body,[]))return respond(400,{error:'invalid_request'});
   try{return respond(200,await (wifiMonitor?wifiMonitor.read():observeWifi()));}catch(error){return respond(503,{error:['wifi_busy','wifi_unsupported'].includes(error.message)?error.message:'wifi_unavailable'});}
  }
  if(req.url==='/usb'){
   if(!desktop)return respond(403,{error:'forbidden'});if(!keys(body,[]))return respond(400,{error:'invalid_request'});
   try{return respond(200,await (usbMonitor?usbMonitor.read():observeUsb()));}catch(error){return respond(503,{error:['usb_busy','usb_unsupported'].includes(error.message)?error.message:'usb_unavailable'});}
  }
  const actionRoutes={
   '/quarantine-prepare':['reportRef',v=>nativeService.prepareQuarantine(v)],
   '/quarantine-confirm':['actionRef',v=>nativeService.nativeQuarantineDecision(v,true)],
   '/quarantine-decline':['actionRef',v=>nativeService.nativeQuarantineDecision(v,false)],
   '/restore-prepare':['actionRef',v=>nativeService.prepareRestore(v)],
   '/restore-confirm':['restoreRef',v=>nativeService.nativeRestoreDecision(v,true)],
   '/restore-decline':['restoreRef',v=>nativeService.nativeRestoreDecision(v,false)]
  };
  if(Object.hasOwn(actionRoutes,req.url)){
   if(!desktop||!equal(req.headers['x-sentinel-native-action'],nativeActionToken))return respond(403,{error:'forbidden'});
   const [key,operation]=actionRoutes[req.url];
   if(!keys(body,[key])||Object.keys(body).length!==1||typeof body[key]!=='string'||!/^[A-Za-z0-9_-]{1,64}$/.test(body[key]))return respond(400,{error:'invalid_request'});
   if(!nativeService)return respond(503,{type:'error',data:{code:'unavailable'}});
   if(nativeActionInFlight)return respond(409,{error:'action_busy'});
   nativeActionInFlight=true;
   try{
    const result=await operation(body[key]);


    return respond(200,result);
   }finally{nativeActionInFlight=false;}
  }
  if(req.url==='/state'&&keys(body,[])){const snapshot=state();if(browser)snapshot.scan=null;return respond(200,snapshot);}
  if(req.url==='/inspection'&&desktop&&keys(body,[]))return respond(200,{snapshot:nativeSnapshot});
  if(req.url==='/shutdown'&&desktop&&keys(body,[])){res.once('finish',()=>{void close().then(onShutdown);});return respond(200,{ok:true});}
  if(req.url==='/event'&&browser&&keys(body,['risk','codes'])&&['suspicious','unknown'].includes(body.risk)&&Array.isArray(body.codes)&&body.codes.length<=16&&body.codes.every(c=>allowedCodes.has(c))){event('browser',body.risk,Array.from(new Set(body.codes)));return respond(200,{ok:true});}
  if(req.url==='/pair'&&desktop&&keys(body,['extensionId'])&&typeof body.extensionId==='string'&&/^[a-p]{32}$/.test(body.extensionId)){extensionId=body.extensionId;browserToken=randomBytes(32).toString('hex');return respond(200,{token:browserToken,port:server.address().port,extensionId});}
  if(req.url==='/unlock'&&keys(body,[])){unlocked=true;return respond(200,{ok:true});}
  if(req.url==='/lock'&&keys(body,[])){unlocked=false;return respond(200,{ok:true});}
  if(['/rotate','/reveal'].includes(req.url)&&keys(body,['id'])){
   if(!desktop||!equal(req.headers['x-sentinel-native-action'],nativeActionToken))return respond(403,{error:'native_approval_required'});
   const account=accounts.find(a=>a.id===body.id);if(!account)return respond(400,{error:'invalid_account'});
   if(req.url==='/rotate'){
    let generated='';
    for(let attempt=0;attempt<32;attempt++){const candidate=generatePassword(24,webcrypto);if(auditPassword(candidate).health==='Stronger'&&!accounts.some(a=>a.password===candidate)){generated=candidate;break;}}
    if(!generated)return respond(503,{error:'generation_unavailable'});
    account.password=generated;revision++;event(desktop?'desktop':'browser','demo_password_rotated');return respond(200,{ok:true});
   }
   return respond(200,{password:account.password,mode:'synthetic_demo'});
  }
  if(req.url==='/cancel'&&desktop&&keys(body,[])){if(scan?.status==='running')scan.cancel=true;nativeService?.cancel();return respond(200,{ok:true});}
  if(req.url==='/scan'&&desktop&&keys(body,['path'])){
   if(nativeActionInFlight)return respond(409,{error:'action_busy'});
   // Authenticated on-disk journals now retain recovery independently of this scan session.
   if(scan?.status==='running')return respond(409,{error:'scan_busy'});
   const ordinaryPath=typeof body.path==='string'&&(process.platform==='win32'?/^[a-df-z]:[\\/]/i.test(body.path):/^\/(?!\/)/.test(body.path));
   if(!ordinaryPath||body.path.length>1024||/^E:/i.test(body.path)||body.path.includes('\0'))return respond(400,{error:'selection_unsupported'});
   scan={id:randomBytes(12).toString('hex'),status:'running',coverage:'partial',engine:'Bounded read-only SHA-256 and harmless synthetic signatures',visited:0,checked:0,skipped:0,errors:0,bytes:0,files:[],findings:[],cancel:false};
   nativeSnapshot=null;
   if(nativeExecutable){scan.engine='Rust bounded byte inspection; partial coverage';activeScan=runNativeScan(resolve(body.path),scan);}
   else activeScan=runScan(resolve(body.path),scan);
   return respond(200,{id:scan.id});
  }
  return respond(desktop?400:403,{error:desktop?'invalid_request':'forbidden'});
 });
 server.maxConnections=8;server.requestTimeout=5000;server.headersTimeout=5000;
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
 function close(){if(!closing){closed=true;if(scan)scan.cancel=true;closing=(async()=>{chatQueue.close();await Promise.all([wifiMonitor?.close(),usbMonitor?.close(),localAi.close(),chatAi.close()]);server.closeAllConnections();await new Promise(resolve=>server.close(resolve));if(nativeService)await nativeService.close();await activeScan;})();}return closing;}
 return {desktopToken,nativeActionToken,url:'http://127.0.0.1:'+server.address().port,port:server.address().port,close};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const nativeExecutable=fileURLToPath(new URL('../desktop/console-build/sentinel-inspect.exe',import.meta.url));
 const nativeAppDir=process.env.LOCALAPPDATA?join(process.env.LOCALAPPDATA,'Sentinel-School-Demo','inspection-vault'):null;
 const runtime=await startRuntime({onShutdown:()=>process.exit(0),nativeExecutable,nativeAppDir,autoObserve:true});
 await writeFile(new URL('../desktop/console-build/demo-runtime.json',import.meta.url),JSON.stringify({url:runtime.url,token:runtime.desktopToken,nativeActionToken:runtime.nativeActionToken}),{mode:0o600});
 process.on('SIGTERM',async()=>{await runtime.close();process.exit(0);});
}
