import test from 'node:test';import assert from 'node:assert/strict';
import {writeFile,readFile,unlink} from 'node:fs/promises';import {spawn} from 'node:child_process';import {fileURLToPath} from 'node:url';
import {startRuntime} from './server.mjs';
test('compiled native bridge binds origin and request before issuing browser credentials',{skip:process.platform!=='win32'},async()=>{
 const here=new URL('../desktop/console-build/',import.meta.url),config=new URL('demo-runtime.json',here),manifest=new URL('native-host.json',here);
 const backups=await Promise.all([config,manifest].map(async p=>{try{return await readFile(p);}catch{return null;}}));
 const runtime=await startRuntime();const id='c'.repeat(32),origin=`chrome-extension://${id}/`;
 async function invoke(origin,message){return await new Promise((resolve,reject)=>{
  const child=spawn(fileURLToPath(new URL('Sentinel.NativeConnect.exe',here)),[origin],{windowsHide:true});const output=[];let size=0;
  const timer=setTimeout(()=>{child.kill();reject(Error('native timeout'));},15000);
  child.stdout.on('data',part=>{size+=part.length;if(size>8192){child.kill();reject(Error('oversized'));}output.push(part);});child.on('error',reject);
  child.on('exit',code=>{clearTimeout(timer);try{assert.equal(code,0);const bytes=Buffer.concat(output);assert.equal(bytes.readUInt32LE(0),bytes.length-4);resolve(JSON.parse(bytes.subarray(4).toString()));}catch(e){reject(e);}});
  const bytes=Buffer.from(JSON.stringify(message)),length=Buffer.alloc(4);length.writeUInt32LE(bytes.length);child.stdin.end(Buffer.concat([length,bytes]));
 });}
 try{
  await writeFile(config,JSON.stringify({url:runtime.url,token:runtime.desktopToken,nativeActionToken:runtime.nativeActionToken}));
  await writeFile(manifest,JSON.stringify({allowed_origins:[origin]}));
  assert.deepEqual(await invoke('chrome-extension://'+'d'.repeat(32)+'/',{operation:'connect'}),{error:'connection_unavailable'});
  assert.deepEqual(await invoke(origin,{operation:'connect',path:'private'}),{error:'connection_unavailable'});
  const pair=await invoke(origin,{operation:'connect'});assert.equal(pair.extensionId,id);assert.match(pair.token,/^[a-f0-9]{64}$/);assert.equal(pair.port,runtime.port);
  const response=await fetch(runtime.url+'/state',{method:'POST',headers:{Authorization:'Bearer '+pair.token,'X-Sentinel-Extension':id,'Content-Type':'application/json'},body:'{}'});assert.equal(response.status,200);
 }finally{await runtime.close();await Promise.all([config,manifest].map((p,i)=>backups[i]===null?unlink(p).catch(()=>{}):writeFile(p,backups[i])));}
});
