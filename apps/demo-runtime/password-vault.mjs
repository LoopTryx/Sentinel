import {randomBytes,scrypt,createCipheriv,createDecipheriv} from 'node:crypto';
import {promisify} from 'node:util';
import {readFile,open,mkdir,rename,lstat,unlink,copyFile} from 'node:fs/promises';
import {existsSync,constants} from 'node:fs';import {dirname} from 'node:path';
const derive=promisify(scrypt),AAD=Buffer.from('Sentinel.PasswordVault.v1');
export function credentialOrigin(value){let u;try{u=new URL(value);}catch{throw Error('invalid_origin');}if(u.protocol!=='https:'||u.username||u.password||u.origin!==value||u.hostname.length>253)throw Error('invalid_origin');return u.origin;}
const text=(v,max)=>typeof v==='string'&&v.length>0&&v.length<=max&&!/[\x00-\x1f\x7f]/.test(v);
export async function readVaultDocument(path,{stat=lstat,read=readFile,wait=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 for(let attempt=0;;attempt++){try{const info=await stat(path);if(!info.isFile()||info.isSymbolicLink()||info.size>1048576)throw Error('vault_invalid_file');const doc=JSON.parse(await read(path,'utf8'));const base64=(v,n)=>typeof v==='string'&&v.length>0&&Buffer.from(v,'base64').toString('base64')===v&&(!n||Buffer.from(v,'base64').length===n);if(!doc||Array.isArray(doc)||typeof doc!=='object'||doc.version!==1||!base64(doc.salt,32)||!base64(doc.iv,12)||!base64(doc.tag,16)||!base64(doc.data))throw Error('vault_invalid_file');return doc;}catch(e){if(e.code==='ENOENT')return null;if(['EACCES','EPERM','EBUSY','EAGAIN','EMFILE','ENFILE'].includes(e.code)){if(attempt<3){await wait([75,150,300][attempt]);continue;}throw Error('vault_storage_busy');}throw Error('vault_invalid_file');}}
}
export function createPasswordVault({path,now=Date.now,idleMs=300000}){
 let key=null,salt=null,records=[],touched=0,busy=false,epoch=0,lastFailure=0;
 const lock=()=>{epoch++;key?.fill(0);key=null;for(const r of records)r.password='';records=[];};
 const check=(touch=true)=>{if(key&&now()-touched>=idleMs)lock();if(!key)throw Error('vault_locked');if(touch)touched=now();};
 function status(){if(key&&now()-touched>=idleMs)lock();return {initialized:existsSync(path),locked:!key};}
 async function unlock(passphrase){
  if(busy)throw Error('vault_busy');if(!text(passphrase,1024)||passphrase.length<12)throw Error('invalid_vault_key');
  if(lastFailure&&now()-lastFailure<1000)throw Error('vault_try_later');busy=true;const start=epoch;
  let derived;
  try{
   const doc=await readVaultDocument(path);
   if(doc&&(doc.version!==1||typeof doc.salt!=='string'||typeof doc.iv!=='string'||typeof doc.tag!=='string'||typeof doc.data!=='string'))throw Error('vault_invalid_file');
   const nextSalt=doc?Buffer.from(doc.salt,'base64'):randomBytes(32);if(nextSalt.length!==32)throw Error('vault_invalid_file');
   derived=await derive(passphrase,nextSalt,32,{N:32768,r:8,p:1,maxmem:64*1024*1024});
   let next=[];
   if(doc){const iv=Buffer.from(doc.iv,'base64'),tag=Buffer.from(doc.tag,'base64');if(iv.length!==12||tag.length!==16)throw Error('vault_invalid_file');const d=createDecipheriv('aes-256-gcm',derived,iv);d.setAAD(AAD);d.setAuthTag(tag);const plain=Buffer.concat([d.update(Buffer.from(doc.data,'base64')),d.final()]);try{next=JSON.parse(plain.toString('utf8'));}finally{plain.fill(0);}if(!Array.isArray(next)||next.length>128||next.some(r=>!validRecord(r)))throw Error('vault_unlock_failed');}
   if(start!==epoch)throw Error('vault_locked');key?.fill(0);key=derived;derived=null;salt=nextSalt;records=next;touched=now();if(!doc)await persist();return status();
  }catch(e){lock();lastFailure=now()||1;throw Error(['vault_locked','vault_storage_busy','vault_invalid_file'].includes(e.message)?e.message:'vault_unlock_failed');}finally{derived?.fill(0);busy=false;}
 }
 async function rekey(passphrase){
  if(busy)throw Error('vault_busy');check();if(!text(passphrase,1024)||passphrase.length<12)throw Error('invalid_key');busy=true;const start=epoch,oldKey=key,oldSalt=salt;let next;
  try{const nextSalt=randomBytes(32);next=await derive(passphrase,nextSalt,32,{N:32768,r:8,p:1,maxmem:64*1024*1024});if(start!==epoch)throw Error('vault_locked');
   await copyFile(path,path+'.pre-hello-backup',constants.COPYFILE_EXCL).catch(e=>{if(e.code!=='EEXIST')throw e;});
   if(start!==epoch)throw Error('vault_locked');
   key=next;next=null;salt=nextSalt;try{await persist();}catch(e){if(start===epoch){key.fill(0);key=oldKey;salt=oldSalt;}throw e;}
   oldKey.fill(0);if(start!==epoch)throw Error('vault_locked');return status();
  }finally{next?.fill(0);if(key!==oldKey)oldKey.fill(0);busy=false;}
 }
 function validRecord(r){try{return /^[a-f0-9]{32}$/.test(r.id)&&credentialOrigin(r.origin)&&text(r.name,80)&&text(r.user,254)&&text(r.password,256);}catch{return false;}}
 async function persist(){
  check();const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(AAD);const plain=Buffer.from(JSON.stringify(records));let data;try{data=Buffer.concat([cipher.update(plain),cipher.final()]);}finally{plain.fill(0);}
  const encoded=JSON.stringify({version:1,salt:salt.toString('base64'),iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')});
  await mkdir(dirname(path),{recursive:true,mode:0o700});const temp=path+'.'+randomBytes(8).toString('hex')+'.tmp';let handle;
  try{handle=await open(temp,'wx',0o600);await handle.writeFile(encoded);await handle.sync();await handle.close();handle=null;await rename(temp,path);}finally{await handle?.close();await unlink(temp).catch(()=>{});}
 }
 function list(origin){check(false);if(origin)credentialOrigin(origin);return records.filter(r=>!origin||r.origin===origin).map(({password,...r})=>({...r,host:new URL(r.origin).host,health:password.length>=20?'Stronger':password.length>=12?'Moderate':'Weak',reused:records.some(x=>x.id!==r.id&&x.password===password),reasons:['Use a unique password for every account.']}));}
 async function mutate(fn){if(busy)throw Error('vault_busy');check();busy=true;const previous=records.map(r=>({...r})),start=epoch;try{const result=fn();await persist();if(start!==epoch)throw Error('vault_locked');return result;}catch(e){if(start===epoch)records=previous;throw e;}finally{busy=false;}}
 const save=record=>mutate(()=>{const origin=credentialOrigin(record.origin);if(!text(record.user,254)||!text(record.password,256)||!text(record.name,80))throw Error('invalid_login');let row=records.find(r=>r.origin===origin&&r.user===record.user);if(!row){if(records.length>=128)throw Error('account_limit');row={id:randomBytes(16).toString('hex')};records.push(row);}Object.assign(row,{origin,name:record.name,user:record.user,password:record.password});return {ok:true,id:row.id};});
 function fill(id,origin){check();credentialOrigin(origin);const r=records.find(r=>r.id===id&&r.origin===origin);if(!r)throw Error('origin_mismatch');return {user:r.user,password:r.password};}
 const remove=id=>mutate(()=>{const index=records.findIndex(r=>r.id===id);if(index<0)throw Error('invalid_account');records.splice(index,1);return {ok:true};});
 const edit=(id,patch)=>mutate(()=>{const r=records.find(r=>r.id===id);if(!r)throw Error('invalid_account');const next={...r,...patch,id};if(!validRecord(next))throw Error('invalid_login');if(records.some(x=>x.id!==id&&x.origin===next.origin&&x.user===next.user))throw Error('account_exists');Object.assign(r,next);return {ok:true};});
 const idleTimer=setInterval(()=>{if(key&&now()-touched>=idleMs)lock();},Math.max(50,Math.min(1000,idleMs)));idleTimer.unref?.();
 const close=()=>{clearInterval(idleTimer);lock();};
 const matches=(origin,user,password)=>{check(false);credentialOrigin(origin);return {matches:records.some(r=>r.origin===origin&&r.user===user&&r.password===password)};};
 return {status,unlock,rekey,lock,list,save,fill,remove,edit,close,matches};
}
