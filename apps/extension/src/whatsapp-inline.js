import {explainMessage} from './local-checks.js';
const STYLE=`:host{display:block;margin:6px 0;color:#ffe8e8;font:13px/1.5 system-ui,sans-serif}button{cursor:pointer;border:1px solid #fa7e8b;border-radius:12px;background:#481a27e8;color:#ffe8e8;padding:7px 12px;font:600 12px system-ui;box-shadow:0 3px 18px #35121b35}button:focus-visible{outline:3px solid #ffc5cb;outline-offset:3px}.detail{max-width:340px;margin-top:6px;padding:12px 14px;border:1px solid #ff7e8b80;border-radius:12px;background:#211722f5;box-shadow:0 6px 20px #0003}p{margin:6px 0}ul{padding-left:18px;margin:8px 0}.muted{color:#ebbdc5;font-size:11px}@media(prefers-reduced-motion:no-preference){:host{animation:slide .22s ease-out}@keyframes slide{from{opacity:0;transform:translateX(-12px)}to{opacity:1;transform:translateX(0)}}}`;
export function mountWhatsAppWarnings(doc){
 const win=doc.defaultView;
 const records=new Map();let timer=null,stopped=false;
 function clearRecord(node){records.get(node)?.badge?.remove();records.delete(node);}
 function refresh(){
  if(stopped)return;
  // Latest 100 supported rendered text bubbles; confirmed outgoing is excluded.
  // No scrolling, contact names, phone numbers, storage, network or telemetry.
  const candidates=doc.querySelectorAll('.message-in [data-pre-plain-text], [data-testid="msg-container"] [data-pre-plain-text]');
  const all=[],directions=new Map();
  for(const node of candidates){
   const container=node.closest('[data-testid="msg-container"]');
   // Missing tails on consecutive bubbles do not establish sender direction.
   // Show an explicitly ambiguous wording clue rather than guess incoming.
   let direction='incoming';
   if(container){
    if(container.querySelector('[data-testid="tail-out"], [data-testid="msg-check"], [data-testid="msg-dblcheck"], [data-icon="msg-check"], [data-icon="msg-dblcheck"]')||node.closest('.message-out'))continue;
    if(!container.querySelector('[data-testid="tail-in"]'))direction='unknown';
   }else if(!node.closest('.message-in')||node.closest('.message-out'))continue;
   directions.set(node,direction);
   all.push(node);
  }
  const nodes=[];for(let index=Math.max(0,all.length-100);index<all.length;index++)nodes.push(all[index]);
  const live=new Set(nodes);
  for(const node of records.keys())if(!live.has(node)||!node.isConnected)clearRecord(node);
  for(const node of nodes){
   const textNodes=node.querySelectorAll('.selectable-text');
   if(!textNodes.length){clearRecord(node);continue;}
   let text='';for(const part of textNodes){text+=(part.textContent||'').slice(0,4097-text.length);if(text.length>4096)break;}
   const direction=directions.get(node);
   if(records.get(node)?.text===text&&records.get(node)?.direction===direction)continue;
   clearRecord(node);records.set(node,{text,direction,badge:null});
   if(text.length>4096)continue;
   const result=explainMessage(text);if(result.risk!=='suspicious')continue;
   const badge=doc.createElement('span');badge.dataset.sentinelScam='';
   const shadow=badge.attachShadow({mode:'open'});
   const style=doc.createElement('style');style.textContent=STYLE;shadow.append(style);
   const button=doc.createElement('button');button.type='button';button.textContent=direction==='incoming'?'⚠ Potential scam':'⚠ Suspicious wording';button.setAttribute('aria-expanded','false');
   const detail=doc.createElement('div');detail.className='detail';detail.hidden=true;
   const title=doc.createElement('strong');title.textContent='Pause and verify';detail.append(title);
   if(direction==='unknown'){const note=doc.createElement('p');note.className='muted';note.textContent='Message direction is unavailable in this layout. This checks wording only and does not identify the sender.';detail.append(note);}
   const reasons=doc.createElement('ul');for(const reason of result.reasons){const li=doc.createElement('li');li.textContent=reason.text;reasons.append(li);}detail.append(reasons);
   const limits=doc.createElement('p');limits.className='muted';limits.textContent='Checked locally. These patterns do not prove fraud or verify the sender. No message was sent to AI.';detail.append(limits);
   button.onclick=()=>{detail.hidden=!detail.hidden;button.setAttribute('aria-expanded',String(!detail.hidden));};
   shadow.append(button,detail);node.append(badge);records.set(node,{text,direction,badge});
  }
 }
 function schedule(mutations){
  // Ignore our own badge mutations to prevent observer loops.
  if(mutations.every(m=>[...m.addedNodes,...m.removedNodes].length>0&&[...m.addedNodes,...m.removedNodes].every(n=>n.nodeType===1&&n.hasAttribute?.('data-sentinel-scam'))))return;
  if(timer===null)timer=win.setTimeout(()=>{timer=null;refresh();},180);
 }
 const observer=new win.MutationObserver(schedule);observer.observe(doc.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['data-testid','data-icon','class']});refresh();
 return {refresh,stop(){stopped=true;observer.disconnect();if(timer!==null)win.clearTimeout(timer);for(const node of records.keys())clearRecord(node);}};
}
