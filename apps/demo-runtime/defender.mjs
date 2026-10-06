import {spawn} from 'node:child_process';
import {access} from 'node:fs/promises';
import {join} from 'node:path';

// Built-in provider only. No downloaded executable, shell, remediation or service changes.
export async function inspectWithDefender(path, cancelled=()=>false) {
 if(process.platform!=='win32')return {status:'unsupported',reason:'Microsoft Defender is available only on Windows.'};
 const exe=join(process.env.ProgramFiles||'C:\\Program Files','Windows Defender','MpCmdRun.exe');
 try{await access(exe);}catch{return {status:'unavailable',reason:'Microsoft Defender command-line provider is unavailable.'};}
 return new Promise(resolve=>{
  const child=spawn(exe,['-Scan','-ScanType','3','-File',path,'-DisableRemediation'],{windowsHide:true,stdio:['ignore','pipe','pipe'],shell:false});
  let settled=false,stopped=false,bytes=0;
  const finish=result=>{if(settled)return;settled=true;clearInterval(timer);resolve(result);};
  const started=Date.now();
  const stop=()=>{stopped=true;child.kill();};
  const timer=setInterval(()=>{if(cancelled()||Date.now()-started>15000)stop();},100);
  // Discard provider output, which can contain selected paths. Keep buffering bounded.
  const consume=chunk=>{bytes+=chunk.length;if(bytes>32768)stop();};
  child.stdout.on('data',consume);child.stderr.on('data',consume);
  child.on('error',()=>finish({status:'unavailable',reason:'The provider could not start.'}));
  child.on('close',code=>finish(stopped?{status:'incomplete',reason:'Provider wait cancelled or exceeded its budget; Defender may continue its service scan.'}:code===0?{status:'no_detection',reason:'Defender completed this selected-file scan without reporting a detection.'}:{status:'attention',reason:'Defender returned a detection or scan error. Open Windows Security to inspect the result.'}));
 });
}
