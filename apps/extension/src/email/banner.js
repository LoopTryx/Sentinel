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
export function showEmailWarning(root,result,{onWrongFlag=()=>{},onManageTrust=null,assetUrl=path=>new URL('../assets/'+path,import.meta.url).href}={}){
 active.get(root)?.();
 if(result.tier==='Safe')return ()=>{};
 const doc=root.ownerDocument,host=doc.createElement('div');host.dataset.sentinelEmail='warning';
 const releaseFont=useHeadingFont(doc,assetUrl('CabinetGrotesk-Variable.woff2'));
 const token=`sentinel-email-${++frameId}`,previousFrame=root.getAttribute('data-sentinel-email-frame');
 const frame=doc.createElement('style');frame.dataset.sentinelEmail='frame-style';
 frame.textContent=`[data-sentinel-email-frame="${token}"]{outline:3px solid ${result.tier==='Likely Scam'?'#ff3947':'#e9b436'}!important;outline-offset:2px!important;border-radius:14px!important}`;
 doc.head.append(frame);root.setAttribute('data-sentinel-email-frame',token);
 const shadow=host.attachShadow({mode:'closed'}),style=doc.createElement('style');
 style.textContent=`:host{display:block!important;box-sizing:border-box!important;width:100%!important;min-width:0!important;max-width:none!important;flex:0 0 100%!important;grid-column:1/-1!important;clear:both!important;margin:16px 0 0!important;font:15px/1.6 system-ui!important;color:#1b1e4a!important}:host{--action:#1b1e4a;--action-hover:#2c3265;--action-ink:#9bddff;--focus:#b4e6ff}*{box-sizing:border-box}section{display:grid;grid-template-columns:112px minmax(0,1fr) 112px;gap:16px;align-items:center;padding:16px;border-radius:12px;background:linear-gradient(115deg,#fff4c7,#ffe4a0);color:#1b1e4a;min-width:0}section.red{background:radial-gradient(circle at 50% 50%,#ff8c78 0%,#ff6b5e 25%,#ff3939 65%,#860303 100%);color:#1b1e4a}.copy{min-width:0}strong{display:block;font-family:"Sentinel Cabinet Grotesk",system-ui,sans-serif;font-size:21px;line-height:1.2;font-weight:800;letter-spacing:-.02em}p{margin:8px 0 14px;overflow-wrap:anywhere;font-weight:550;line-height:1.6;max-width:65ch}.actions{display:flex;gap:8px;flex-wrap:wrap}button{display:inline-flex;align-items:center;justify-content:center;gap:8px;white-space:nowrap;user-select:none;font:600 13px/1.4 system-ui;background:var(--action);color:var(--action-ink);border:0;border-radius:8px;min-height:40px;padding:9px 14px;cursor:pointer;box-shadow:0 1px 2px #080d2333;transition:background-color 150ms ease,box-shadow 150ms ease}button:hover{background:var(--action-hover);box-shadow:0 2px 5px #080d2340}button:active{background:#111431}button:focus-visible{outline:3px solid var(--focus);outline-offset:3px}button:disabled{opacity:.55;cursor:default;pointer-events:none}button[data-variant="secondary"]{background:#252957}button[data-variant="secondary"]:hover{background:var(--action-hover)}@media(prefers-reduced-motion:reduce){button{transition:none}}img{display:block;width:112px;height:136px;object-fit:contain;align-self:end;pointer-events:none;filter:drop-shadow(0 9px 6px #120d3159) drop-shadow(0 2px 1px #120d3133)}@media(max-width:520px){section{grid-template-columns:60px minmax(0,1fr) 60px;gap:8px;padding:16px 12px}img{width:60px;height:92px}strong{font-size:18px}p{font-size:14px}.actions{gap:8px}button{font-size:12px;min-height:44px;padding:8px 12px}}`;

 const section=doc.createElement('section');section.setAttribute('role','status');if(result.tier==='Likely Scam')section.className='red';
 const title=doc.createElement('strong');title.textContent=`Sentinel · ${result.tier}`;
 const priority=['known_request','identityRequest','paymentDirective','authentication','linkMismatch','brandSender','doubleExtension','dangerousAttachment','riskyLink'];
 const ordered=[...result.reasons].sort((a,b)=>{const rank=code=>priority.includes(code)?priority.indexOf(code):priority.length;return rank(a.code)-rank(b.code);});
 const reason=doc.createElement('p');reason.textContent=ordered.slice(0,2).map(r=>r.text).join(' · ').slice(0,180);
 const feedback=doc.createElement('button');feedback.type='button';feedback.dataset.slot='button';feedback.dataset.variant='default';feedback.textContent='Wrong flag';feedback.addEventListener('click',async()=>{feedback.disabled=true;try{await onWrongFlag();feedback.textContent='Feedback noted locally';}catch{feedback.textContent='Feedback unavailable';feedback.disabled=false;}});
 const copy=doc.createElement('div');copy.className='copy';const actions=doc.createElement('div');actions.className='actions';actions.append(feedback);copy.append(title,reason,actions);
 if(onManageTrust){const trust=doc.createElement('button');trust.type='button';trust.dataset.slot='button';trust.dataset.variant='secondary';trust.textContent='Trusted senders';trust.addEventListener('click',async()=>{try{await onManageTrust();}catch{trust.textContent='Open extension Settings';}});actions.append(trust);}
 for(const name of ['blue-investigate-v1.png','red-alert-v1.png']){const img=doc.createElement('img');img.src=assetUrl(name);img.alt='';img.setAttribute('aria-hidden','true');img.width=112;img.height=136;img.draggable=false;if(name.startsWith('blue'))section.append(img,copy);else section.append(img);}
 shadow.append(style,section);
 const mount=root.querySelector(`${gmailSelectors.body},${outlookSelectors.body}`)||root;
 mount.append(host);
 let cleaned=false;const cleanup=()=>{if(cleaned)return;cleaned=true;releaseFont();host.remove();frame.remove();if(root.getAttribute('data-sentinel-email-frame')===token){if(previousFrame===null)root.removeAttribute('data-sentinel-email-frame');else root.setAttribute('data-sentinel-email-frame',previousFrame);}if(active.get(root)===cleanup)active.delete(root);};
 active.set(root,cleanup);return cleanup;
}
