import test from 'node:test';import assert from 'node:assert/strict';import {startRuntime} from '../../demo-runtime/server.mjs';import {messageAiRequest} from '../src/message-ai-transport.js';
test('content transport authenticates source, rechecks opt-in, scopes references and cannot publish cloud results',async()=>{
 const runtime=await startRuntime(),id='f'.repeat(32);let enabled=true,openedTab=null,nativeCalls=0;
 const config=await (await fetch(runtime.url+'/pair',{method:'POST',headers:{Authorization:'Bearer '+runtime.desktopToken,'Content-Type':'application/json'},body:JSON.stringify({extensionId:id})})).json();
 const api={tabs:{create:async value=>{openedTab=value;return {id:9};}},runtime:{id,getURL:path=>'chrome-extension://'+id+'/'+path,sendNativeMessage:async()=>{nativeCalls++;return {ok:true};}},permissions:{contains:async()=>true},storage:{local:{get:async key=>({[key]:enabled})},session:{get:async()=>({sentinelDemoConnection:config})}}};const sender={id,frameId:0,tab:{id:3},documentId:'doc',url:'https://web.whatsapp.com/'};
 try{
  await assert.rejects(messageAiRequest({kind:'message_ai',action:'explain',text:'hi'},{...sender,url:'https://attacker.test/'},api),/forbidden/);
  const handoff=await messageAiRequest({kind:'message_ai',action:'explain',text:'Urgent! Send your password now. https://bit.ly/claim'},sender,api);assert.match(handoff.ref,/^[a-f0-9]{32}$/);
  const local=await messageAiRequest({kind:'message_ai',action:'result',ref:handoff.ref},sender,api);assert.deepEqual(local,{quick:null});
  await assert.rejects(messageAiRequest({kind:'message_ai',action:'result',ref:handoff.ref},{...sender,tab:{id:4}},api),/expired/);
  await assert.rejects(messageAiRequest({kind:'message_ai',action:'publish',ref:handoff.ref},sender,api),/invalid/);
  const second=await messageAiRequest({kind:'message_ai',action:'explain',text:'Urgent! Send your password now. https://bit.ly/claim'},{...sender,tab:{id:5}},api);assert.equal(second.ref,handoff.ref);assert.deepEqual(await messageAiRequest({kind:'message_ai',action:'result',ref:handoff.ref},sender,api),{quick:null});
  await messageAiRequest({kind:'message_ai',action:'open',ref:handoff.ref},sender,api);assert.equal(nativeCalls,0);assert.equal(openedTab?.url,api.runtime.getURL('continue.html')+'#'+handoff.ref);
  enabled=false;await assert.rejects(messageAiRequest({kind:'message_ai',action:'open',ref:handoff.ref},sender,api),/disabled/);
 }finally{await runtime.close();}
});
