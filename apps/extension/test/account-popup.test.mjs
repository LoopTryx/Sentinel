import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createRequire} from 'node:module';
const require=createRequire(new URL('../../ui/package.json',import.meta.url));const {JSDOM}=require('jsdom');
test('actual popup fields and checker work without unlock or exposing account secrets',async()=>{
 const html=await readFile(new URL('../popup.html',import.meta.url),'utf8');const script=await readFile(new URL('../src/demo-popup.js',import.meta.url),'utf8');
 const dom=new JSDOM(html,{url:'https://sentinel.example/',runScripts:'outside-only'});const {window}=dom;const requests=[];
 window.chrome={runtime:{id:'c'.repeat(32),sendMessage:async request=>{requests.push(request);return {data:request.method==='state'?{mode:'synthetic_demo',revision:0,accounts:[{id:'mail',name:'Orbit Mail',user:'alex@example.test',host:'mail.example.test',health:'Very weak',reused:false,reasons:[]}]}:{ok:true}};}}};
 try{window.eval(script);await new Promise(resolve=>setImmediate(resolve));const doc=window.document;assert.equal(doc.querySelector('.vault-card strong').textContent,'Orbit Mail');
 assert.equal(doc.querySelector('input[aria-label="Email"]').value,'alex@example.test');assert.equal(doc.querySelector('input[aria-label="Password"]').type,'password');assert.equal(doc.getElementById('demo-lock'),null);
 doc.getElementById('check-accounts').click();assert.equal(doc.querySelector('.vault-card').dataset.priority,'high');doc.getElementById('check-accounts').click();assert.equal(doc.querySelector('.vault-card').dataset.priority,'');
 Array.from(doc.querySelectorAll('.actions button')).find(b=>b.textContent==='Copy password').click();await new Promise(resolve=>setImmediate(resolve));assert.ok(requests.some(r=>r.method==='vault.copy'&&r.data.id==='mail'));
 }finally{window.close();}
});
