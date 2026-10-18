import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {mountContinue} from '../src/continue.js';
const require=createRequire(new URL('../../ui/package.json',import.meta.url));const {JSDOM}=require('jsdom');
function page(){return new JSDOM('<button id="open-sentinel">Open Sentinel</button><p id="status"></p><a id="return">Stay in the browser</a>');}
test('handoff tab makes no desktop request until Open Sentinel is pressed',async()=>{
 const dom=page(),sent=[];try{mountContinue(dom.window.document,{runtime:{sendMessage:async m=>{sent.push(m);return {data:{ok:true}};}}},'a'.repeat(32));assert.equal(sent.length,0);dom.window.document.querySelector('button').click();await new Promise(ok=>setTimeout(ok,10));assert.deepEqual(sent,[{kind:'demo_call',method:'ai-open',data:{ref:'a'.repeat(32)}}]);assert.match(dom.window.document.getElementById('status').textContent,/Sentinel is open/);}finally{dom.window.close();}
});
test('invalid references cannot open the app and failed handoff permits retry',async()=>{
 const dom=page();let calls=0;try{mountContinue(dom.window.document,{runtime:{sendMessage:async()=>{calls++;return {error:'offline'};}}},'https://arbitrary.test/');dom.window.document.querySelector('button').click();assert.equal(calls,0);assert.equal(dom.window.document.querySelector('button').disabled,true);}finally{dom.window.close();}
 const retry=page();try{mountContinue(retry.window.document,{runtime:{sendMessage:async()=>({error:'offline'})}},'b'.repeat(32));retry.window.document.querySelector('button').click();await new Promise(ok=>setTimeout(ok,10));assert.equal(retry.window.document.querySelector('button').disabled,false);assert.match(retry.window.document.getElementById('status').textContent,/Could not open/);}finally{retry.window.close();}
});
