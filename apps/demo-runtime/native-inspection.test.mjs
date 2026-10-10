import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,truncate,stat,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {inspectNative,validSnapshot} from './native-inspection.mjs';

test('missing native engine is unavailable, never clean',async()=>{
 const result=await inspectNative({executable:'C:/not-installed/sentinel-inspect.exe',path:'C:/not-accessed.txt',kind:'file'});
 assert.equal(result.status,'unavailable');assert.equal(result.snapshot,null);
});

test('actual Rust child returns real bounded path-free byte evidence',async()=>{
 assert.ok(process.env.SENTINEL_TEST_INSPECT,'actual built Rust executable required');
 const root=await mkdtemp(join(tmpdir(),'sentinel-native-adapter-'));
 const path=join(root,'private-owned-file.txt');
 try {
  await writeFile(path,'ordinary harmless content');
  const snapshots=[];
  const result=await inspectNative({executable:process.env.SENTINEL_TEST_INSPECT,path,kind:'file',onSnapshot:s=>snapshots.push(s)});
  assert.equal(result.status,'finished');
  assert.equal(result.snapshot.reports[0].inspectedBytes,'25');
  assert.match(result.snapshot.reports[0].sha256,/^[a-f0-9]{64}$/);
  assert.ok(snapshots.length>0);
  assert.ok(!JSON.stringify(result).includes('private-owned-file'));
  assert.equal(validSnapshot({...result.snapshot,path}),false);
  assert.equal(validSnapshot({...result.snapshot,currentFileBytes:25}),false);
  const forged=structuredClone(result.snapshot);forged.reports[0].inspectedBytes='025';
  assert.equal(validSnapshot(forged),false);
  const secret=structuredClone(result.snapshot);secret.reports[0].findings.push('private raw content');
  assert.equal(validSnapshot(secret),false);
 }finally{await rm(root,{recursive:true});}
});

test('actual DFI reports padded range as partial and recognizes a disguised PE header',async()=>{
 const root=await mkdtemp(join(tmpdir(),'sentinel-native-dfi-'));
 try {
  const padded=join(root,'benign-padding.bin');await writeFile(padded,'');await truncate(padded,64*1024*1024);
  const padding=await inspectNative({executable:process.env.SENTINEL_TEST_INSPECT,path:padded,kind:'file'});
  assert.equal(padding.status,'finished');
  const report=padding.snapshot.reports[0];
  assert.equal(report.logicalBytes,'67108864');assert.equal(report.inspectedBytes,'8388608');
  assert.equal(report.state,'partial');assert.equal(report.sha256,null);
  assert.ok(report.findings.includes('large_zero_filled_range'));
  assert.equal(report.evidence.rangeComplete,false);
  const header=Buffer.alloc(128);header.write('MZ');header.writeUInt32LE(64,60);header.write('PE\0\0',64);
  const disguised=join(root,'benign-header.pdf');await writeFile(disguised,header);
  const pe=await inspectNative({executable:process.env.SENTINEL_TEST_INSPECT,path:disguised,kind:'file'});
  assert.equal(pe.status,'finished');
  assert.ok(pe.snapshot.reports[0].findings.includes('disguised_executable_header'));
  assert.equal(pe.snapshot.reports[0].evidence.peHeaderPresent,true);
 }finally{await rm(root,{recursive:true});}
});

test('cancel before launch never acquires a subject',async()=>{
 const result=await inspectNative({executable:process.env.SENTINEL_TEST_INSPECT,path:'C:/not-accessed',kind:'file',cancelled:()=>true});
 assert.deepEqual(result,{status:'cancelled',snapshot:null});
});

test('actual running child cancellation and parent deadline preserve the source',async()=>{
 const root=await mkdtemp(join(tmpdir(),'sentinel-native-cancel-'));
 try {
  const path=join(root,'benign-padding.bin');await writeFile(path,'');await truncate(path,64*1024*1024);
  let cancel=false;
  const cancelled=await inspectNative({executable:process.env.SENTINEL_TEST_INSPECT,path,kind:'file',cancelled:()=>cancel,onSnapshot:s=>{if(s.state==='running')cancel=true;}});
  assert.equal(cancelled.status,'cancelled');
  assert.ok(cancelled.snapshot?.cancellationRequested);
  const timeout=await inspectNative({executable:process.env.SENTINEL_TEST_INSPECT,path,kind:'file',timeoutMs:1});
  assert.equal(timeout.status,'timed_out');
  assert.equal((await stat(path)).size,64*1024*1024);
 }finally{await rm(root,{recursive:true});}
});
