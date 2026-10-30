import {isMessageCandidate,priorVisibleText} from './message-candidates.js';
import {mountMessageAi} from './message-ai-inline.js';
import {explainMessage} from './local-checks.js';
const STYLE=`
:host{display:block;margin:10px 0 0;font:13px/1.5 "Segoe UI",system-ui,sans-serif;color:#e0eafa}
[hidden]{display:none!important}*{box-sizing:border-box}
button{display:inline-flex;align-items:center;gap:8px;cursor:pointer;border:1px solid #eba5a246;border-radius:9px;background:linear-gradient(135deg,#4b303b,#302b3d);color:#f1c5c1;padding:7px 11px;font:600 11px/1.4 "Segoe UI",system-ui,sans-serif;min-height:30px;box-shadow:inset 0 1px #fff1;transition:border-color .15s,background .15s}
button:before{content:'!';display:grid;place-items:center;width:14px;height:14px;border:1px solid #eab7ae99;border-radius:50%;font-size:10px}
button:hover{border-color:#edc6bd8c;background:#553645}button:focus-visible{outline:2px solid #a9dcff;outline-offset:3px}
.detail{max-width:440px;margin:0;padding:0;border:0;background:transparent;overflow-wrap:anywhere}
p{margin:0}.muted{margin-top:6px;color:#c0bfb4;font-size:12px}
@media(prefers-reduced-motion:reduce){button{transition:none}}
@media(forced-colors:active){button,.detail{background:Canvas;color:CanvasText;border-color:CanvasText}.muted{color:CanvasText}}
`;
export function mountWhatsAppWarnings(doc,api=globalThis.chrome){
 const win=doc.defaultView;
 // The direct child badge owns the outline: recycled/cleared messages lose it automatically.
 // Outline does not resize WhatsApp bubbles or overwrite page inline styles.
 const bubbleStyle=doc.createElement('style');bubbleStyle.dataset.sentinelScam='';
 bubbleStyle.textContent='[data-pre-plain-text]:has(> [data-sentinel-flagged]){outline:none;box-shadow:none;border-radius:0}@media(forced-colors:active){[data-pre-plain-text]:has(> [data-sentinel-flagged]){outline-color:CanvasText}}';
 doc.head.append(bubbleStyle);
 const records=new Map();let timer=null,stopped=false;
 function clearRecord(node){records.get(node)?.cleanup?.();records.get(node)?.badge?.remove();records.delete(node);}
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
   const direction=directions.get(node),history=priorVisibleText(all,node,'.selectable-text'),historyKey=JSON.stringify(history);
   if(records.get(node)?.text===text&&records.get(node)?.direction===direction&&records.get(node)?.historyKey===historyKey)continue;
   clearRecord(node);records.set(node,{text,direction,historyKey,badge:null});
   if(text.length>4096)continue;
   const result=explainMessage(text);if(result.risk!=='suspicious'&&!isMessageCandidate(text))continue;
   if(api?.runtime?.sendMessage){
    const cleanup=mountMessageAi(node,text,api,{history,candidateOnly:true,clickToReveal:true,onVerdict:verdict=>{const record=records.get(node);if(node.isConnected&&record?.text===text){const card=Array.from(node.children).find(n=>n.hasAttribute('data-sentinel-ai'));if(card){if(verdict==='likely')card.setAttribute('data-sentinel-flagged','');else card.removeAttribute('data-sentinel-flagged');}}},isCurrent:()=>node.isConnected&&records.get(node)?.text===text&&records.get(node)?.historyKey===historyKey});
    records.set(node,{text,direction,historyKey,badge:null,cleanup});continue;
   }
   const badge=doc.createElement('span');badge.dataset.sentinelScam='';
   const shadow=badge.attachShadow({mode:'open'});
   const style=doc.createElement('style');style.textContent=STYLE;shadow.append(style);
   const button=doc.createElement('button');button.type='button';button.className='warning-trigger';button.setAttribute('aria-expanded','false');
   const detail=doc.createElement('div');detail.className='detail';detail.hidden=true;
   button.textContent=`⚠ Review message${direction==='unknown'?' · wording only':''}`;
   badge.setAttribute('data-sentinel-flagged','');
   const summary=doc.createElement('p');
   summary.textContent=`${result.signals.map(signal=>signal.label).join(' · ')}. Verify independently.`;
   const limits=doc.createElement('p');limits.className='muted';
   limits.textContent=direction==='unknown'?'Direction unknown · Local clues, not proof of fraud.':'Verify unusual requests through another channel.';
   detail.append(summary,limits);
   button.onclick=()=>{detail.hidden=!detail.hidden;button.setAttribute('aria-expanded',String(!detail.hidden));};
   shadow.append(button,detail);badge.hidden=!!api?.runtime?.sendMessage;node.append(badge);records.set(node,{text,direction,historyKey,badge});
   if(api?.runtime?.sendMessage){const cleanup=mountMessageAi(detail,text,api,{history,candidateOnly:true,clickToReveal:true,onVerdict:verdict=>{if(node.isConnected&&records.get(node)?.text===text){badge.hidden=verdict!=='likely';button.textContent='Potential scam';}},isCurrent:()=>node.isConnected&&records.get(node)?.text===text&&records.get(node)?.historyKey===historyKey});records.set(node,{text,direction,historyKey,badge,cleanup});detail.hidden=false;button.setAttribute('aria-expanded','true');}
  }
 }
 function schedule(mutations){
  // Ignore our own badge mutations to prevent observer loops.
  if(mutations.every(m=>[...m.addedNodes,...m.removedNodes].length>0&&[...m.addedNodes,...m.removedNodes].every(n=>n.nodeType===1&&n.hasAttribute?.('data-sentinel-scam'))))return;
  if(timer===null)timer=win.setTimeout(()=>{timer=null;refresh();},180);
 }
 const observer=new win.MutationObserver(schedule);observer.observe(doc.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['data-testid','data-icon','class']});refresh();
 return {refresh,stop(){stopped=true;observer.disconnect();if(timer!==null)win.clearTimeout(timer);for(const node of records.keys())clearRecord(node);bubbleStyle.remove();}};
}
