import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {validSessionMessage} from './native-session-wire.mjs';

test('actual retained native session quarantines and restores exact harmless bytes',async()=>{
 const root=await mkdtemp(join(tmpdir(),'sentinel-retained-session-'));
 const path=join(root,'private-source.txt'),bytes=Buffer.from('harmless native session bytes');
 await writeFile(path,bytes);
 let child;
 try {
  let restored=false,quarantined=false,output='';
  const result=await new Promise((resolve,reject)=>{
   child=spawn(process.env.SENTINEL_TEST_INSPECT,['--file',path,'--session',join(root,'app')],{shell:false,windowsHide:true,stdio:['pipe','pipe','pipe']});
   const timer=setTimeout(()=>{child.kill();reject(new Error('native session timeout'));},15000);
   const send=value=>child.stdin.write(JSON.stringify(value)+'\n');
   child.stdin.on('error',()=>{});child.stderr.resume();
   child.on('error',error=>{clearTimeout(timer);reject(error);});
   child.stdout.on('data',chunk=>{
    output+=chunk.toString();
    while(output.includes('\n')){
     const index=output.indexOf('\n'),line=output.slice(0,index);output=output.slice(index+1);
     try {
      assert.ok(!line.includes('private-source'));
      const message=JSON.parse(line);
      assert.equal(validSessionMessage(message),true,'actual child envelope matches closed native contract');
      if(message.type==='scan'&&message.data.state==='finished')send({op:'prepare_quarantine',reportRef:'report_0'});
      else if(message.type==='quarantine_preview')send({op:'confirm_quarantine',actionRef:message.data.actionRef});
      else if(message.type==='quarantine_receipt'){assert.equal(message.data.state,'quarantined');quarantined=true;send({op:'prepare_restore',quarantineActionRef:message.data.actionRef});}
      else if(message.type==='restore_preview')send({op:'confirm_restore',restoreRef:message.data.restoreRef});
      else if(message.type==='restore_receipt'){assert.equal(message.data.state,'restored');restored=true;send({op:'close'});}
      else if(message.type==='error')throw new Error('native action error');
     }catch(error){child.kill();clearTimeout(timer);reject(error);}
    }
   });
   child.on('close',code=>{clearTimeout(timer);resolve(code);});
  });
  assert.equal(result,0);assert.equal(quarantined,true);assert.equal(restored,true);
  assert.deepEqual(await readFile(path),bytes);
 }finally{if(child&&!child.killed)child.kill();await rm(root,{recursive:true});}
});

test('native session declines, refuses approval replay and preserves source without a key',async()=>{
 const root=await mkdtemp(join(tmpdir(),'sentinel-session-decline-'));
 const path=join(root,'owned.txt');await writeFile(path,'harmless decline bytes');
 let child;
 try {
  let stage=0,pending='',action;
  const errors=[];
  const code=await new Promise((resolve,reject)=>{
   child=spawn(process.env.SENTINEL_TEST_INSPECT,['--file',path,'--session',join(root,'app')],{shell:false,windowsHide:true,stdio:['pipe','pipe','pipe']});
   const timer=setTimeout(()=>{child.kill();reject(new Error('session deadline'));},15000);
   const send=value=>child.stdin.write(JSON.stringify(value)+'\n');
   child.stdin.on('error',()=>{});child.stderr.resume();
   child.stdout.on('data',chunk=>{pending+=chunk;while(pending.includes('\n')){const index=pending.indexOf('\n'),line=pending.slice(0,index);pending=pending.slice(index+1);try{const m=JSON.parse(line);
    if(stage===0&&m.type==='scan'&&m.data.state==='finished'){stage=1;send({op:'prepare_quarantine',reportRef:'report_0'});}
    else if(stage===1&&m.type==='quarantine_preview'){stage=2;action=m.data.actionRef;send({op:'decline_quarantine',actionRef:action});}
    else if(m.type==='error'){errors.push(m.data.code);if(stage===2){stage=3;send({op:'confirm_quarantine',actionRef:action});}else send({op:'close'});}
   }catch(error){child.kill();clearTimeout(timer);reject(error);}}});
   child.on('error',error=>{clearTimeout(timer);reject(error);});child.on('close',code=>{clearTimeout(timer);resolve(code);});
  });
  assert.equal(code,0);assert.deepEqual(errors,['declined','action_unavailable']);
  assert.equal(await readFile(path,'utf8'),'harmless decline bytes');
  await assert.rejects(readFile(join(root,'app','vault.key')));
 }finally{if(child&&!child.killed)child.kill();await rm(root,{recursive:true});}
});

test('native session refuses forged fields and oversized frames without remediation',async()=>{
 for(const frame of [JSON.stringify({op:'confirm_quarantine',actionRef:'a',approved:true,path:'C:/private'})+'\n','x'.repeat(1025)+'\n']){
  const root=await mkdtemp(join(tmpdir(),'sentinel-session-refusal-'));const path=join(root,'owned.txt');await writeFile(path,'harmless frame refusal');
  let child;
  try {
   let output='';
   const code=await new Promise((resolve,reject)=>{
    child=spawn(process.env.SENTINEL_TEST_INSPECT,['--file',path,'--session',join(root,'app')],{shell:false,windowsHide:true,stdio:['pipe','pipe','pipe']});
    const timer=setTimeout(()=>{child.kill();reject(new Error('frame deadline'));},15000);
    child.stdin.on('error',()=>{});child.stdin.write(frame);child.stderr.resume();child.stdout.on('data',chunk=>{output+=chunk;});
    child.on('error',error=>{clearTimeout(timer);reject(error);});child.on('close',code=>{clearTimeout(timer);resolve(code);});
   });
   assert.equal(code,0);assert.ok(output.includes('invalid_request'));assert.ok(!output.includes('C:/private'));
   assert.equal(await readFile(path,'utf8'),'harmless frame refusal');await assert.rejects(readFile(join(root,'app','vault.key')));
  }finally{if(child&&!child.killed)child.kill();await rm(root,{recursive:true});}
 }
});
