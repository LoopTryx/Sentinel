/* Injected only by an explicit toolbar click. Navigation only: no page text,
   forms, credentials, cookies, storage, scanning or desktop APIs are read. */
(()=>{
 const key='__sentinelFloatingPanel';
 if(typeof globalThis[key]==='function'){globalThis[key]();return;}
 const existing=document.getElementById('sentinel-injected-panel');if(existing){existing.remove();return;}
 const doc=document,win=doc.defaultView,previous=doc.activeElement;
 const host=doc.createElement('div');host.id='sentinel-injected-panel';host.dataset.sentinelFloating='panel';
 host.style.cssText='all:initial!important;display:block!important;position:fixed!important;top:clamp(12px,12vh,76px)!important;right:16px!important;width:min(480px,calc(100vw - 32px))!important;z-index:2147483647!important;background-color:transparent!important;background-image:none!important;border:0!important;margin:0!important;padding:0!important;pointer-events:none!important;';
 const shadow=host.attachShadow({mode:'closed'}),style=doc.createElement('link');
 style.rel='stylesheet';style.href=chrome.runtime.getURL('src/ui-overlay.css');
 const card=doc.createElement('section');card.className='card';card.setAttribute('role','dialog');card.setAttribute('aria-modal','false');card.setAttribute('aria-label','Sentinel browser panel');
 const header=doc.createElement('header'),title=doc.createElement('h2'),close=doc.createElement('button');title.textContent='SENTINEL';close.type='button';close.className='close';close.textContent='×';close.setAttribute('aria-label','Close Sentinel');const brand=doc.createElement('div');brand.className='brand';const logo=doc.createElement('span');logo.className='logo';logo.textContent='S';brand.append(logo,title);const controls=doc.createElement('div');controls.className='header-controls';const open=doc.createElement('button');open.type='button';open.textContent='↗';open.setAttribute('aria-label','Open Sentinel settings');controls.append(open,close);header.append(brand,controls);
 const content=doc.createElement('div');content.className='content';const actions=doc.createElement('nav');actions.className='actions';actions.setAttribute('aria-label','Sentinel tools');const status=doc.createElement('p');status.setAttribute('role','status');
 let closed=false,busy=false;const cancellations=new Set();
 function cleanup(restore=true){if(closed)return;closed=true;observer.disconnect();doc.removeEventListener('pointerdown',outside,true);doc.removeEventListener('keydown',escape,true);win.removeEventListener('pagehide',unload);for(const cancel of cancellations)cancel();cancellations.clear();host.remove();if(globalThis[key]===cleanup)delete globalThis[key];if(restore&&previous?.isConnected)previous.focus?.({preventScroll:true});}
 function outside(event){if(!event.composedPath().includes(host))cleanup(false);}
 function escape(event){if(event.key==='Escape'&&doc.activeElement===host){event.preventDefault();event.stopPropagation();cleanup();}}
 const unload=()=>cleanup(false),observer=new win.MutationObserver(()=>{if(!host.isConnected)cleanup(false);});
 function request(route){return new Promise((resolve,reject)=>{let done=false;const finish=(error,value)=>{if(done)return;done=true;clearTimeout(timer);cancellations.delete(cancel);error?reject(error):resolve(value);};const cancel=()=>finish(new Error('Closed'));const timer=setTimeout(()=>finish(new Error('Timed out')),6000);cancellations.add(cancel);try{Promise.resolve(chrome.runtime.sendMessage({kind:'floating_open',route})).then(value=>finish(null,value),error=>finish(error));}catch(error){finish(error);}});}
 function addAction(parent,route,label,cls=''){
  const button=doc.createElement('button');button.type='button';button.dataset.route=route;button.textContent=label;button.className=cls;
  button.addEventListener('click',async()=>{if(busy||closed)return;busy=true;button.disabled=true;status.textContent='Opening secure extension page…';try{if((await request(route))?.opened!==true)throw new Error();if(!closed)cleanup(false);}catch{if(!closed){status.textContent='Could not open. Try again.';button.disabled=false;busy=false;}}});parent.append(button);return button;
 }
 const connection=doc.createElement('div');connection.className='connection';const local=doc.createElement('span'),consoleStatus=doc.createElement('span');local.textContent='● On-device';consoleStatus.textContent='Console status in settings';connection.append(local,consoleStatus);
 addAction(actions,'settings','Settings','selected');addAction(actions,'passwords','Passwords');
 const options=doc.createElement('div');options.className='options';const note=doc.createElement('p');note.className='note';note.textContent='Local checks. No email upload.';options.append(note);
 addAction(options,'email','Trusted senders ↗');addAction(options,'settings','Storage & access ↗');
 open.addEventListener('click',()=>actions.firstElementChild.click());
 content.append(actions,options,status);card.append(header,connection,content);
 for(const [name,cls]of [['red-peeking-v1.png','red'],['blue-ledge-v1.png','blue']]){const image=doc.createElement('img');image.src=chrome.runtime.getURL('src/assets/'+name);image.className='mascot '+cls;image.alt='';image.setAttribute('aria-hidden','true');image.draggable=false;card.append(image);}
 style.addEventListener('error',()=>cleanup(false),{once:true});shadow.append(style,card);globalThis[key]=cleanup;doc.documentElement.append(host);observer.observe(doc.documentElement,{childList:true});observer.observe(doc,{childList:true});doc.addEventListener('pointerdown',outside,true);doc.addEventListener('keydown',escape,true);win.addEventListener('pagehide',unload,{once:true});close.addEventListener('click',()=>cleanup());actions.firstElementChild.focus({preventScroll:true});
})();
