import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startRuntime} from './server.mjs';

test('actual shared runtime: authentication, computed dummy audit, edits and redacted events', async () => {
 const r = await startRuntime();
 const call = (route, body={}, token=r.desktopToken, extra={}) => fetch(r.url+route,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...extra},body:JSON.stringify(body)});
 try {
  assert.equal((await call('/state',{},'forged')).status,403);
  let state=await (await call('/state')).json();
  assert.equal(state.accounts.length,4); assert.equal(state.accounts[0].health,'Very weak');
  assert.equal(state.accounts.filter(a=>a.reused).length,2);
  assert.ok(!JSON.stringify(state).includes('password123'));
  assert.equal((await call('/rotate',{id:'school'})).status,423);
  await call('/unlock'); await call('/rotate',{id:'school'});
  state=await (await call('/state')).json(); assert.equal(state.accounts.filter(a=>a.reused).length,0);
  assert.equal(state.accounts.find(a=>a.id==='school').health,'Stronger');
  const pairing=await (await call('/pair',{extensionId:'a'.repeat(32)})).json();
  const browserHeaders={Origin:'chrome-extension://'+'a'.repeat(32),'X-Sentinel-Extension':'a'.repeat(32)};
  assert.equal((await call('/state',{},pairing.token,{...browserHeaders,Origin:'https://evil.test'})).status,403);
  assert.equal((await call('/scan',{path:'C:/private'},pairing.token,browserHeaders)).status,403);
  assert.equal((await call('/event',{risk:'suspicious',codes:['http','shortened'],rawUrl:'secret'},pairing.token,browserHeaders)).status,400);
  assert.equal((await call('/event',{risk:'suspicious',codes:['http','shortened']},pairing.token,browserHeaders)).status,200);
  state=await (await call('/state')).json(); assert.equal(state.events[0].source,'browser');
  assert.ok(!JSON.stringify(state.events).includes('password123')); assert.ok(!JSON.stringify(state.events).includes('secret'));
 } finally {await r.close();}
});

test('real harmless file bytes produce bounded synthetic findings, errors and cancellation states', async()=>{
 const folder=await mkdtemp(join(tmpdir(),'sentinel-demo-'));
 const r=await startRuntime();
 const call=async(route,body={})=>(await fetch(r.url+route,{method:'POST',headers:{Authorization:'Bearer '+r.desktopToken,'Content-Type':'application/json'},body:JSON.stringify(body)})).json();
 try {
  await writeFile(join(folder,'clean.txt'),'ordinary harmless text');
  await writeFile(join(folder,'example.txt'),'SENTINEL_SYNTHETIC_TEST_ONLY_V1');
  const started=await call('/scan',{path:folder});
  let s; for(let i=0;i<100;i++){s=await call('/state');if(s.scan?.status!=='running')break;await new Promise(res=>setTimeout(res,10));}
  assert.equal(s.scan.id,started.id); assert.equal(s.scan.status,'completed');
  assert.equal(s.scan.checked,2); assert.equal(s.scan.findings.length,1);
  assert.equal(s.scan.findings[0].kind,'synthetic_test'); assert.equal(s.scan.coverage,'partial');
  assert.equal((await call('/scan',{path:'E:/anything'})).error,'selection_unsupported');
  for(const path of ['//?/E:/anything','//localhost/E$/anything','\\\\?\\E:\\anything'])assert.equal((await call('/scan',{path})).error,'selection_unsupported');
  await call('/scan',{path:join(folder,'missing')});
  for(let i=0;i<100;i++){s=await call('/state');if(s.scan?.status!=='running')break;await new Promise(res=>setTimeout(res,10));}
  assert.equal(s.scan.status,'failed'); assert.equal(s.scan.checked,0);
 }finally{await r.close();await rm(folder,{recursive:true,force:true});}
});

test('browser edits are shared, scan details stay desktop-only and old pairing keys are revoked',async()=>{
 const r=await startRuntime();const id='b'.repeat(32);
 const call=async(route,body={},token=r.desktopToken,headers={})=>fetch(r.url+route,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
 try{
  const pair=await (await call('/pair',{extensionId:id})).json();const headers={'X-Sentinel-Extension':id,Origin:'chrome-extension://'+id};
  await call('/unlock',{},pair.token,headers);await call('/rotate',{id:'mail'},pair.token,headers);
  const desktop=await (await call('/state')).json();assert.equal(desktop.revision,1);assert.ok(desktop.events.some(e=>e.source==='browser'));
  const browser=await (await call('/state',{},pair.token,headers)).json();assert.equal(browser.scan,null);
  await call('/pair',{extensionId:id});assert.equal((await call('/state',{},pair.token,headers)).status,403);
  assert.equal((await call('/state',{},'é'.repeat(64))).status,403);
 }finally{await r.close();}
});
