import {test} from 'node:test';
import assert from 'node:assert/strict';
import {startRuntime} from './server.mjs';
import {demoRequest} from '../extension/src/demo-transport.js';
test('real authenticated extension transport resolves evidence and consumes handoff without exposing native authority',async()=>{
 const runtime=await startRuntime();const id='c'.repeat(32);let config;
 globalThis.chrome={runtime:{id,getURL:path=>`chrome-extension://${id}/${path}`},storage:{session:{get:async()=>({sentinelDemoConnection:config})}}};
 const post=async(path,token,body,extra={})=>fetch(runtime.url+path,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...extra},body:JSON.stringify(body)});
 try{
  config=await (await post('/pair',runtime.desktopToken,{extensionId:id})).json();
  const input={url:'https://example.test/winner-payment',question:'Why?',nonce:'e'.repeat(32)};
  assert.equal((await post('/ai-handoff',runtime.desktopToken,input)).status,403);
  assert.equal((await post('/ai-handoff','0'.repeat(64),input)).status,403);
  await assert.rejects(demoRequest({method:'ai-handoff',data:input},{id,url:'https://example.test/'}),/forbidden/);
  const result=await demoRequest({method:'ai-handoff',data:input},{id,url:chrome.runtime.getURL('warning.html')});
  assert.equal(result.finding.source,'local_url_assessment');
  assert.ok(!JSON.stringify(result).includes(runtime.nativeActionToken));
  await assert.rejects(demoRequest({method:'ai-handoff',data:input},{id,url:chrome.runtime.getURL('warning.html')}),/replayed/);
  assert.equal((await post('/ai-inbox',config.token,{}, {'X-Sentinel-Extension':id})).status,403);
  const inbox=await (await post('/ai-inbox',runtime.desktopToken,{})).json();assert.equal(inbox.handoff.finding.ref,result.finding.ref);
  assert.equal((await (await post('/ai-inbox',runtime.desktopToken,{})).json()).handoff,null);
  const evidence=await (await post('/ai-finding',runtime.desktopToken,{ref:result.finding.ref})).json();assert.deepEqual(evidence.finding,result.finding);
  const answer={provider:'NVIDIA NIM',model:'meta/llama-3.1-8b-instruct',kind:'provider_interpretation',answer:{evidenceRefs:['reward_payment'],explanation:'Interpretation only.',uncertainty:'A clue is not proof.',recommendations:[]}};
  assert.equal((await post('/ai-answer',config.token,{ref:result.finding.ref,result:answer},{'X-Sentinel-Extension':id})).status,403);
  assert.equal((await post('/ai-answer',runtime.desktopToken,{ref:result.finding.ref,result:answer})).status,403);
  assert.equal((await post('/ai-answer',runtime.desktopToken,{ref:result.finding.ref,result:answer},{'X-Sentinel-Native-Action':runtime.nativeActionToken})).status,200);
  const returned=await demoRequest({method:'ai-result',data:{ref:result.finding.ref}},{id,url:chrome.runtime.getURL('warning.html')});assert.deepEqual(returned.result,answer);
  assert.equal((await post('/ai-finding',runtime.desktopToken,{ref:'f'.repeat(32)})).status,400);
 }finally{delete globalThis.chrome;await runtime.close();}
});
