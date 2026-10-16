import {gmailSelectors} from './providers/gmail.js';
import {outlookSelectors} from './providers/outlook.js';
const active=new WeakMap(),headingFonts=new WeakMap();let frameId=0;
function useHeadingFont(doc,src){
 if(!doc.fonts||typeof doc.defaultView?.FontFace!=='function')return ()=>{};
 let record=headingFonts.get(doc);
 if(!record){const face=new doc.defaultView.FontFace('Sentinel Cabinet Grotesk',`url("${src}")`,{weight:'100 900',style:'normal',display:'swap'});record={face,users:0};headingFonts.set(doc,record);void face.load().catch(()=>{});}
 if(record.users++===0)doc.fonts.add(record.face);
 return ()=>{if(--record.users===0)doc.fonts.delete(record.face);};
}
/** Compact local warning. Never inserts email text as markup. */
export function showEmailWarning(root,result,{onWrongFlag=null,onManageTrust=null,onTrustSender=null,assetUrl=path=>new URL('../assets/'+path,import.meta.url).href}={}){
 active.get(root)?.();
 if(result.tier==='Safe')return ()=>{};
 const doc=root.ownerDocument,host=doc.createElement('div');host.dataset.sentinelEmail='warning';
 const releaseFont=useHeadingFont(doc,assetUrl('CabinetGrotesk-Variable.woff2'));
 const token=`sentinel-email-${++frameId}`,previousFrame=root.getAttribute('data-sentinel-email-frame');
 const frame=doc.createElement('style');frame.dataset.sentinelEmail='frame-style';
 frame.textContent=`[data-sentinel-email-frame="${token}"]{outline:5px solid ${result.tier==='Likely Scam'?'#ff3947':'#e9b436'}!important;outline-offset:-16px!important;border-radius:14px!important}`;
 doc.head.append(frame);root.setAttribute('data-sentinel-email-frame',token);
 const shadow=host.attachShadow({mode:'closed'}),style=doc.createElement('style');
 style.textContent=`:host{display:block!important;box-sizing:border-box!important;width:calc(100% - 64px)!important;min-width:0!important;max-width:none!important;flex:0 1 auto!important;grid-column:1/-1!important;clear:both!important;margin:24px 32px 32px!important;transform:translateX(var(--footer-centre-shift,0px))!important;font:17px/1.6 system-ui!important;color:#1b1e4a!important}:host{--action:#1b1e4a;--action-hover:#2c3265;--action-ink:#9bddff;--focus:#b4e6ff}*{box-sizing:border-box}section{display:grid;grid-template-columns:112px minmax(0,1fr) 112px;gap:16px;align-items:center;padding:16px;border-radius:12px;background:linear-gradient(115deg,#fff4c7,#ffe4a0);color:#1b1e4a;min-width:0}section.red{background:radial-gradient(circle at 50% 50%,#ff7565 0%,#ff594e 25%,#ff3939 65%,#860303 100%);color:#1b1e4a}.copy{min-width:0;text-align:center}strong{display:block;font-family:"Sentinel Cabinet Grotesk",system-ui,sans-serif;font-size:24px;line-height:1.2;font-weight:800;letter-spacing:-.02em}.action-status:empty{display:none}.action-status{font-size:14px;margin:8px 0 0}p{margin:8px 0 14px;overflow-wrap:anywhere;font-weight:600;line-height:1.6;max-width:55ch;margin-left:auto;margin-right:auto}.actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}button{display:inline-flex;align-items:center;justify-content:center;gap:8px;white-space:normal;max-width:100%;overflow-wrap:anywhere;user-select:none;font:700 15px/1.4 system-ui;background:var(--action);color:var(--action-ink);border:0;border-radius:8px;min-height:40px;padding:9px 14px;cursor:pointer;box-shadow:0 1px 2px #080d2333;transition:background-color 150ms ease,box-shadow 150ms ease}button:hover{background:var(--action-hover);box-shadow:0 2px 5px #080d2340}button:active{background:#111431}button:focus-visible{outline:5px solid var(--focus);outline-offset:3px}button:disabled{opacity:.55;cursor:default;pointer-events:none}button[data-variant="secondary"]{background:#252957}button[data-variant="secondary"]:hover{background:var(--action-hover)}@media(prefers-reduced-motion:reduce){button{transition:none}}img{display:block;width:112px;height:136px;object-fit:contain;align-self:end;pointer-events:none;filter:drop-shadow(0 9px 6px #120d3159) drop-shadow(0 2px 1px #120d3133)}@media(max-width:520px){:host{width:calc(100% - 48px)!important;margin:24px 24px 32px!important}section{grid-template-columns:40px minmax(0,1fr) 40px;gap:8px;padding:16px 12px}img{width:40px;height:64px}strong{font-size:21px}p{font-size:16px}.actions{gap:8px}button{font-size:14px;min-height:44px;padding:8px 12px}}`;

 const section=doc.createElement('section');section.setAttribute('role','status');if(result.tier==='Likely Scam')section.className='red';
 const title=doc.createElement('strong');title.textContent=`${result.tier}`;
 const priority=['known_request','identityRequest','paymentDirective','authentication','linkMismatch','brandSender','doubleExtension','dangerousAttachment','riskyLink'];
 const ordered=[...result.reasons].sort((a,b)=>{const rank=code=>priority.includes(code)?priority.indexOf(code):priority.length;return rank(a.code)-rank(b.code);});
 const brief={known_request:'Unexpected request for money or codes',identityRequest:'Requests personal or account details',paymentDirective:'Requests a payment',authentication:'Email authentication failed',linkMismatch:'Link hides a different destination',brandSender:'Possible brand impersonation',doubleExtension:'Misleading attachment name',dangerousAttachment:'Risky attachment type',riskyLink:'Suspicious link'};
 const reason=doc.createElement('p');reason.textContent=ordered.slice(0,2).map(r=>brief[r.code]||r.text).join(' · ').slice(0,140);
 const actionStatus=doc.createElement('p');actionStatus.setAttribute('role','status');actionStatus.className='action-status';
 const feedback=doc.createElement('button');feedback.type='button';feedback.dataset.slot='button';feedback.dataset.variant='default';feedback.textContent='Report wrong flag';feedback.disabled=!onWrongFlag;if(!onWrongFlag)feedback.title='Available in the installed extension';feedback.addEventListener('click',async()=>{feedback.disabled=true;feedback.textContent='Saving…';try{if((await onWrongFlag())?.recorded!==true)throw new Error('Not recorded');feedback.textContent='Saved locally';actionStatus.textContent='Feedback saved on this device.';}catch{feedback.textContent='Try again';actionStatus.textContent='Could not save feedback.';feedback.disabled=false;}});
 const copy=doc.createElement('div');copy.className='copy';const actions=doc.createElement('div');actions.className='actions';actions.append(feedback);copy.append(title,reason,actions,actionStatus);
 if(onTrustSender){const trust=doc.createElement('button');trust.type='button';trust.dataset.slot='button';trust.dataset.variant='secondary';trust.textContent='Trust this sender';trust.addEventListener('click',async event=>{trust.disabled=true;trust.textContent='Saving�';try{if((await onTrustSender(event))?.trusted!==true)throw new Error('Not saved');trust.textContent='Sender trusted';actionStatus.textContent='Saved locally. Risky requests can still warn.';}catch{trust.textContent='Try trusting again';actionStatus.textContent='Could not trust sender.';trust.disabled=false;}});actions.append(trust);}
 else if(onManageTrust){const trust=doc.createElement('button');trust.type='button';trust.textContent='Manage trusted senders';trust.addEventListener('click',async()=>{trust.disabled=true;try{if((await onManageTrust())?.opened!==true)throw new Error();actionStatus.textContent='Sender settings opened in a new tab.';}catch{actionStatus.textContent='Could not open settings.';}finally{trust.disabled=false;}});actions.append(trust);}
 for(const name of ['blue-investigate-v1.png','red-alert-v1.png']){const img=doc.createElement('img');img.src=assetUrl(name);img.alt='';img.setAttribute('aria-hidden','true');img.width=112;img.height=136;img.draggable=false;if(name.startsWith('blue'))section.append(img,copy);else section.append(img);}
 shadow.append(style,section);
 const mount=root.querySelector(`${gmailSelectors.body},${outlookSelectors.body}`)||root;
 mount.append(host);
 // Centre against the framed email, including providers with an avatar gutter.
 // Only layout geometry is read; transforms do not change provider flow sizing.
 const align=()=>{const outer=root.getBoundingClientRect(),inner=mount.getBoundingClientRect();
  if(outer.width<160||outer.width>10000||inner.width<=0||inner.width>outer.width)return;
  const shift=(outer.left+outer.width/2)-(inner.left+inner.width/2);
  if(Number.isFinite(shift)&&Math.abs(shift)<=outer.width/2)host.style.setProperty('--footer-centre-shift',`${shift}px`);
 };
 align();const Resize=doc.defaultView?.ResizeObserver,resize=Resize?new Resize(align):null;
 resize?.observe(root);if(mount!==root)resize?.observe(mount);

 let cleaned=false;const cleanup=()=>{if(cleaned)return;cleaned=true;resize?.disconnect();releaseFont();host.remove();frame.remove();if(root.getAttribute('data-sentinel-email-frame')===token){if(previousFrame===null)root.removeAttribute('data-sentinel-email-frame');else root.setAttribute('data-sentinel-email-frame',previousFrame);}if(active.get(root)===cleanup)active.delete(root);};
 active.set(root,cleanup);return cleanup;
}
