import {execFile} from 'node:child_process';import {fileURLToPath} from 'node:url';import {join} from 'node:path';
let busy=false;
export async function observeUsb(){
 if(process.platform!=='win32')throw Error('usb_unsupported');if(busy)throw Error('usb_busy');busy=true;
 try{return await new Promise((resolve,reject)=>execFile(join(process.env.SystemRoot??'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe'),['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',fileURLToPath(new URL('../../tools/usb/read-inventory.ps1',import.meta.url)),'-Worker'],{windowsHide:true,timeout:10000,maxBuffer:32768},(error,out)=>{
  if(error)return reject(Error('usb_unavailable'));try{const value=JSON.parse(out.replace(/^\uFEFF/,''));if(value.schemaVersion!==1||value.mode!=='observation_only'||!Array.isArray(value.devices)||value.devices.length>64)throw Error();resolve(value);}catch{reject(Error('usb_unavailable'));}
 }));}finally{busy=false;}
}
