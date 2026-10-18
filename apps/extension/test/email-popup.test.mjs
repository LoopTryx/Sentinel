import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {readFile} from 'node:fs/promises';
import {installEmailControl} from '../src/email/control.js';
const require=createRequire(new URL('../../ui/package.json',import.meta.url)),{JSDOM}=require('jsdom');
test('trusted-sender deep link reveals and focuses the form, and real save/remove handlers update the sender store',async()=>{
 const dom=new JSDOM(await readFile(new URL('../popup.html',import.meta.url),'utf8'),{url:'https://extension.example.test/popup.html?view=settings#email-trust-form'}),doc=dom.window.document;
 let listener;const saved={};const api={runtime:{id:'unit',getURL:p=>'chrome-extension://unit/'+p,onMessage:{addListener:f=>listener=f},sendMessage:message=>new Promise(resolve=>{if(!listener(message,{id:'unit',url:'chrome-extension://unit/popup.html?view=settings#email-trust-form'},resolve))resolve({});})},storage:{local:{setAccessLevel:async()=>{},get:async key=>({[key]:saved[key]}),set:async v=>Object.assign(saved,v)}},permissions:{contains:async()=>false}};
 installEmailControl(api);const previous={document:globalThis.document,location:globalThis.location,chrome:globalThis.chrome};Object.assign(globalThis,{document:doc,location:dom.window.location,chrome:api});
 const tick=()=>new Promise(resolve=>setImmediate(resolve));
 try{await import('../src/popup.js');await import('../src/email/popup.js');assert.equal(doc.body.classList.contains('dashboard'),true);await tick();const form=doc.getElementById('email-trust-form'),input=doc.getElementById('email-address');
  assert.equal(form.closest('details').open,true);assert.equal(doc.activeElement,input);
  input.value='person@example.test';form.dispatchEvent(new dom.window.Event('submit',{cancelable:true}));await tick();
  assert.match(doc.getElementById('email-trusted').textContent,/person@example.test/);assert.match(doc.getElementById('email-feedback').textContent,/Sender trusted/);
  doc.querySelector('#email-trusted button').click();await tick();assert.equal(doc.querySelectorAll('#email-trusted li').length,0);
 }finally{Object.assign(globalThis,previous);dom.window.close();}
});
