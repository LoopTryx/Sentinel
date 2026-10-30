import test from 'node:test';
import assert from 'node:assert/strict';
import {startRuntime} from '../../demo-runtime/server.mjs';
import {demoRequest} from '../src/demo-transport.js';
test('actual extension transport shares edits and events, refuses content scripts and desktop scan actions',async()=>{
 const runtime=await startRuntime();const id='c'.repeat(32);let config;
 globalThis.chrome={runtime:{id,getURL:path=>`chrome-extension://${id}/${path}`},storage:{session:{get:async()=>({sentinelDemoConnection:config})}}};
 try{
  const pairing=await fetch(runtime.url+'/pair',{method:'POST',headers:{Authorization:'Bearer '+runtime.desktopToken,'Content-Type':'application/json'},body:JSON.stringify({extensionId:id})});config=await pairing.json();
  const sender={id,url:`chrome-extension://${id}/popup.html`};
  await assert.rejects(demoRequest({method:'state'},{id,url:'https://example.test/'}),/forbidden/);
  await assert.rejects(demoRequest({method:'scan',data:{path:'C:/private'}},sender),/unsupported/);
  let state=await demoRequest({method:'state'},sender);assert.equal(state.accounts[0].health,'Very weak');
  await assert.rejects(demoRequest({method:'rotate',data:{id:'mail'}},sender),/unsupported/);
  await fetch(runtime.url+'/rotate',{method:'POST',headers:{Authorization:'Bearer '+runtime.desktopToken,'X-Sentinel-Native-Action':runtime.nativeActionToken,'Content-Type':'application/json'},body:JSON.stringify({id:'mail'})});
  await demoRequest({method:'event',data:{risk:'suspicious',codes:['http']}},sender);
  const reportSender={id,url:chrome.runtime.getURL('xray.html')};
  await assert.rejects(demoRequest({method:'reveal',data:{id:'mail'}},reportSender),/forbidden/);
  await demoRequest({method:'event',data:{risk:'suspicious',codes:['shortened']}},reportSender);
  state=await demoRequest({method:'state'},sender);assert.equal(state.revision,1);assert.equal(state.accounts[0].health,'Stronger');assert.equal(state.events[0].source,'browser');assert.equal(state.scan,null);
 }finally{delete globalThis.chrome;await runtime.close();}
});
