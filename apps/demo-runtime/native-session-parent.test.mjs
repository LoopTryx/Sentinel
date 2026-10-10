import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openNativeSession} from './native-session-parent.mjs';

test('native parent drains actual scan quarantine restore and closes owned child',async()=>{
 const root=await mkdtemp(join(tmpdir(),'sentinel-parent-'));const path=join(root,'owned.txt');
 const bytes=Buffer.from('owned harmless parent journey');await writeFile(path,bytes);
 let session;const received=[];
 try{
  session=openNativeSession({executable:process.env.SENTINEL_TEST_INSPECT,path,kind:'file',appDir:join(root,'app'),timeoutMs:15000,onMessage:m=>{
   received.push(m.type);
   if(m.type==='scan'&&m.data.state==='finished')session.prepareQuarantine('report_0');
   if(m.type==='quarantine_preview')session.nativeQuarantineDecision(m.data.actionRef,true);
   if(m.type==='quarantine_receipt')session.prepareRestore(m.data.actionRef);
   if(m.type==='restore_preview')session.nativeRestoreDecision(m.data.restoreRef,true);
   if(m.type==='restore_receipt')session.close();
  }});
  assert.deepEqual(await session.done,{status:'closed'});
  assert.ok(received.includes('restore_receipt'));assert.ok(!received.includes('error'));
  assert.deepEqual(await readFile(path),bytes);assert.equal(session.cancel(),false);
 }finally{session?.close();if(session)await session.done;await rm(root,{recursive:true});}
});

test('native parent missing executable resolves unavailable',async()=>{
 const session=openNativeSession({executable:'C:/sentinel-nonexistent-engine.exe',path:'C:/owned.txt',kind:'file',appDir:'C:/owned-app',timeoutMs:1000});
 assert.deepEqual(await session.done,{status:'unavailable'});
});

test('actual retained parent deadline closes child and preserves source',async()=>{
 const root=await mkdtemp(join(tmpdir(),'sentinel-parent-deadline-'));const path=join(root,'owned.txt');await writeFile(path,'harmless deadline bytes');
 let session;
 try{
  session=openNativeSession({executable:process.env.SENTINEL_TEST_INSPECT,path,kind:'file',appDir:join(root,'app'),timeoutMs:100});
  assert.deepEqual(await session.done,{status:'timed_out'});
  assert.equal(await readFile(path,'utf8'),'harmless deadline bytes');
  assert.equal(session.prepareRestore('invented'),false);
 }finally{session?.close();if(session)await session.done;await rm(root,{recursive:true});}
});
