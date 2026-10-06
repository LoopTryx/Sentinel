import test from 'node:test';
import assert from 'node:assert/strict';
import {setWhatsAppWarnings,whatsAppStatus} from '../src/whatsapp-control.js';
test('WhatsApp opt-in refuses missing permissions without installing observers',async()=>{
 let changed=false;
 await assert.rejects(setWhatsAppWarnings({permissions:{contains:async()=>false},scripting:{registerContentScripts:async()=>{changed=true;}}},true),/permission/);
 assert.equal(changed,false);
});
test('enable registers only WhatsApp, injects into existing matching tabs; pause unregisters and clears',async()=>{
 let scripts=[],injected=[],cleared=[];
 let optedIn=false;const api={storage:{local:{get:async()=>({whatsappOptIn:optedIn}),set:async s=>{optedIn=s.whatsappOptIn;}}},permissions:{contains:async()=>true},scripting:{getRegisteredContentScripts:async()=>scripts,registerContentScripts:async s=>{scripts=s;},unregisterContentScripts:async()=>{scripts=[];},executeScript:async s=>{injected.push(s.target.tabId);}},tabs:{query:async()=>[{id:5,url:'https://web.whatsapp.com/'},{id:6,url:'https://example.test/'}],sendMessage:async id=>cleared.push(id)}};
 assert.equal((await setWhatsAppWarnings(api,true)).enabled,true);
 assert.deepEqual(scripts[0].matches,['https://web.whatsapp.com/*']);
 assert.deepEqual(injected,[5]);
 await setWhatsAppWarnings(api,true);assert.equal(scripts.length,1);
 assert.equal((await setWhatsAppWarnings(api,false)).enabled,false);assert.deepEqual(cleared,[5,6]);
});
test('registered observer never reports active after site permission is revoked',async()=>{
 assert.equal((await whatsAppStatus({storage:{local:{get:async()=>({whatsappOptIn:true})}},permissions:{contains:async()=>false},scripting:{getRegisteredContentScripts:async()=>[{id:'sentinel-whatsapp'}]}})).enabled,false);
});
test('pause after permission revocation persists opt-out and reaches existing content scripts',async()=>{
 let optedIn=true,cleared=[];
 const api={storage:{local:{get:async()=>({whatsappOptIn:optedIn}),set:async s=>{optedIn=s.whatsappOptIn;}}},permissions:{contains:async()=>false},tabs:{query:async()=>[{id:5}],sendMessage:async id=>cleared.push(id)}};
 assert.equal((await setWhatsAppWarnings(api,false)).enabled,false);
 assert.equal(optedIn,false);assert.deepEqual(cleared,[5]);
});
