/** Confirmation for flagged mail only; page-level interception is not OS/network blocking. */
export function guardEmailLinks(root,{isCurrent=()=>true}={}){
 const doc=root.ownerDocument;let panel=null;
 function close(){panel?.remove();panel=null;}
 function click(event){
  const link=event.target.closest?.('a[href]');if(!link||!root.contains(link)||link.closest('[data-sentinel-email]'))return;
  event.preventDefault();event.stopImmediatePropagation();close();
  const raw=link.getAttribute('href');let url;
  try{if(!raw||raw.length>2048)throw new Error();url=new URL(raw,doc.baseURI);if(!['https:','http:'].includes(url.protocol)||url.href.length>2048)throw new Error();}catch{return;}
  panel=doc.createElement('div');panel.dataset.sentinelEmail='confirmation';const shadow=panel.attachShadow({mode:'closed'});
  const box=doc.createElement('section');box.setAttribute('role','alertdialog');box.setAttribute('aria-label','Confirm email link');
  const style=doc.createElement('style');style.textContent='section{font:14px/1.4 system-ui;background:#1b1e4a;color:#fff;padding:16px;border-radius:12px;margin:8px 0;overflow-wrap:anywhere}button{padding:8px 12px;margin:8px 8px 0 0;cursor:pointer}';
  const label=doc.createElement('p');label.textContent=`Actual destination: ${url.href}`;
  const cancel=doc.createElement('button');cancel.type='button';cancel.textContent='Stay here';cancel.onclick=close;
  const proceed=doc.createElement('button');proceed.type='button';proceed.textContent='Open anyway';
  proceed.onclick=()=>{if(!root.isConnected||!root.contains(link)||!isCurrent()||link.getAttribute('href')!==raw){close();return;}doc.defaultView.open(url.href,'_blank','noopener,noreferrer');close();};
  box.append(label,cancel,proceed);shadow.append(style,box);root.prepend(panel);cancel.focus();
 }
 root.addEventListener('click',click,true);root.addEventListener('auxclick',click,true);
 return ()=>{close();root.removeEventListener('click',click,true);root.removeEventListener('auxclick',click,true);};
}
