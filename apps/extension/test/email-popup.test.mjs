import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {readFile} from 'node:fs/promises';
import {installEmailControl} from '../src/email/control.js';
const require=createRequire(new URL('../../ui/package.json',import.meta.url)),{JSDOM}=require('jsdom');
test('compact Gmail and Outlook switches persist opt-in without sender-management clutter',async()=>{
 const dom=new JSDOM(await readFile(new URL('../popup.html',import.meta.url),'utf8'),{url:'https://extension.example.test/popup.html?view=settings'}),doc=dom.window.document;
 let listener;const saved={};const api={runtime:{id:'unit',getURL:p=>'chrome-extension://unit/'+p,onMessage:{addListener:f=>listener=f},sendMessage:message=>new Promise(resolve=>{if(!listener(message,{id:'unit',url:'chrome-extension://unit/popup.html?view=settings'},resolve))resolve({});})},storage:{local:{setAccessLevel:async()=>{},get:async key=>({[key]:saved[key]}),set:async v=>Object.assign(saved,v)}},permissions:{contains:async()=>true,request:async()=>true},scripting:{getRegisteredContentScripts:async()=>[],registerContentScripts:async()=>{},unregisterContentScripts:async()=>{}},tabs:{query:async()=>[]}};
 installEmailControl(api);const previous={document:globalThis.document,location:globalThis.location,chrome:globalThis.chrome};Object.assign(globalThis,{document:doc,location:dom.window.location,chrome:api});
 const tick=()=>new Promise(resolve=>setTimeout(resolve,20));
 try{await import('../src/email/popup.js');await tick();assert.equal(doc.getElementById('email-trust-form'),null);assert.equal(doc.getElementById('email-feedback').hidden,true);
  for(const provider of ['gmail','outlook']){const button=doc.querySelector(`[data-email-provider=${provider}]`);assert.equal(button.getAttribute('aria-checked'),'false');button.click();await tick();assert.equal(saved['emailOptIn_'+provider],true);assert.equal(button.getAttribute('aria-checked'),'true');button.click();await tick();assert.equal(saved['emailOptIn_'+provider],false);assert.equal(button.getAttribute('aria-checked'),'false');}
 }finally{Object.assign(globalThis,previous);dom.window.close();}
});
