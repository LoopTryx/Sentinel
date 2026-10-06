import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const warningSource=(await readFile(new URL('../src/warning.js',import.meta.url),'utf8')).replace(/^import[^\n]+\n/,'');
async function renderWarning(hash,{embedded=false,disconnected=false}={}){
 const calls=[];
 const window={};window.top=embedded?{}:window;
 const elements=new Map();
 const document={body:{dataset:{}},createElement:()=>({textContent:''}),getElementById:id=>{
  if(!elements.has(id))elements.set(id,{textContent:'',append(){}});
  return elements.get(id);
 }};
 runInNewContext(warningSource,{window,document,location:{hash},snapshot:{hosts:['example.test'],capturedAt:'2026-10-04'},listState:()=> 'test',chrome:{runtime:{sendMessage(message){calls.push(JSON.parse(JSON.stringify(message)));return disconnected?Promise.reject(new Error('offline')):Promise.resolve({data:{ok:true}});}}}});
 await new Promise(resolve=>setImmediate(resolve));
 return calls;
}

test('top-level warning reports only its bounded reason without destination content',async()=>{
 for(const [hash,code] of [['#listed','risk_list'],['#keywords','reward_payment']]){
  assert.deepEqual(await renderWarning(hash),[{kind:'demo_call',method:'event',data:{risk:'suspicious',codes:[code]}}]);
 }
});

test('embedded or unrecognized warning pages cannot emit paired events',async()=>{
 assert.deepEqual(await renderWarning('#listed',{embedded:true}),[]);
 assert.deepEqual(await renderWarning('#keywords',{embedded:true}),[]);
 assert.deepEqual(await renderWarning('#unknown'),[]);
 assert.deepEqual(await renderWarning(''),[]);
});

test('disconnected reporting finishes locally without retry or cloud fallback',async()=>{
 assert.equal((await renderWarning('#keywords',{disconnected:true})).length,1);
});
