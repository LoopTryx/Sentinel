import {messageExcerpt} from './message-ai-data.js';
const STYLE=`:host{display:block;margin:12px 0;color:#dfebf9;font:13px/1.65 "Segoe UI",system-ui,sans-serif;isolation:isolate}*{box-sizing:border-box}.answer{position:relative;max-width:520px;padding:15px 17px 14px;border:1px solid #8cb7e42b;border-radius:10px;background:linear-gradient(135deg,#1d3048f5,#122137f7);box-shadow:0 8px 26px #07101e24;animation:appear .22s ease-out}.answer:before{content:'';position:absolute;left:0;top:19px;width:2px;height:17px;background:#8acaff;border-radius:0 2px 2px 0}strong{display:flex;align-items:center;gap:7px;font-size:11px;font-weight:650;letter-spacing:.015em;color:#aedbff}strong:before{content:'';width:6px;height:7px;border:1px solid #8fcdfb;border-radius:2px 2px 4px 4px;background:#6cacdf20}p{margin:9px 0 14px;font-size:12px;font-weight:400;line-height:1.8;color:#ccdaeb;white-space:pre-wrap;overflow-wrap:anywhere}button{display:inline-flex;align-items:center;gap:15px;background:#7ebcf014;color:#acd8fc;border:1px solid #92c7f039;border-radius:5px;padding:6px 10px;font:600 11px "Segoe UI",system-ui,sans-serif;min-height:30px;cursor:pointer;transition:background .15s,border-color .15s}button:after{content:'↗';font-size:14px;font-weight:400}button:hover{background:#7ebcf028;border-color:#92c7f075}button:disabled{opacity:.5;cursor:wait}button[hidden]{display:none}button:focus-visible{outline:2px solid #b5e0ff;outline-offset:3px}@keyframes appear{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}@media(prefers-reduced-motion:reduce){.answer{animation:none}button{transition:none}}@media(forced-colors:active){.answer{background:Canvas;color:CanvasText;border-color:CanvasText;box-shadow:none}strong,p{color:CanvasText}button{background:ButtonFace;color:ButtonText;border-color:ButtonText}.answer:before{background:Highlight}}`;
export function mountMessageAi(root,text,api,{isCurrent=()=>root.isConnected,history=[],candidateOnly=false,onVerdict=()=>{}}={}){
 const doc=root.ownerDocument,host=doc.createElement('span');host.dataset.sentinelScam='';host.dataset.sentinelAi='';host.dataset.sentinelEmail='ai';
 const shadow=host.attachShadow({mode:'closed'}),style=doc.createElement('style');style.textContent=STYLE;
 const box=doc.createElement('div');box.className='answer';const title=doc.createElement('strong');title.textContent='SentinelAI';
 const answer=doc.createElement('p');answer.textContent='Checking this message…';answer.setAttribute('role','status');
 const more=doc.createElement('button');more.textContent='Learn more';more.type='button';more.hidden=true;box.append(title,answer,more);shadow.append(style,box);root.append(host);
 if(candidateOnly)box.hidden=true;
 let stopped=false,timer=null,ref=null,attempts=0;
 const mounted=()=>!stopped&&host.isConnected;
 const alive=()=>mounted()&&isCurrent();
 const request=data=>api.runtime.sendMessage({kind:'message_ai',...data}).then(r=>{if(!r||r.error)throw Error(r?.message||'Open Sentinel to connect your assistant.');return r;});
 more.onclick=async()=>{if(!alive())return;more.disabled=true;try{if(!ref){await start();return;}await request({action:'open',ref});}catch{answer.textContent='Open Sentinel to continue.';}finally{more.disabled=false;}};
 function again(){if(!mounted())return;if(++attempts<70)timer=doc.defaultView.setTimeout(poll,500);else{answer.textContent='The explanation is taking longer than usual.';more.hidden=!isCurrent();}}
 async function poll(){
  if(!mounted())return;if(!isCurrent()){again();return;}
  try{const result=await request({action:'result',ref});if(!mounted())return;if(!isCurrent()){again();return;}if(result.quick?.text){if(result.quick.verdict){onVerdict(result.quick.verdict);if(candidateOnly&&result.quick.verdict!=='likely'){box.hidden=true;return;}}box.hidden=false;answer.textContent=result.quick.text;more.hidden=false;return;}}
  catch{if(alive()){answer.textContent='Open Sentinel to see more about this message.';more.hidden=false;}else if(mounted())again();return;}
  again();
 }
 async function start(){
  if(!mounted())return;more.hidden=true;more.textContent='Learn more';answer.textContent='Checking this message…';
  try{const result=await request({action:'explain',text:messageExcerpt(text.slice(0,3000)),...(history.length?{history}:{} )});if(!mounted())return;ref=result.ref;void poll();}
  catch(error){if(mounted()){answer.textContent=error.message;more.textContent='Try again';more.hidden=false;}}
 }
 void start();
 return ()=>{stopped=true;doc.defaultView.clearTimeout(timer);host.remove();};
}
