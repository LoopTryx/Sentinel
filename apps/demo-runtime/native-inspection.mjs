import {spawn} from 'node:child_process';

import {validSnapshot} from './inspection-wire.mjs';
export {validSnapshot} from './inspection-wire.mjs';

// Only a trusted native desktop adapter supplies the executable/selected path.
// This does not grant browser filesystem authority or restricted-token isolation.
export async function inspectNative({executable,path,kind,onSnapshot=()=>{},cancelled=()=>false,timeoutMs=35000}) {
 if(typeof executable!=='string'||typeof path!=='string'||path.length>2048||path.includes('\0')||!['file','folder'].includes(kind)||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>35000)return {status:'unavailable',snapshot:null};
 if(cancelled())return {status:'cancelled',snapshot:null};
 return new Promise(resolve=>{
  const child=spawn(executable,['--'+kind,path],{shell:false,windowsHide:true,stdio:['pipe','pipe','pipe']});
  let total=0,pending='',snapshot=null,invalid=false,stopping=false,reason=null,done=false;
  const start=Date.now();let stoppedAt=0;
  const stop=why=>{if(stopping)return;stopping=true;reason=why;stoppedAt=Date.now();child.stdin.end('cancel\n');};
  const timer=setInterval(()=>{if(cancelled())stop('cancelled');else if(Date.now()-start>=timeoutMs)stop('timed_out');if(stopping&&Date.now()-stoppedAt>=1000)child.kill();},50);
  const finish=status=>{if(done)return;done=true;clearInterval(timer);resolve({status,snapshot:invalid?null:snapshot});};
  child.stdin.on('error',()=>{});
  child.stderr.on('data',chunk=>{total+=chunk.length;if(total>2097152){invalid=true;child.kill();}});
  child.stdout.on('data',chunk=>{
   total+=chunk.length;
   if(total>2097152){invalid=true;child.kill();return;}
   pending+=chunk.toString('utf8');
   if(pending.length>65536&&!pending.includes('\n')){invalid=true;child.kill();return;}
   while(pending.includes('\n')){
    const index=pending.indexOf('\n'),line=pending.slice(0,index);pending=pending.slice(index+1);
    try{
     if(line.length>65536)throw new Error();
     const next=JSON.parse(line);
     if(!validSnapshot(next)||(snapshot&&(next.jobRef!==snapshot.jobRef||next.selectionRef!==snapshot.selectionRef||snapshot.state!=='running')))throw new Error();
     snapshot=next;onSnapshot(next);
    }catch{invalid=true;child.kill();return;}
   }
  });
  child.on('error',()=>finish('unavailable'));
  child.on('close',code=>finish(reason??(invalid||pending.trim()||code!==0||!snapshot||snapshot.state==='running'?'failed':snapshot.state)));
 });
}
