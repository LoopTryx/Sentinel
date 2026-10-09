import test from 'node:test';
import assert from 'node:assert/strict';
import {startRuntime} from '../../demo-runtime/server.mjs';
import {demoRequest} from '../src/demo-transport.js';
test('actual extension transport shares edits and events, refuses content scripts and desktop scan actions',async()=>{
 const runtime=await startRuntime();const id='c'.repeat(32);let config;let storageReads=0;
 globalThis.chrome={runtime:{id,getURL:path=>`chrome-extension://${id}/${path}`},storage:{session:{get:async()=>{storageReads++;return {sentinelDemoConnection:config};}}}};
 try{
  const pairing=await fetch(runtime.url+'/pair',{method:'POST',headers:{Authorization:'Bearer '+runtime.desktopToken,'Content-Type':'application/json'},body:JSON.stringify({extensionId:id})});config=await pairing.json();
  const sender={id,url:`chrome-extension://${id}/popup.html`};
  await assert.rejects(demoRequest({method:'state'},{id,url:'https://example.test/'}),/forbidden/);
  await assert.rejects(demoRequest({method:'scan',data:{path:'C:/private'}},sender),/unsupported/);
  let state=await demoRequest({method:'state'},sender);assert.equal(state.accounts[0].health,'Very weak');
  await demoRequest({method:'unlock'},sender);await demoRequest({method:'rotate',data:{id:'mail'}},sender);
  await demoRequest({method:'event',data:{risk:'suspicious',codes:['http']}},sender);
  const reportSender={id,url:chrome.runtime.getURL('xray.html')};
  await assert.rejects(demoRequest({method:'reveal',data:{id:'mail'}},reportSender),/forbidden/);
  await demoRequest({method:'event',data:{risk:'suspicious',codes:['shortened']}},reportSender);
  const warningSender={id,url:chrome.runtime.getURL('warning.html')+'#listed',frameId:0};
  await assert.rejects(demoRequest({method:'event',data:{risk:'suspicious',codes:['risk_list']}},{...warningSender,frameId:1}),/forbidden/);
  await assert.rejects(demoRequest({method:'event',data:{risk:'suspicious',codes:['risk_list']}},{...warningSender,frameId:undefined}),/forbidden/);
  await assert.rejects(demoRequest({method:'reveal',data:{id:'mail'}},warningSender),/forbidden/);
  for(const data of [
   {risk:'suspicious',codes:['risk_list'],url:'https://private.example.test/secret'},
   {risk:'suspicious',codes:['pressure']},
   {risk:'suspicious',codes:['reward_payment']},
   {risk:'unknown',codes:['risk_list']},
   {risk:'suspicious',codes:['risk_list','risk_list']},
   {risk:'suspicious',codes:[]},
  ]){
   const before=storageReads;
   await assert.rejects(demoRequest({method:'event',data},warningSender),/invalid_request/);
   assert.equal(storageReads,before,'invalid warning data must be refused before pairing access or network');
  }
  const beforeUnknown=storageReads;
  await assert.rejects(demoRequest({method:'event',data:{risk:'suspicious',codes:['risk_list']}},{...warningSender,url:chrome.runtime.getURL('warning.html')+'#unknown'}),/invalid_request/);
  assert.equal(storageReads,beforeUnknown);
  await demoRequest({method:'event',data:{risk:'suspicious',codes:['reward_payment']}},{...warningSender,url:chrome.runtime.getURL('warning.html')+'#keywords'});
  await demoRequest({method:'event',data:{risk:'suspicious',codes:['risk_list']}},warningSender);
  state=await demoRequest({method:'state'},sender);assert.deepEqual(state.events[0].codes,['risk_list']);assert.equal(state.revision,1);assert.equal(state.accounts[0].health,'Stronger');assert.equal(state.events[0].source,'browser');assert.equal(state.scan,null);
 }finally{delete globalThis.chrome;await runtime.close();}
});
