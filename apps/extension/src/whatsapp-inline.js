import {explainMessage} from './local-checks.js';
const STYLE=`
:host{display:block;margin:8px 0 0;font:12px/1.45 system-ui,sans-serif;color:#eee9dc}
[hidden]{display:none!important}*{box-sizing:border-box}
button{cursor:pointer;border:1px solid #ff827b;border-radius:10px;background:linear-gradient(125deg,#ec2937,#d21319 65%,#b91034);color:#fff;padding:8px 12px;font:700 12px/1.4 system-ui}
button:focus-visible{outline:3px solid #8ac7ff;outline-offset:3px}
.detail{max-width:320px;margin-top:8px;padding:10px 12px;border:1px solid #afaea24d;border-radius:8px;background:#1b1e4a;overflow-wrap:anywhere}
p{margin:0}.muted{margin-top:6px;color:#c0bfb4;font-size:11px}
@media(forced-colors:active){button,.detail{background:Canvas;color:CanvasText;border-color:CanvasText}.muted{color:CanvasText}}
`;
export function mountWhatsAppWarnings(doc){
 const win=doc.defaultView;
 // The direct child badge owns the outline: recycled/cleared messages lose it automatically.
 // Outline does not resize WhatsApp bubbles or overwrite page inline styles.
 const bubbleStyle=doc.createElement('style');bubbleStyle.dataset.sentinelScam='';
 bubbleStyle.textContent='[data-pre-plain-text]:has(> [data-sentinel-flagged]){outline:2px solid #e51c2a;outline-offset:5px;border-radius:8px}@media(forced-colors:active){[data-pre-plain-text]:has(> [data-sentinel-flagged]){outline-color:CanvasText}}';
 doc.head.append(bubbleStyle);
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
   const button=doc.createElement('button');button.type='button';button.className='warning-trigger';button.setAttribute('aria-expanded','false');
   const detail=doc.createElement('div');detail.className='detail';detail.hidden=true;
   button.textContent=`⚠ ${result.tier}${direction==='unknown'?' · wording only':''}`;
   badge.setAttribute('data-sentinel-flagged','');
   const summary=doc.createElement('p');
   summary.textContent=`${result.signals.map(signal=>signal.label).join(' · ')}. Verify independently.`;
   const limits=doc.createElement('p');limits.className='muted';
   limits.textContent=direction==='unknown'?'Direction unknown · Local clues, not proof of fraud.':'Local clues, not proof of fraud · No AI upload';
   detail.append(summary,limits);
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
 return {refresh,stop(){stopped=true;observer.disconnect();if(timer!==null)win.clearTimeout(timer);for(const node of records.keys())clearRecord(node);bubbleStyle.remove();}};
}
