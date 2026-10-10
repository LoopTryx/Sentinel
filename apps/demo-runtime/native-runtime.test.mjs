import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {startRuntime} from './server.mjs';

test('desktop runtime uses actual Rust bytes and keeps browser filesystem access forbidden',async()=>{
 const root=await mkdtemp(join(tmpdir(),'sentinel-native-runtime-'));const path=join(root,'owned.txt');const bytes=Buffer.from('harmless real runtime bytes');await writeFile(path,bytes);
 const runtime=await startRuntime({nativeExecutable:process.env.SENTINEL_TEST_INSPECT});
 const call=(route,body={},token=runtime.desktopToken,extra={})=>fetch(runtime.url+route,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...extra},body:JSON.stringify(body)});
 try{
  assert.equal((await call('/scan',{path})).status,200);
  let state;for(let i=0;i<200;i++){state=await(await call('/state')).json();if(state.scan.status!=='running')break;await new Promise(r=>setTimeout(r,10));}
  assert.equal(state.scan.status,'partial');assert.equal(state.scan.checked,1);
  const evidence=await(await call('/inspection')).json();
  assert.equal(evidence.snapshot.reports[0].sha256,createHash('sha256').update(bytes).digest('hex'));
  assert.equal(evidence.snapshot.reports[0].inspectedBytes,String(bytes.length));
  assert.ok(!JSON.stringify(evidence).includes(path));assert.deepEqual(await readFile(path),bytes);
  const id='a'.repeat(32),pair=await(await call('/pair',{extensionId:id})).json();
  assert.equal((await call('/inspection',{},pair.token,{'X-Sentinel-Extension':id})).status,403);
  assert.equal((await call('/scan',{path},pair.token,{'X-Sentinel-Extension':id})).status,403);
 }finally{await runtime.close();await rm(root,{recursive:true});}
});
