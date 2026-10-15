import {gmailSelectors} from './providers/gmail.js';
import {outlookSelectors} from './providers/outlook.js';
const active=new WeakMap();let frameId=0;
/** Compact local warning. Never inserts email text as markup. */
export function showEmailWarning(root,result,{onWrongFlag=()=>{},onManageTrust=null,assetUrl=path=>new URL('../assets/'+path,import.meta.url).href}={}){
 active.get(root)?.();
 if(result.tier==='Safe')return ()=>{};
 const doc=root.ownerDocument,host=doc.createElement('div');host.dataset.sentinelEmail='warning';
 const token=`sentinel-email-${++frameId}`,previousFrame=root.getAttribute('data-sentinel-email-frame');
 const frame=doc.createElement('style');frame.dataset.sentinelEmail='frame-style';
 frame.textContent=`[data-sentinel-email-frame="${token}"]{outline:2px solid ${result.tier==='Likely Scam'?'#ff3947':'#e9b436'}!important;outline-offset:4px!important;border-radius:14px!important}`;
 doc.head.append(frame);root.setAttribute('data-sentinel-email-frame',token);
 const shadow=host.attachShadow({mode:'closed'}),style=doc.createElement('style');
 style.textContent=`:host{display:block!important;box-sizing:border-box!important;width:100%!important;min-width:0!important;max-width:none!important;flex:0 0 100%!important;grid-column:1/-1!important;clear:both!important;margin:24px 0 8px!important;font:14px/1.5 system-ui!important;color:#1b1e4a!important}*{box-sizing:border-box}section{display:grid;grid-template-columns:92px minmax(0,1fr) 92px;gap:16px;align-items:center;padding:14px 12px;border-radius:12px;background:linear-gradient(115deg,#fff4c7,#ffe4a0);color:#1b1e4a;min-width:0}section.red{background:linear-gradient(115deg,#ff7868,#ff5965);color:#1b1e4a}.copy{min-width:0}strong{display:block;font-size:16px;line-height:1.3;font-weight:800}p{margin:6px 0 10px;overflow-wrap:anywhere}.actions{display:flex;gap:8px;flex-wrap:wrap}button{font:600 12px/1.4 system-ui;background:#ffffffb8;color:#1b1e4a;border:1px solid #1b1e4a70;border-radius:8px;min-height:34px;padding:6px 10px;cursor:pointer}button:hover{background:#fff}button:focus-visible{outline:3px solid #1b1e4a;outline-offset:3px}button:disabled{opacity:.7;cursor:default}img{display:block;width:92px;height:112px;object-fit:contain;align-self:end;pointer-events:none;filter:drop-shadow(0 4px 3px #1b1e4a25)}@media(max-width:520px){section{grid-template-columns:50px minmax(0,1fr) 50px;gap:8px;padding:12px 8px}img{width:50px;height:76px}strong{font-size:14px}p{font-size:12px}.actions{gap:6px}button{font-size:11px;padding:6px 8px}}`;

 const section=doc.createElement('section');section.setAttribute('role','status');if(result.tier==='Likely Scam')section.className='red';
 const title=doc.createElement('strong');title.textContent=`Sentinel · ${result.tier}`;
 const priority=['known_request','identityRequest','paymentDirective','authentication','linkMismatch','brandSender','doubleExtension','dangerousAttachment','riskyLink'];
 const ordered=[...result.reasons].sort((a,b)=>{const rank=code=>priority.includes(code)?priority.indexOf(code):priority.length;return rank(a.code)-rank(b.code);});
 const reason=doc.createElement('p');reason.textContent=ordered.slice(0,3).map(r=>r.text).join(' · ').slice(0,280);
 const feedback=doc.createElement('button');feedback.type='button';feedback.textContent='Wrong flag';feedback.addEventListener('click',async()=>{feedback.disabled=true;try{await onWrongFlag();feedback.textContent='Feedback noted locally';}catch{feedback.textContent='Feedback unavailable';feedback.disabled=false;}});
 const copy=doc.createElement('div');copy.className='copy';const actions=doc.createElement('div');actions.className='actions';actions.append(feedback);copy.append(title,reason,actions);
 if(onManageTrust){const trust=doc.createElement('button');trust.type='button';trust.textContent='Trusted senders';trust.addEventListener('click',async()=>{try{await onManageTrust();}catch{trust.textContent='Open extension Settings';}});actions.append(trust);}
 for(const name of ['blue-investigate-v1.png','red-alert-v1.png']){const img=doc.createElement('img');img.src=assetUrl(name);img.alt='';img.setAttribute('aria-hidden','true');img.width=92;img.height=112;img.draggable=false;if(name.startsWith('blue'))section.append(img,copy);else section.append(img);}
 shadow.append(style,section);
 const mount=root.querySelector(`${gmailSelectors.body},${outlookSelectors.body}`)||root;
 mount.append(host);
 const cleanup=()=>{host.remove();frame.remove();if(root.getAttribute('data-sentinel-email-frame')===token){if(previousFrame===null)root.removeAttribute('data-sentinel-email-frame');else root.setAttribute('data-sentinel-email-frame',previousFrame);}if(active.get(root)===cleanup)active.delete(root);};
 active.set(root,cleanup);return cleanup;
}
