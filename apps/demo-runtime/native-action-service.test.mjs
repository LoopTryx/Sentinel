import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createNativeActionService} from './native-action-service.mjs';

test('native action service retains actual scan evidence and awaits exact restore receipt',async()=>{
 const root=await mkdtemp(join(tmpdir(),'sentinel-action-service-'));const path=join(root,'owned.txt');const bytes=Buffer.from('harmless awaited action bytes');await writeFile(path,bytes);
 let service;
 try{
  service=createNativeActionService({executable:process.env.SENTINEL_TEST_INSPECT,path,kind:'file',appDir:join(root,'app'),timeoutMs:15000});
  assert.equal((await service.ready).status,'finished');
  assert.equal(service.snapshot().reports[0].inspectedBytes,String(bytes.length));
  const preview=await service.prepareQuarantine('report_0');assert.equal(preview.type,'quarantine_preview');
  assert.equal((await service.nativeQuarantineDecision('foreign',true)).data.code,'action_unavailable');
  const receipt=await service.nativeQuarantineDecision(preview.data.actionRef,true);assert.equal(receipt.data.state,'quarantined');await assert.rejects(readFile(path));
  const restore=await service.prepareRestore(receipt.data.actionRef);assert.equal(restore.type,'restore_preview');
  assert.equal((await service.nativeRestoreDecision(restore.data.restoreRef,true)).data.state,'restored');
  assert.deepEqual(await readFile(path),bytes);
  await service.close();assert.equal((await service.prepareRestore(receipt.data.actionRef)).data.code,'unavailable');
 }finally{if(service)await service.close();await rm(root,{recursive:true});}
});

test('native service missing process settles scan and actions as unavailable',async()=>{
 const service=createNativeActionService({executable:'C:/sentinel-absent.exe',path:'C:/owned.txt',kind:'file',appDir:'C:/owned-app',timeoutMs:1000});
 assert.equal((await service.ready).status,'unavailable');
 assert.equal((await service.prepareQuarantine('report_0')).data.code,'unavailable');
 await service.close();
});
