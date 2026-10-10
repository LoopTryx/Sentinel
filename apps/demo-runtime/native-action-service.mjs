import {openNativeSession} from './native-session-parent.mjs';

// Private native service object; never export this capability to a renderer.
// Desktop bootstrap supplies configuration; native dialog branches decide.
export function createNativeActionService(configuration){
 let snapshot=null,pending=null,terminal=false,finishScan;
 const ready=new Promise(resolve=>{finishScan=resolve;});
 const unavailable=()=>({type:'error',data:{code:'unavailable'}});
 const settle=m=>{if(!pending)return;clearTimeout(pending.timer);const resolve=pending.resolve;pending=null;resolve(m);};
 const session=openNativeSession({...configuration,onMessage:m=>{
  if(m.type==='scan'){
   snapshot=m.data;configuration.onSnapshot?.(snapshot);
   if(snapshot.state!=='running')finishScan({status:snapshot.state,snapshot});
  }else settle(m);
 }});
 session.done.then(result=>{terminal=true;settle(unavailable());finishScan({status:result.status,snapshot});});
 const invoke=send=>{
  if(terminal)return Promise.resolve(unavailable());
  if(pending)return Promise.resolve({type:'error',data:{code:'busy'}});
  return new Promise(resolve=>{
   const timer=setTimeout(()=>{settle({type:'error',data:{code:'action_failed'}});session.close();},5000);
   pending={resolve,timer};
   if(!send())settle({type:'error',data:{code:'action_unavailable'}});
  });
 };
 return Object.freeze({
  ready,done:session.done,
  snapshot:()=>snapshot,
  cancel:()=>session.cancel(),
  close:()=>{session.close();return session.done;},
  prepareQuarantine:reportRef=>invoke(()=>session.prepareQuarantine(reportRef)),
  prepareRestore:actionRef=>invoke(()=>session.prepareRestore(actionRef)),
  // Only trusted native confirmation results can enter these methods.
  nativeQuarantineDecision:(actionRef,decision)=>invoke(()=>session.nativeQuarantineDecision(actionRef,decision)),
  nativeRestoreDecision:(restoreRef,decision)=>invoke(()=>session.nativeRestoreDecision(restoreRef,decision))
 });
}
