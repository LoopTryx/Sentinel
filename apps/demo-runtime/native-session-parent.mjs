import {spawn} from 'node:child_process';
import {StringDecoder} from 'node:string_decoder';
import {validSessionMessage} from './native-session-wire.mjs';

// Native-only capability: never expose this object or confirm commands to HTTP,
// the renderer, or an extension. The native caller owns executable/path/appDir.
export function openNativeSession({executable,path,kind,appDir,onMessage=()=>{},timeoutMs=300000}){
 if([executable,path,appDir].some(v=>typeof v!=='string'||!v||v.length>2048||v.includes('\0'))||!['file','folder'].includes(kind)||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>300000)throw new TypeError('Invalid native session configuration');
 const child=spawn(executable,['--'+kind,path,'--session',appDir],{shell:false,windowsHide:true,stdio:['pipe','pipe','pipe']});
 let settle,closed=false,stopping=false,reason=null,total=0,pending='',sent=0,snapshot=null;
 let expected=null,quarantinePreview=null,restorePreview=null;
 const receipts=new Map();
 const decoder=new StringDecoder('utf8');
 const done=new Promise(resolve=>{settle=resolve;});
 let grace;
 const stop=why=>{if(stopping||closed)return;stopping=true;reason=why;child.stdin.end('{"op":"close"}\n');grace=setTimeout(()=>child.kill(),1000);};
 const timer=setTimeout(()=>stop('timed_out'),timeoutMs);
 const fail=()=>stop('failed');
 child.stdin.on('error',()=>{});
 child.stderr.on('data',chunk=>{total+=chunk.length;if(total>2097152)fail();});
 child.stdout.on('data',chunk=>{
  total+=chunk.length;if(total>2097152){fail();return;}
  pending+=decoder.write(chunk);
  while(pending.includes('\n')){
   const i=pending.indexOf('\n'),line=pending.slice(0,i);pending=pending.slice(i+1);
   try{
    if(Buffer.byteLength(line)>65536)throw new Error();
    const message=JSON.parse(line);
    if(!validSessionMessage(message))throw new Error();
    if(message.type==='scan'){
     const next=message.data;
     if(snapshot&&(snapshot.jobRef!==next.jobRef||snapshot.selectionRef!==next.selectionRef||snapshot.state!=='running'))throw new Error();
     snapshot=next;
    }else if(message.type.startsWith('quarantine_')){
     if(!snapshot||snapshot.state==='running'||message.data.jobRef!==snapshot.jobRef||message.data.selectionRef!==snapshot.selectionRef)throw new Error();
    }
    if(message.type!=='scan'){
     if(!expected)throw new Error();
     if(message.type!=='error'){
      const correlation=expected.key==='quarantineActionRef'?message.data.quarantine?.actionRef:message.data[expected.key];
      if(message.type!==expected.type||correlation!==expected.ref)throw new Error();
      if(message.type==='quarantine_preview')quarantinePreview=message.data;
      if(message.type==='quarantine_receipt'){
       if(message.data.reportRef!==quarantinePreview?.reportRef)throw new Error();
       if(message.data.state==='quarantined')receipts.set(message.data.actionRef,message.data);
       quarantinePreview=null;
      }
      if(message.type==='restore_preview'){
       if(JSON.stringify(message.data.quarantine)!==JSON.stringify(receipts.get(expected.ref)))throw new Error();
       restorePreview=message.data;
      }
      if(message.type==='restore_receipt'){
       if(JSON.stringify(message.data.quarantine)!==JSON.stringify(restorePreview?.quarantine))throw new Error();
       receipts.delete(message.data.quarantine.actionRef);restorePreview=null;
      }
     }
     expected=null;
    }
    if(!stopping)onMessage(message);
   }catch{fail();return;}
  }
  if(Buffer.byteLength(pending)>65536)fail();
 });
 child.on('error',()=>{reason='unavailable';});
 child.on('close',code=>{closed=true;clearTimeout(timer);clearTimeout(grace);pending+=decoder.end();settle({status:reason??(code===0&&!pending.trim()?'closed':'failed')});});
 const send=command=>{
  if(closed||stopping||sent>=63)return false;
  const line=JSON.stringify(command)+'\n';if(Buffer.byteLength(line)>1024)return false;
  sent++;child.stdin.write(line);return true;
 };
 const request=(command,response,key,value)=>{
  if(expected)return false;
  if(!send(command))return false;
  expected={type:response,key,ref:value};return true;
 };
 return Object.freeze({
  done,close:()=>stop('closed'),cancel:()=>send({op:'cancel'}),
  prepareQuarantine:reportRef=>request({op:'prepare_quarantine',reportRef},'quarantine_preview','reportRef',reportRef),
  prepareRestore:quarantineActionRef=>receipts.has(quarantineActionRef)&&request({op:'prepare_restore',quarantineActionRef},'restore_preview','quarantineActionRef',quarantineActionRef),
  // These methods are exclusively for the trusted OS-dialog result branch.
  nativeQuarantineDecision:(actionRef,approved)=>typeof approved==='boolean'&&quarantinePreview?.actionRef===actionRef&&request({op:approved?'confirm_quarantine':'decline_quarantine',actionRef},'quarantine_receipt','actionRef',actionRef),
  nativeRestoreDecision:(restoreRef,approved)=>typeof approved==='boolean'&&restorePreview?.restoreRef===restoreRef&&request({op:approved?'confirm_restore':'decline_restore',restoreRef},'restore_receipt','restoreRef',restoreRef)
 });
}
