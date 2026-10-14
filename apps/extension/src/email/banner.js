/** Compact local warning. Never inserts email text as markup. */
export function showEmailWarning(root,result,{onWrongFlag=()=>{}}={}){
 root.querySelector(':scope > [data-sentinel-email]')?.remove();
 if(result.tier==='Safe')return ()=>{};
 const doc=root.ownerDocument,host=doc.createElement('div');host.dataset.sentinelEmail='warning';
 const shadow=host.attachShadow({mode:'closed'}),style=doc.createElement('style');
 style.textContent=':host{display:block;margin:8px 0;font:14px/1.4 system-ui;color:#1b1e4a}section{padding:12px 16px;border-radius:12px;background:#fff3c4;border:1px solid #e9b436}section.red{background:linear-gradient(110deg,#ff4242,#d21319);color:#fff}strong{font-size:14px}p{margin:4px 0 8px}button{font:inherit;background:transparent;color:inherit;border:1px solid currentColor;border-radius:6px;padding:4px 8px;cursor:pointer}';
 const section=doc.createElement('section');section.setAttribute('role','status');if(result.tier==='Likely Scam')section.className='red';
 const title=doc.createElement('strong');title.textContent=`Sentinel · ${result.tier}`;
 const reason=doc.createElement('p');reason.textContent=result.reasons.slice(0,3).map(r=>r.text).join(' · ').slice(0,280);
 const feedback=doc.createElement('button');feedback.type='button';feedback.textContent='Wrong flag';feedback.addEventListener('click',async()=>{feedback.disabled=true;try{await onWrongFlag();feedback.textContent='Feedback noted locally';}catch{feedback.textContent='Feedback unavailable';feedback.disabled=false;}});
 section.append(title,reason,feedback);shadow.append(style,section);root.prepend(host);
 return ()=>host.remove();
}
