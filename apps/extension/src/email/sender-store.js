import {emailDetectorConfig as config} from '../../data/email-detector-config.js';
const KEY='emailSenderHistoryV1';
export function canonicalSender(value){
 if(typeof value!=='string'||value.length>320||!/^[-a-z0-9.!#$%&'*+/=?^_`{|}~]+@[a-z0-9.-]+\.[a-z]{2,63}$/iu.test(value))throw new Error('Invalid sender address.');
 return value.toLowerCase();
}
/** Addresses only. Incoming observation never establishes identity or trust. */
export function createSenderStore(api){
 let chain=Promise.resolve(),pending=0;
 function run(operation){
  if(pending>=config.limits.queue)return Promise.reject(new Error('Sender store busy.'));pending++;
  const task=chain.then(async()=>{
   if(typeof api?.storage?.local?.setAccessLevel!=='function')throw new Error('Private sender storage unavailable.');
   await api.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
   const raw=(await api.storage.local.get(KEY))[KEY]||{seen:[],trusted:[]};
   if(!Array.isArray(raw.seen)||!Array.isArray(raw.trusted)||raw.seen.length>config.limits.senders||raw.trusted.length>config.limits.trusted)throw new Error('Invalid sender store.');
   const state={seen:raw.seen.map(canonicalSender),trusted:raw.trusted.map(canonicalSender)};
   return operation(state);
  }).finally(()=>pending--);chain=task.catch(()=>{});return task;
 }
 const save=state=>api.storage.local.set({[KEY]:state});
 return {
  context(value){const email=canonicalSender(value);return run(async state=>{const firstTime=!state.seen.includes(email),trusted=state.trusted.includes(email);if(firstTime){state.seen.push(email);state.seen=state.seen.slice(-config.limits.senders);await save(state);}return {firstTime,known:trusted,trusted,source:trusted?'user-trusted':'observed-history',identityVerified:false};});},
  list(){return run(state=>({trusted:[...state.trusted],seenCount:state.seen.length}));},
  trust(value){const email=canonicalSender(value);return run(async state=>{if(!state.trusted.includes(email)){if(state.trusted.length>=config.limits.trusted)throw new Error('Trusted sender limit reached.');state.trusted.push(email);await save(state);}return {trusted:true};});},
  untrust(value){const email=canonicalSender(value);return run(async state=>{state.trusted=state.trusted.filter(v=>v!==email);await save(state);return {trusted:false};});},
  clear(){return run(async()=>{await save({seen:[],trusted:[]});return {cleared:true};});}
 };
}
