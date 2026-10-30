(()=>{
 if(window.top!==window||location.protocol!=='https:')return;
 if(globalThis.__sentinelPasswordCompanion==='0.2.44'){globalThis.__sentinelPasswordRescan?.();return;}
 document.querySelectorAll('[data-sentinel-password-icon]').forEach(n=>n.remove());
 globalThis.__sentinelPasswordCompanion='0.2.44';let current=null,queued=false;const icons=new Map(),targets=new WeakMap();
 const send=message=>chrome.runtime.sendMessage({kind:'password_companion',...message});
 void send({action:'resume'}).catch(()=>{});window.setTimeout(()=>{if(!document.querySelector('input[type=password],input[autocomplete=current-password],input[autocomplete=new-password]'))void send({action:'login_success',afterNavigation:true}).catch(()=>{});},1800);
 const target=field=>{current=field;let id=targets.get(field);if(!id){id=window.crypto.randomUUID().replaceAll('-','');targets.set(field,id);}field.dataset.sentinelPasswordTarget=id;return id;};
 const passwordField=n=>n instanceof HTMLInputElement&&(['password'].includes(n.type)||n.type==='text'&&['current-password','new-password'].includes(n.autocomplete));
 const fields=()=>{const roots=[document],found=[];for(let i=0;i<roots.length&&i<64;i++){const root=roots[i];for(const el of root.querySelectorAll('*')){if(passwordField(el))found.push(el);if(el.shadowRoot&&roots.length<64){roots.push(el.shadowRoot);observer.observe(el.shadowRoot,{childList:true,subtree:true,attributes:true,attributeFilter:['type','autocomplete','disabled','readonly']});}}}return found;};
 const place=(field,host)=>{const r=field.getBoundingClientRect();host.hidden=!field.isConnected||field.disabled||field.readOnly||!field.getClientRects().length||r.width<70||r.height<20||r.bottom<0||r.top>window.innerHeight;Object.assign(host.style,{left:Math.max(2,r.right-34)+'px',top:Math.max(2,r.top+(r.height-28)/2)+'px'});};
 function scan(){queued=false;for(const [field,host]of icons)if(!field.isConnected||!passwordField(field)){host.remove();icons.delete(field);}
  for(const field of fields().slice(0,64)){if(icons.has(field)&&icons.get(field).isConnected)continue;if(icons.has(field))icons.delete(field);const host=document.createElement('span');host.dataset.sentinelPasswordIcon='';Object.assign(host.style,{position:'fixed',zIndex:'2147483647',width:'28px',height:'28px'});const shadow=host.attachShadow({mode:'open'});const style=document.createElement('style');style.textContent='button{box-sizing:border-box;display:grid;place-items:center;width:28px;height:28px;padding:2px;border:0;border-radius:8px;color:#c5efff;background:transparent;box-shadow:none;cursor:pointer}button:hover{background:#345f80}button:focus-visible{outline:2px solid #a9e4ff;outline-offset:2px}svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}';const button=document.createElement('button');button.type='button';button.title='Open Sentinel passwords';button.setAttribute('aria-label','Open Sentinel password manager');const logo=document.createElement('img');logo.src=chrome.runtime.getURL('src/assets/brand/sentinel-32.png');logo.alt='';logo.style.cssText='display:block;width:23px;height:23px;object-fit:contain';button.append(logo);button.onpointerdown=e=>e.preventDefault();button.onclick=e=>{if(!e.isTrusted)return;const fieldId=target(field);void send({action:'generator',fieldId,newPassword:field.autocomplete==='new-password'}).then(r=>{if(r?.error)button.title=r.error;}).catch(()=>{button.title='Open Sentinel and try again.';});};shadow.append(style,button);document.documentElement.append(host);icons.set(field,host);}
  for(const [field,host]of icons)place(field,host);
 }
 globalThis.__sentinelPasswordRescan=()=>scan();
 const schedule=()=>{if(!queued){queued=true;(window.requestAnimationFrame||((f)=>window.setTimeout(f,16)))(scan);}};
 document.addEventListener('focusin',event=>{if(event.isTrusted&&event.target instanceof HTMLInputElement&&event.target.type==='password'&&!event.target.disabled&&!event.target.readOnly)target(event.target);},true);
 document.addEventListener('scroll',schedule,true);window.addEventListener('resize',schedule);document.addEventListener('transitionend',schedule,true);document.addEventListener('animationend',schedule,true);
 const observer=new window.MutationObserver(schedule);observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['type','autocomplete','disabled','readonly']});scan();
 let lastCaptured='',lastCapturedAt=0;
 function captureForm(form){
  if(!form)return;
  const fields=[...form.querySelectorAll('input')],passwords=fields.filter(n=>passwordField(n)&&n.value&&n.getClientRects().length&&!n.disabled),fresh=passwords.filter(n=>n.autocomplete==='new-password');
  let password=null;
  if(fresh.length&&fresh.every(n=>n.value===fresh[0].value))password=fresh[0];
  else if(!fresh.length&&passwords.length===1)password=passwords[0];
  else if(!fresh.length&&passwords.length>=2&&passwords.at(-1).value===passwords.at(-2).value)password=passwords.at(-1);
  const possible=fields.filter(n=>['text','email'].includes(n.type)&&n.value&&n.getClientRects().length&&!n.disabled);
  const user=possible.find(n=>n.autocomplete==='username'||n.type==='email')||possible.find(n=>n!==password);const accountNode=document.querySelector('[data-identifier]');const identifier=user?.value||accountNode?.getAttribute('data-identifier')||document.querySelector('input[type=email],input[autocomplete=username]')?.value;
  if(password&&identifier){const signature=identifier;if(signature===lastCaptured&&Date.now()-lastCapturedAt<3000)return;lastCaptured=signature;lastCapturedAt=Date.now();const login={action:'capture',user:identifier,password:password.value};void send(login).then(r=>{if(r?.error)for(const host of icons.values())host.shadowRoot.querySelector('button').title=r.error;}).catch(()=>{});const submittedPath=location.pathname;window.setTimeout(()=>{if(!form.isConnected||!password.isConnected||!password.getClientRects().length||location.pathname!==submittedPath)void send({action:'login_success'}).catch(()=>{});},1800);}
 }
 document.addEventListener('submit',event=>{if(event.isTrusted&&event.target instanceof HTMLFormElement)captureForm(event.target);},true);
 document.addEventListener('click',event=>{if(!event.isTrusted)return;const button=event.target.closest?.('button,input[type=submit],[role=button]');if(!button||button.closest('[data-sentinel-password-icon]'))return;if(button.type==='submit'||/^(sign in|log in|login|next|continue)$/i.test((button.textContent||button.value||'').trim()))captureForm(button.form||button.closest('form')||document);},true);
})();
