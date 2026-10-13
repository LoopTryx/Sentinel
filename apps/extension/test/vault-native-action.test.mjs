import test from 'node:test';import assert from 'node:assert/strict';import {demoRequest} from '../src/demo-transport.js';
test('protected actions route through native approval and never return passwords or retry mutation',async()=>{
 const id='c'.repeat(32),sender={id,url:`chrome-extension://${id}/popup.html`};let calls=0;
 globalThis.chrome={runtime:{id,getURL:path=>`chrome-extension://${id}/${path}`,sendNativeMessage:async(name,data)=>{calls++;assert.equal(name,'com.looptryx.sentinel');assert.deepEqual(data,{operation:'copy',id:'mail'});return {ok:true,password:'must-not-leave-native'};}}};
 try{assert.deepEqual(await demoRequest({method:'vault.copy',data:{id:'mail'}},sender),{ok:true});assert.equal(calls,1);
  await assert.rejects(demoRequest({method:'vault.copy',data:{id:'mail',extra:true}},sender),/invalid_request/);assert.equal(calls,1);
  globalThis.chrome.runtime.sendNativeMessage=async()=>{calls++;return {error:'declined'};};await assert.rejects(demoRequest({method:'vault.copy',data:{id:'mail'}},sender),/declined/);assert.equal(calls,2);
 }finally{delete globalThis.chrome;}
});
