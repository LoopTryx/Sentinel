/* Explicit toolbar injection. Controls remain extension-origin, isolated
   from host-page scripts. The surrounding DOM and mascots are transparent. */
(()=>{
 const key='__sentinelFloatingPanel',id='sentinel-overlay-container';
 if(typeof globalThis[key]==='function'){globalThis[key]();return;}
 const existing=document.getElementById(id);if(existing){existing.remove();return;}
 const doc=document,win=doc.defaultView,previous=doc.activeElement;
 if(!doc.body)return;
 const host=doc.createElement('div');host.id=id;host.dataset.sentinelFloating='panel';
 host.style.cssText='all:initial!important;display:block!important;position:fixed!important;top:76px!important;right:16px!important;width:min(480px,calc(100vw - 32px))!important;z-index:2147483647!important;background-color:transparent!important;background-image:none!important;border:0!important;margin:0!important;padding:0!important;overflow:visible!important;pointer-events:none!important;';
 const shadow=host.attachShadow({mode:'closed'}),style=doc.createElement('link');
 style.rel='stylesheet';style.href=chrome.runtime.getURL('src/ui-overlay.css');
 const card=doc.createElement('section');card.className='embedded-card';card.setAttribute('role','dialog');card.setAttribute('aria-label','Sentinel browser panel');card.setAttribute('aria-modal','false');
 const close=doc.createElement('button');close.type='button';close.className='overlay-close';close.textContent='×';close.setAttribute('aria-label','Close Sentinel');
 const frame=doc.createElement('iframe');frame.className='sentinel-controls';frame.title='Sentinel settings and passwords';frame.src=chrome.runtime.getURL('popup.html?overlay=1');frame.referrerPolicy='no-referrer';
 let closed=false;
 function cleanup(restore=true){if(closed)return;closed=true;observer.disconnect();doc.removeEventListener('pointerdown',outside,true);doc.removeEventListener('keydown',escape,true);win.removeEventListener('pagehide',unload);win.removeEventListener('message',frameMessage);host.remove();if(globalThis[key]===cleanup)delete globalThis[key];if(restore&&previous?.isConnected)previous.focus?.({preventScroll:true});}
 function outside(event){if(!event.composedPath().includes(host))cleanup(false);}
 function escape(event){if(event.key==='Escape'&&doc.activeElement===host){event.preventDefault();cleanup();}}
 function frameMessage(event){if(event.source===frame.contentWindow&&event.origin===chrome.runtime.getURL('').replace(/\/$/,'') ){if(event.data==='sentinel-overlay-close')cleanup();else if(event.data?.kind==='sentinel-panel-size'&&typeof event.data.wide==='boolean'){card.style.height=event.data.wide?'min(620px,calc(100dvh - 100px))':'';host.style.setProperty('width',event.data.wide?'min(860px,calc(100vw - 32px))':event.data.view==='home'?'min(580px,calc(100vw - 32px))':'min(480px,calc(100vw - 32px))','important');}}}
 const unload=()=>cleanup(false),observer=new win.MutationObserver(()=>{if(!host.isConnected)cleanup(false);});
 card.append(frame,close);
 for(const [name,cls]of [['red-peeking-v1.png','red'],['blue-ledge-v1.png','blue']]){const image=doc.createElement('img');image.src=chrome.runtime.getURL('src/assets/'+name);image.className='mascot '+cls;image.alt='';image.setAttribute('aria-hidden','true');image.draggable=false;card.append(image);}
 style.addEventListener('error',()=>cleanup(false),{once:true});shadow.append(style,card);globalThis[key]=cleanup;doc.body.appendChild(host);observer.observe(doc.documentElement,{childList:true});observer.observe(doc.body,{childList:true});doc.addEventListener('pointerdown',outside,true);doc.addEventListener('keydown',escape,true);win.addEventListener('pagehide',unload,{once:true});win.addEventListener('message',frameMessage);close.addEventListener('click',()=>cleanup());close.focus({preventScroll:true});
})();
