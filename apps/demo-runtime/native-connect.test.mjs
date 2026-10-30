import test from 'node:test';import assert from 'node:assert/strict';
import {writeFile,mkdtemp,rm} from 'node:fs/promises';import {spawn,execFile} from 'node:child_process';import {fileURLToPath} from 'node:url';
import {join} from 'node:path';import {tmpdir} from 'node:os';import {promisify} from 'node:util';
import {startRuntime} from './server.mjs';
test('compiled native bridge binds origin and request before issuing browser credentials',{skip:process.platform!=='win32'},async()=>{
 const here=await mkdtemp(join(tmpdir(),'sentinel-native-connect-')),config=join(here,'demo-runtime.json'),manifest=join(here,'native-host.json');
 const executable=join(here,'Sentinel.NativeConnect.exe');
 const framework=join(process.env.SystemRoot||process.env.WINDIR,'Microsoft.NET','Framework64','v4.0.30319');
 const references=['System.Net.Http.dll','System.Web.Extensions.dll','System.Windows.Forms.dll','System.Management.dll','System.Security.dll','System.Runtime.WindowsRuntime.dll','System.Xaml.dll','WPF/WindowsBase.dll','WPF/PresentationCore.dll','WPF/PresentationFramework.dll'].map(name=>'/reference:'+join(framework,name));
 const sources=['NativeConnect.cs','BrowserOverview.cs','VaultApproval.cs','WindowsVault.cs','UsbOwnerVerification.cs'].map(name=>fileURLToPath(new URL('../desktop/'+name,import.meta.url)));
 let runtime;const id='c'.repeat(32),origin=`chrome-extension://${id}/`;
 async function invoke(origin,message){return await new Promise((resolve,reject)=>{
  const child=spawn(executable,[origin],{windowsHide:true});const output=[];let size=0;
  const timer=setTimeout(()=>{child.kill();reject(Error('native timeout'));},15000);
  child.stdout.on('data',part=>{size+=part.length;if(size>8192){child.kill();reject(Error('oversized'));}output.push(part);});child.on('error',reject);
  child.on('exit',code=>{clearTimeout(timer);try{assert.equal(code,0);const bytes=Buffer.concat(output);assert.equal(bytes.readUInt32LE(0),bytes.length-4);resolve(JSON.parse(bytes.subarray(4).toString()));}catch(e){reject(e);}});
  const bytes=Buffer.from(JSON.stringify(message)),length=Buffer.alloc(4);length.writeUInt32LE(bytes.length);child.stdin.end(Buffer.concat([length,bytes]));
 });}
 try{
  await promisify(execFile)(join(framework,'csc.exe'),['/nologo','/platform:x64','/out:'+executable,...references,...sources],{windowsHide:true});
  runtime=await startRuntime();
  await writeFile(config,JSON.stringify({url:runtime.url,token:runtime.desktopToken,nativeActionToken:runtime.nativeActionToken}));
  await writeFile(manifest,JSON.stringify({allowed_origins:[origin]}));
  assert.deepEqual(await invoke('chrome-extension://'+'d'.repeat(32)+'/',{operation:'connect'}),{error:'connection_unavailable'});
  assert.deepEqual(await invoke(origin,{operation:'connect',path:'private'}),{error:'connection_unavailable'});
  const pair=await invoke(origin,{operation:'connect'});assert.equal(pair.extensionId,id);assert.match(pair.token,/^[a-f0-9]{64}$/);assert.equal(pair.port,runtime.port);
  const response=await fetch(runtime.url+'/state',{method:'POST',headers:{Authorization:'Bearer '+pair.token,'X-Sentinel-Extension':id,'Content-Type':'application/json'},body:'{}'});assert.equal(response.status,200);
 }finally{await runtime?.close();await rm(here,{recursive:true,force:true});}
});
