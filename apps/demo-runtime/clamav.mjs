import {spawn} from 'node:child_process';
import {readFile,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const EXE=new URL('../../.local-handoff/clamav-1.5.4/portable/clamav-1.5.4.win.x64/clamscan.exe',import.meta.url);
const PIN='f368912f61ddea8b302acf9114891ec57f8a45b0de77f076b1d19c960bc6f7cf';
const DB=fileURLToPath(new URL('./synthetic-demo.hdb',import.meta.url));
export async function inspectWithClamAV(bytes,cancelled=()=>false){
 const known=JSON.parse(await readFile(new URL('./known-samples.json',import.meta.url),'utf8'));
 const digest=createHash('sha256').update(bytes).digest('hex');
 if(!known.some(sample=>sample.sha256===digest&&sample.size===bytes.length))return {status:'unsupported',reason:'This file inspector supports the bundled harmless test files. Use the dashboard scanner for other files.'};
 if(process.platform!=='win32')return {status:'unavailable',reason:'This ClamAV build requires Windows.'};
 try{if(createHash('sha256').update(await readFile(EXE)).digest('hex')!==PIN)throw new Error();}catch{return {status:'unavailable',reason:'The verified ClamAV 1.5.4 executable is missing or changed.'};}
 if(cancelled())return {status:'incomplete',reason:'ClamAV inspection was cancelled before launch.'};
 let official=false;
 const officialDir=fileURLToPath(new URL('../../.local-handoff/clamav-1.5.4/databases/',import.meta.url));
 try{await access(officialDir+'/daily.cvd');official=true;}catch{}
 return new Promise(resolve=>{
  const disabled=['bytecode','scan-mail','phishing-sigs','phishing-scan-urls','normalize','scan-pe','scan-elf','scan-ole2','scan-pdf','scan-swf','scan-html','scan-xmldocs','scan-hwp3','scan-onenote','scan-archive','scan-image','scan-image-fuzzy-hash'];
  // Load the official daily set for this bounded demo. Full main-set cold starts
  // exceeded the measured 15-second budget; do not hide that behind a clean result.
  const child=spawn(fileURLToPath(EXE),['--database='+DB,...(official?['--database='+officialDir+'/daily.cvd']:[]),'--no-summary','--max-filesize=8M','--max-scansize=8M','--max-recursion=1',...disabled.map(flag=>'--'+flag+'=no'),'-'],{windowsHide:true,stdio:['pipe','pipe','pipe'],shell:false});
  let finished=false,stopped=false,count=0,output='';const start=Date.now();
  const stop=()=>{stopped=true;child.kill();};
  const timer=setInterval(()=>{if(cancelled()||Date.now()-start>30000)stop();},50);
  const finish=result=>{if(finished)return;finished=true;clearInterval(timer);resolve(result);};
  const consume=chunk=>{count+=chunk.length;if(count>32768)stop();else output+=chunk.toString('utf8');};child.stdout.on('data',consume);child.stderr.on('data',consume);
  child.stdin.on('error',()=>{});child.stdin.end(bytes);
  child.on('error',()=>finish({status:'unavailable',reason:'ClamAV could not start.'}));
  child.on('close',code=>finish(stopped?{status:'incomplete',reason:'ClamAV was stopped; inspection is incomplete.'}:code===1?{status:output.includes('Synthetic.Sentinel.DemoOnly.UNOFFICIAL FOUND')?'synthetic_match':'signature_alert',reason:output.includes('Synthetic.Sentinel.DemoOnly.UNOFFICIAL FOUND')?'ClamAV matched the harmless Synthetic.Sentinel.DemoOnly signature using real bytes. This is a test match, not malware.':'ClamAV reported another signature match. Verify independently; no automatic remediation.'}:code===0?{status:'no_detection',reason:official?'ClamAV completed with daily and test signatures. Full signature and file-format coverage is unavailable in this inspector.':'ClamAV completed without a test signature match. Official signature databases are unavailable.'}:{status:'error',reason:'ClamAV returned an engine/database error. No clean verdict.'}));
 });
}
