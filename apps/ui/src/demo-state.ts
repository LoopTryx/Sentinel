import type {DemoState} from '@sentinel/contracts/generated/DemoState';
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const text=(v:unknown,max=512):v is string=>typeof v==='string'&&v.length<=max;
const count=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>=0;
const texts=(v:unknown,max:number)=>Array.isArray(v)&&v.length<=max&&v.every(x=>text(x));
const list=(v:unknown,max:number,check:(x:unknown)=>boolean)=>Array.isArray(v)&&v.length<=max&&v.every(check);
export function isDemoState(v:unknown):v is DemoState{
 if(!object(v)||!['synthetic_demo','encrypted_vault'].includes(v.mode as string)||v.connected!==true||typeof v.unlocked!=='boolean'||!count(v.revision)||!text(v.extensionId,32)||!(v.extensionId===''||/^[a-p]{32}$/.test(v.extensionId)))return false;
 if(!list(v.accounts,128,a=>object(a)&&text(a.id,64)&&text(a.name,80)&&text(a.user,254)&&text(a.host,254)&&text(a.health,32)&&['Very weak','Weak','Moderate','Stronger'].includes(a.health)&&typeof a.reused==='boolean'&&texts(a.reasons,16)))return false;
 if(!list(v.events,64,e=>object(e)&&text(e.id,64)&&text(e.at,64)&&text(e.source,16)&&['browser','desktop'].includes(e.source)&&text(e.kind,80)&&texts(e.codes,16)))return false;
 if(v.scan===null)return true;
 const s=v.scan;
 return object(s)&&text(s.id,64)&&text(s.status,32)&&['running','completed','partial','cancelled','timed_out','failed'].includes(s.status)&&s.coverage==='partial'&&text(s.engine)&&['visited','checked','skipped','errors','bytes'].every(k=>count(s[k]))&&list(s.files,64,f=>object(f)&&text(f.name,80)&&text(f.sha256,64)&&/^[a-f0-9]{64}$/.test(f.sha256)&&count(f.bytes))&&list(s.findings,128,f=>object(f)&&text(f.name,80)&&text(f.kind,80)&&text(f.reason)&&text(f.sha256,64)&&/^[a-f0-9]{64}$/.test(f.sha256));
}
