import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../ui/package.json',import.meta.url)),{JSDOM}=require('jsdom');
test('popup opens Settings first and both tabs remain interactive',async()=>{
 const dom=new JSDOM(await readFile(new URL('../popup.html',import.meta.url),'utf8'),{url:'https://extension.example.test/popup.html'});
 const previous={document:globalThis.document,location:globalThis.location,chrome:globalThis.chrome};
 Object.assign(globalThis,{document:dom.window.document,location:dom.window.location,chrome:{runtime:{sendMessage:async()=>({status:null}),getURL:path=>path},tabs:{create:()=>{}}}});
 try{
  await import('../src/popup.js');const doc=dom.window.document,tabs=doc.querySelectorAll('[data-view]');
  assert.equal(tabs[0].dataset.view,'settings');assert.equal(tabs[0].getAttribute('aria-pressed'),'true');assert.equal(doc.querySelector('[data-panel=settings]').hidden,false);
  tabs[1].click();assert.equal(doc.querySelector('[data-panel=passwords]').hidden,false);assert.equal(doc.querySelector('[data-panel=settings]').hidden,true);
  tabs[0].click();assert.equal(doc.querySelector('[data-panel=settings]').hidden,false);assert.equal(doc.querySelector('[data-panel=passwords]').hidden,true);
  assert.equal(doc.querySelector('.blue-ledge').parentElement.className,'popup-card');
 }finally{Object.assign(globalThis,previous);dom.window.close();}
});

test('Password navigation opens its secure full-tab view instead of Settings',async()=>{
 const dom=new JSDOM(await readFile(new URL('../popup.html',import.meta.url),'utf8'),{url:'https://extension.example.test/popup.html?view=passwords'}),doc=dom.window.document;
 const previous={document:globalThis.document,location:globalThis.location,chrome:globalThis.chrome};Object.assign(globalThis,{document:doc,location:dom.window.location,chrome:{runtime:{sendMessage:async()=>({status:null}),getURL:p=>p},tabs:{create:()=>{}}}});
 try{await import('../src/popup.js?password-view-test');assert.equal(doc.body.classList.contains('dashboard'),true);assert.equal(doc.querySelector('[data-panel=passwords]').hidden,false);assert.equal(doc.querySelector('[data-panel=settings]').hidden,true);assert.equal(doc.querySelector('[data-view=passwords]').getAttribute('aria-pressed'),'true');}
 finally{Object.assign(globalThis,previous);dom.window.close();}
});

test('embedded settings and passwords stay on the host page and never launch a tab',async()=>{
 const dom=new JSDOM(await readFile(new URL('../popup.html',import.meta.url),'utf8'),{url:'https://extension.example.test/popup.html?overlay=1'}),doc=dom.window.document;
 const previous={document:globalThis.document,location:globalThis.location,chrome:globalThis.chrome};let opened=0;
 Object.assign(globalThis,{document:doc,location:dom.window.location,chrome:{runtime:{sendMessage:async()=>({status:null}),getURL:p=>p},tabs:{create:()=>opened++}}});
 try{await import('../src/popup.js?embedded-view-test');const url=dom.window.location.href;assert.ok(doc.documentElement.classList.contains('embedded-overlay'));doc.getElementById('open-dashboard').click();doc.querySelector('[data-view=passwords]').click();assert.equal(doc.querySelector('[data-panel=passwords]').hidden,false);doc.querySelector('[data-view=settings]').click();assert.equal(doc.querySelector('[data-panel=settings]').hidden,false);assert.equal(opened,0);assert.equal(dom.window.location.href,url);}
 finally{Object.assign(globalThis,previous);dom.window.close();}
});
