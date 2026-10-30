import type {AiFinding} from '@sentinel/contracts/generated/AiFinding';

export function installAiHandoff(target:Window,doc:Document,receive:(handoff:{finding:AiFinding;question:string})=>void){
  const root=doc.documentElement;
  delete root.dataset.sentinelAiHandoffAck;
  const listener=(event:Event)=>{
    const handoff=(event as CustomEvent<{finding:AiFinding;question:string}>).detail;
    if(!/^[a-f0-9]{32}$/.test(handoff?.finding?.ref??'')||typeof handoff.question!=='string')return;
    receive(handoff);
    root.dataset.sentinelAiHandoffAck=handoff.finding.ref;
  };
  target.addEventListener('sentinel-ai-handoff',listener);
  root.dataset.sentinelAiReady='true';
  return()=>{delete root.dataset.sentinelAiReady;delete root.dataset.sentinelAiHandoffAck;target.removeEventListener('sentinel-ai-handoff',listener);};
}
