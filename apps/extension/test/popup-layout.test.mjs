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
