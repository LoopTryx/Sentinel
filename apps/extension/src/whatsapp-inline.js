import {explainMessage} from './local-checks.js';
import {createMessageFeedback} from './message-feedback.js';
const STYLE=`
:host{--navy:#1b1e4a;--surface:#141832;--beige:#eee9dc;--muted:#c0bfb4;--blue:#8ac7ff;display:block;max-width:100%;margin:12px 0 0;color:var(--beige);font:13px/1.5 system-ui,sans-serif;color-scheme:dark}
*{box-sizing:border-box}[hidden]{display:none!important}
button{min-height:40px;cursor:pointer;border:1px solid #afaea24d;border-radius:10px;background:#24294f;color:var(--beige);padding:9px 14px;font:650 12px/1.4 system-ui}
.warning-trigger{border-color:#ff827b;background:linear-gradient(125deg,#ec2937,#d21319 65%,#b91034);color:#fff;box-shadow:inset 0 1px 0 #ffffff30,0 3px 10px #d2131925}
button:hover{filter:brightness(1.1)}button:disabled{cursor:default;opacity:.65}:focus-visible{outline:3px solid var(--blue);outline-offset:3px}
.detail{width:100%;max-width:420px;margin-top:12px;padding:20px;border:1px solid #afaea238;border-top:3px solid #e51c2a;border-radius:14px;background:linear-gradient(145deg,#20254e,var(--surface));box-shadow:0 12px 28px #0003;overflow-wrap:anywhere}
.detail strong{display:block;color:#ffadb0;font-size:15px;line-height:1.4}p{margin:8px 0}ul{list-style:none;padding:0;margin:12px 0 16px}li{padding:10px 0 10px 12px;border-inline-start:2px solid #2f89e3;border-bottom:1px solid #afaea21a}li:last-child{border-bottom:0}
.muted{color:var(--muted);font-size:12px;line-height:1.5}.review-tools{border-top:1px solid #afaea22e;margin-top:16px;padding-top:4px}
summary{min-height:44px;display:list-item;align-content:center;cursor:pointer;color:var(--blue);font-weight:650}.review-tools label{display:flex;gap:10px;align-items:center;min-height:44px;font-size:12px}.review-tools label:first-of-type{display:block;margin:8px 0}
select{display:block;width:100%;height:44px;margin-top:8px;padding:8px 12px;border:1px solid #afaea257;border-radius:8px;color:var(--beige);background:var(--navy);font:inherit}input[type=checkbox]{width:17px;height:17px;margin:0;accent-color:#2f89e3;flex:none}
.feedback-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.feedback-actions button{flex:1 1 140px;min-height:44px}.privacy-note{border-top:1px solid #afaea22e;padding-top:12px;margin:16px 0 0}
@media(forced-colors:active){button,.warning-trigger,.detail,select{background:Canvas;color:CanvasText;border:1px solid CanvasText;box-shadow:none}.detail strong,.muted,summary{color:CanvasText}li,.review-tools,.privacy-note{border-color:CanvasText}}
`;
export function mountWhatsAppWarnings(doc){
 const win=doc.defaultView;
 const feedback=createMessageFeedback();
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
   let result=explainMessage(text);if(result.risk!=='suspicious')continue;
   const badge=doc.createElement('span');badge.dataset.sentinelScam='';
   const shadow=badge.attachShadow({mode:'open'});
   const style=doc.createElement('style');style.textContent=STYLE;shadow.append(style);
   const button=doc.createElement('button');button.type='button';button.className='warning-trigger';button.setAttribute('aria-expanded','false');
   const detail=doc.createElement('div');detail.className='detail';detail.hidden=true;
   const title=doc.createElement('strong');detail.append(title);
   if(direction==='unknown'){const note=doc.createElement('p');note.className='muted';note.textContent='Message direction is unavailable in this layout. This checks wording only and does not identify the sender.';detail.append(note);}
   const reasons=doc.createElement('ul');detail.append(reasons);
   const tools=doc.createElement('details');tools.className='review-tools';const toolsSummary=doc.createElement('summary');toolsSummary.textContent='Sender & feedback';tools.append(toolsSummary);detail.append(tools);
   const context={};
   const contextLabel=doc.createElement('label');contextLabel.textContent='Sender context (you choose): ';
   const select=doc.createElement('select');select.setAttribute('aria-label','Sender contact status');
   for(const [value,label] of [['unknown','Unknown'],['unsaved','Not saved'],['saved','Saved contact']]){const option=doc.createElement('option');option.value=value;option.textContent=label;select.append(option);}contextLabel.append(select);tools.append(contextLabel);
   const contextNote=doc.createElement('p');contextNote.className='muted';contextNote.textContent='This message only. No contacts or numbers read.';tools.append(contextNote);
   function render(){
    button.textContent=result.risk==='suspicious'?`⚠ ${result.tier}${direction==='unknown'?' · wording only':''}`:'No combined warning';
    button.style.background=result.risk==='suspicious'?'':'#1b1e4a';
    title.textContent=result.risk==='suspicious'?`${result.tier} · pause and verify`:'Below warning threshold';
    if(result.risk==='suspicious')badge.setAttribute('data-sentinel-flagged','');else badge.removeAttribute('data-sentinel-flagged');
    reasons.replaceChildren();for(const reason of result.reasons){const li=doc.createElement('li');li.textContent=reason.text;reasons.append(li);}
   }
   function reassess(){result=explainMessage(text,context);render();}
   select.onchange=()=>{context.senderStatus=select.value;reassess();};
   for(const [key,label] of [['firstTime','First-time sender'],['foreignCountryCode','Unfamiliar country code'],['trusted','Trusted sender (strong requests still warn)']]){
    const row=doc.createElement('label');const check=doc.createElement('input');check.type='checkbox';check.onchange=()=>{context[key]=check.checked;reassess();};row.append(check,doc.createTextNode(` ${label}`));tools.append(row);
   }
   const report=doc.createElement('button');report.type='button';report.textContent='Report wrong flag';
   const reportStatus=doc.createElement('p');reportStatus.className='muted';reportStatus.setAttribute('role','status');
   const feedbackActions=doc.createElement('div');feedbackActions.className='feedback-actions';tools.append(feedbackActions,reportStatus);
   report.onclick=()=>{report.disabled=true;const counts=feedback.report(result.tier,result.categories);reportStatus.textContent=`${Object.values(counts).reduce((a,b)=>a+b,0)} report(s) in this tab. No text saved or uploaded; this does not retrain the detector.`;};feedbackActions.append(report);
   const exportFeedback=doc.createElement('button');exportFeedback.type='button';exportFeedback.textContent='Download feedback counts';
   exportFeedback.onclick=()=>{const link=doc.createElement('a');link.href=`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(feedback.export(),null,2))}`;link.download='sentinel-feedback-counts.json';shadow.append(link);link.click();link.remove();};feedbackActions.append(exportFeedback);
   const limits=doc.createElement('p');limits.className='muted privacy-note';limits.textContent='Local clues · Not proof of fraud · No AI upload';detail.append(limits);
   render();
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
 return {refresh,feedback:()=>feedback.snapshot(),stop(){stopped=true;observer.disconnect();if(timer!==null)win.clearTimeout(timer);for(const node of records.keys())clearRecord(node);bubbleStyle.remove();feedback.clear();}};
}
