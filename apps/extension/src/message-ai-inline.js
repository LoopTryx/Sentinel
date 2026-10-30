import {messageExcerpt} from './message-ai-data.js';
const STYLE=`
:host{display:block;max-width:100%;margin:10px 0 2px;color:#e2eef8;font:13px/1.65 "Segoe UI",system-ui,sans-serif;isolation:isolate}*{box-sizing:border-box}[hidden]{display:none!important}
.answer{position:relative;overflow:hidden;max-width:440px;padding:17px 18px 15px;border:1px solid #73cfff70;border-radius:16px;background:linear-gradient(125deg,#164d70ed 0%,#173357f5 48%,#172440f5 100%);box-shadow:inset 0 1px 0 #b8edff40,inset 0 -1px 0 #030d242e,0 8px 25px #03102340;backdrop-filter:blur(18px) saturate(140%);-webkit-backdrop-filter:blur(18px) saturate(140%);animation:sentinel-reveal .24s ease-out}
.answer:before{content:'';position:absolute;pointer-events:none;inset:0;border-radius:inherit;background:radial-gradient(ellipse at 0% 0%,#31d0ff26,transparent 60%)}
strong{position:relative;display:flex;align-items:center;gap:8px;font-size:11px;font-weight:650;letter-spacing:.03em;color:#b8efff}
strong:before{content:'';width:10px;height:12px;border:1px solid #a5d6f4;border-radius:3px 3px 6px 6px;background:linear-gradient(145deg,#a6dfff33,#5596c114);box-shadow:0 0 10px #67c6ff1a}
p{position:relative;margin:10px 0 15px;font-size:12px;font-weight:400;line-height:1.8;color:#e3effa;white-space:pre-wrap;overflow-wrap:anywhere}
button{position:relative;display:inline-flex;align-items:center;gap:18px;background:linear-gradient(145deg,#b6ecff,#75bff0);color:#102c48;border:1px solid #c0edffb3;border-radius:9px;padding:7px 12px;font:600 11px "Segoe UI",system-ui,sans-serif;min-height:32px;box-shadow:inset 0 1px #ffffff80,0 3px 12px #03172a40;cursor:pointer;transition:background .15s,border-color .15s}
button:after{content:'↗';font-size:14px;font-weight:400}button:hover{background:linear-gradient(145deg,#d0f4ff,#93d6ff);border-color:#e0f8ff}button:disabled{opacity:.55;cursor:wait}button:focus-visible{outline:2px solid #b5e0ff;outline-offset:3px}
.answer.flagged{border-color:#e93451;box-shadow:inset 0 1px #ffffff20,0 8px 25px #03102340}.flagged strong{color:#fff;background:linear-gradient(110deg,#e52d45,#aa102e);border-radius:8px;padding:8px 10px;font-size:13px}.flagged strong:before{display:none}
strong[role=button]{cursor:pointer}strong[role=button]:focus-visible{outline:2px solid #b5e0ff;outline-offset:3px}strong[aria-expanded=false]:after{content:'⌄';margin-left:auto}strong[aria-expanded=true]:after{content:'⌃';margin-left:auto}
@keyframes sentinel-reveal{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
@media(prefers-reduced-motion:reduce){.answer{animation:none}button{transition:none}}
@media(prefers-reduced-transparency:reduce){.answer{background:#182e44;backdrop-filter:none;-webkit-backdrop-filter:none}}
@media(forced-colors:active){.answer{background:Canvas;color:CanvasText;border-color:CanvasText;box-shadow:none;backdrop-filter:none}.answer:before{display:none}strong,p{color:CanvasText}button{background:ButtonFace;color:ButtonText;border-color:ButtonText;box-shadow:none}}
`;
export function mountMessageAi(root,text,api,{isCurrent=()=>root.isConnected,history=[],candidateOnly=false,clickToReveal=false,animate=false,onVerdict=()=>{}}={}){
 const doc=root.ownerDocument,host=doc.createElement('span');host.dataset.sentinelScam='';host.dataset.sentinelAi='';host.dataset.sentinelEmail='ai';
 const shadow=host.attachShadow({mode:'closed'}),style=doc.createElement('style');style.textContent=STYLE;
 const box=doc.createElement('div');box.className='answer';const title=doc.createElement('strong');title.textContent='SentinelAI';
 const answer=doc.createElement('p');answer.textContent='Checking this message…';answer.setAttribute('role','status');
 const more=doc.createElement('button');more.textContent='Learn more';more.type='button';more.hidden=true;box.append(title,answer,more);shadow.append(style,box);root.append(host);
 if(candidateOnly){box.hidden=false;if(!clickToReveal)title.textContent='Checking suspicious wording…';}
 if(clickToReveal){title.textContent='⚠ Suspicious wording';box.classList.add('flagged');answer.hidden=true;more.hidden=true;}
 let ready=false,notified=false,stopped=false,timer=null,wordTimer=null,ref=null,attempts=0,revealed=animate,explanation='Checking this message…';
 const animationFinished=()=>{if((clickToReveal||animate)&&ready&&alive())more.hidden=false;if((!clickToReveal&&!animate)||!ready||notified||!alive())return;notified=true;void request({action:'notify',ref}).catch(()=>{notified=false;});};
 const animateExplanation=()=>{doc.defaultView.clearTimeout(wordTimer);answer.textContent='';const words=explanation.split(/(?<=\s)/);let index=0;const reduced=doc.defaultView.matchMedia?.('(prefers-reduced-motion: reduce)').matches;if(reduced){answer.textContent=explanation;animationFinished();return;}const tick=()=>{if(stopped||!revealed)return;answer.textContent+=words[index++]||'';if(index<words.length)wordTimer=doc.defaultView.setTimeout(tick,Math.min(28,1600/Math.max(1,words.length)));else animationFinished();};tick();};
 const reveal=()=>{if(!clickToReveal)return;revealed=!revealed;title.setAttribute('aria-expanded',String(revealed));answer.hidden=!revealed;more.hidden=true;if(!revealed){doc.defaultView.clearTimeout(wordTimer);return;}animateExplanation();};
 if(clickToReveal){title.setAttribute('role','button');title.tabIndex=0;title.setAttribute('aria-expanded','false');title.onclick=reveal;title.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();reveal();}};}
 const mounted=()=>!stopped&&host.isConnected;
 const alive=()=>mounted()&&isCurrent();
 let reloadRequired=false;
 function showReload(error){if(!/extension context invalidated|extension.*(?:updated|reloaded)|receiving end does not exist/i.test(error?.message||''))return false;reloadRequired=true;ready=false;doc.defaultView.clearTimeout(timer);doc.defaultView.clearTimeout(wordTimer);title.textContent='Sentinel was updated';box.classList.remove('flagged');box.hidden=false;answer.hidden=false;answer.textContent='Refresh this tab to reconnect Sentinel and check this message.';more.textContent='Refresh tab';more.hidden=false;return true;}
 const request=data=>new Promise((resolve,reject)=>{const deadline=doc.defaultView.setTimeout(()=>reject(Error('The console did not respond. Open Sentinel, then choose Try again.')),12000);api.runtime.sendMessage({kind:'message_ai',...data}).then(r=>{if(!r||r.error)throw Error(r?.message||'Open Sentinel to connect your assistant.');return r;}).then(resolve,reject).finally(()=>doc.defaultView.clearTimeout(deadline));});
 more.onclick=async()=>{if(!alive())return;if(reloadRequired){doc.defaultView.location.reload();return;}more.disabled=true;try{if(!ref||more.textContent==='Try again'){ref=null;attempts=0;await start();return;}await request({action:'open',ref});}catch{answer.textContent='Open Sentinel to continue.';}finally{more.disabled=false;}};
 function again(){if(!mounted())return;if(++attempts<180)timer=doc.defaultView.setTimeout(poll,500);else{box.hidden=false;explanation='The explanation is taking longer than usual. Close and reopen this chat to retry.';answer.textContent=explanation;more.textContent='Try again';more.hidden=!isCurrent();answer.hidden=false;}}
 async function poll(){
  if(!mounted())return;if(!isCurrent()){again();return;}
  try{const result=await request({action:'result',ref});if(!mounted())return;if(!isCurrent()){again();return;}if(result.quick?.text){if(result.quick.verdict)onVerdict(result.quick.verdict);if(result.quick.verdict==='likely'){title.textContent='⚠ Potential scam';box.classList.add('flagged');}if(candidateOnly&&result.quick.verdict!=='likely'){box.hidden=true;return;}box.hidden=false;explanation=result.quick.text;ready=true;if(clickToReveal){answer.hidden=!revealed;more.hidden=true;if(revealed)animateExplanation();}else if(animate){answer.hidden=false;more.hidden=false;animateExplanation();}else{answer.textContent=explanation;more.hidden=false;}return;}}
  catch(error){if(mounted()&&showReload(error))return;if(alive()){box.hidden=false;answer.hidden=clickToReveal&&!revealed;answer.textContent=error.message||'Open Sentinel to see more about this message.';explanation=answer.textContent;more.textContent='Try again';more.hidden=false;answer.hidden=false;}else if(mounted())again();return;}
  again();
 }
 async function start(){
  if(!mounted())return;more.hidden=true;more.textContent='Learn more';answer.textContent='Checking this message…';
  try{const result=await request({action:'explain',text:messageExcerpt(text.slice(0,3000)),...(history.length?{history}:{} )});if(!mounted())return;if(result.ignored){host.remove();return;}ref=result.ref;if(!clickToReveal)more.hidden=false;void poll();}
  catch(error){if(mounted()&&showReload(error))return;if(mounted()){box.hidden=false;explanation=error.message;answer.textContent=error.message;answer.hidden=clickToReveal&&!revealed;more.textContent='Try again';more.hidden=false;answer.hidden=false;}}
 }
 void start();
 return ()=>{stopped=true;doc.defaultView.clearTimeout(timer);doc.defaultView.clearTimeout(wordTimer);host.remove();};
}
