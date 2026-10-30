import type {AiFinding} from '@sentinel/contracts/generated/AiFinding';
import type {AiAnswer} from '@sentinel/contracts/generated/AiAnswer';
export type ChatMessage={id:string;role:'user'|'assistant';text:string;tier?:'quick'|'deep';answer?:AiAnswer};
export type AiChat={id:string;title:string;finding:AiFinding|null;messages:ChatMessage[];draft:string;phase:'idle'|'quick_queued'|'quick'|'queued'|'deep'|'ready'|'error';error:string;createdAt:number};
export function newChat(finding:AiFinding|null=null,question=''):AiChat{return {id:crypto.randomUUID(),title:finding?(finding.source==='whatsapp_message'?'WhatsApp message':finding.source.endsWith('_message')?'Email message':new URL(finding.url).hostname):'New conversation',finding,messages:[],draft:question,phase:'idle',error:'',createdAt:Date.now()};}
export function updateChat(chats:AiChat[],id:string,update:(chat:AiChat)=>AiChat){return chats.map(c=>c.id===id?update(c):c);}
export function completeChat(chats:AiChat[],id:string,message:ChatMessage){return updateChat(chats,id,c=>({...c,messages:[...c.messages,message].slice(-60),phase:'ready',error:''}));}

// Persist completed text only. Finding references, pending jobs and unsent drafts
// cannot regain authority when restored after a restart.
export function historySnapshot(chats:AiChat[]){
 const snapshot={schemaVersion:1,chats:chats.filter(c=>c.messages.length).slice(0,24).map(c=>({id:c.id,title:c.title,createdAt:c.createdAt,messages:c.messages.slice(-60).map(m=>({id:m.id,role:m.role,text:(m.text+(m.answer?.uncertainty?'\n\n'+m.answer.uncertainty:'')+(m.answer?.recommendations.length?'\n\n'+m.answer.recommendations.map(r=>'- '+r).join('\n'):'')).slice(0,12000),tier:m.tier}))}))};
 // Bound the entire native envelope as history grows; keep the newest messages.
 while(JSON.stringify(snapshot).length>500000){if(snapshot.chats.length>1)snapshot.chats.pop();else if(snapshot.chats[0]?.messages.length>1)snapshot.chats[0].messages.shift();else break;}
 return snapshot;
}

export function restoreHistory(value:unknown):AiChat[]{
 if(!value||typeof value!=='object'||!Array.isArray((value as any).chats))return [];
 return (value as any).chats.slice(0,24).flatMap((c:any)=>{
  if(typeof c.id!=='string'||c.id.length>64||typeof c.title!=='string'||c.title.length>100||!Array.isArray(c.messages)||c.messages.length>60||!c.messages.every((m:any)=>typeof m.id==='string'&&m.id.length<=64&&(m.role==='user'||m.role==='assistant')&&typeof m.text==='string'&&m.text.length<=12000))return [];
  return [{...newChat(),id:c.id,title:c.title,createdAt:typeof c.createdAt==='number'?c.createdAt:Date.now(),messages:c.messages.map((m:any)=>({id:m.id,role:m.role,text:m.text,tier:m.tier==='deep'?'deep':'quick'})),phase:'ready' as const}];
 });
}
