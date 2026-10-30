export async function openPasswordPanel(api,tabId,ref=null,fieldId=null){
 if(!Number.isInteger(tabId))throw Error('Open Sentinel on a website first.');
 const url=api.runtime.getURL('field-vault.html')+(ref?'?ref='+encodeURIComponent(ref):'');
 await api.scripting.executeScript({target:{tabId,frameIds:[0]},world:'ISOLATED',func:(src,fieldId,extensionOrigin)=>{
  globalThis.__sentinelFieldPanelClose?.();const host=document.createElement('div');host.dataset.sentinelFieldPanel='';host.style.cssText='all:initial;box-sizing:border-box;padding:0;margin:0;line-height:0;overflow:hidden;position:fixed;z-index:2147483647;width:640px;height:180px;max-width:calc(100vw - 16px);border:0;border-radius:17px;background:linear-gradient(135deg,rgb(27 48 70 / 84%),rgb(13 25 43 / 90%));backdrop-filter:blur(22px) saturate(160%);box-shadow:inset 0 1px #f0fbff66,inset 1px 0 #d5f4ff26,0 16px 42px #0004;';
  const shadow=host.attachShadow({mode:'open'}),frame=document.createElement('iframe');frame.src=src;frame.title='Sentinel passwords';frame.referrerPolicy='no-referrer';frame.style.cssText='display:block;width:100%;height:100%;border:0;border-radius:17px;background:transparent;color-scheme:normal;';shadow.append(frame);
  const roots=[document],inputs=[];for(let i=0;i<roots.length&&i<64;i++)for(const n of roots[i].querySelectorAll('*')){if(n.tagName==='INPUT')inputs.push(n);if(n.shadowRoot&&roots.length<64)roots.push(n.shadowRoot);}
  const field=inputs.find(n=>n.dataset.sentinelPasswordTarget===fieldId&&n.getClientRects().length);
  const place=()=>{const r=field?.getBoundingClientRect();const w=Math.min(640,innerWidth-16),h=host.offsetHeight||200;host.style.left=Math.max(8,Math.min(innerWidth-w-8,r?r.right-w:innerWidth-w-18))+'px';host.style.top=Math.max(8,Math.min(innerHeight-h-8,r?r.bottom+7:80))+'px';};
  function close(){document.removeEventListener('pointerdown',outside,true);document.removeEventListener('keydown',escape,true);window.removeEventListener('scroll',place,true);window.removeEventListener('resize',place);window.removeEventListener('message',message);window.removeEventListener('pagehide',close);host.remove();if(globalThis.__sentinelFieldPanelClose===close)delete globalThis.__sentinelFieldPanelClose;}
  function outside(e){if(!e.composedPath().includes(host)&&!e.composedPath().some(n=>n?.dataset?.sentinelPasswordIcon!==undefined))close();}
  function escape(e){if(e.key==='Escape')close();}
  function message(e){if(e.source!==frame.contentWindow||e.origin!==extensionOrigin)return;if(e.data==='sentinel-field-close')close();else if(e.data?.kind==='sentinel-field-size'&&Number.isInteger(e.data.height)&&e.data.height>=145&&e.data.height<=760){const height=Math.min(e.data.height,Math.max(145,window.innerHeight-24));host.style.height=height+'px';frame.style.height=height+'px';place();}}
  globalThis.__sentinelFieldPanelClose=close;document.documentElement.append(host);place();document.addEventListener('pointerdown',outside,true);document.addEventListener('keydown',escape,true);window.addEventListener('scroll',place,true);window.addEventListener('resize',place);window.addEventListener('message',message);window.addEventListener('pagehide',close,{once:true});
 },args:[url,fieldId,api.runtime.getURL('').replace(/\/$/,'')]});
}
export function installPasswordPanel(api){
 api.runtime.onMessage.addListener((message,sender,respond)=>{
  if(message?.kind!=='password_panel')return false;
  if(sender.id!==api.runtime.id||sender.url?.split(/[?#]/)[0]!==api.runtime.getURL('popup.html'))return false;
  const task=Number.isInteger(sender.tab?.id)?openPasswordPanel(api,sender.tab.id):api.tabs.query({active:true,currentWindow:true}).then(tabs=>openPasswordPanel(api,tabs[0]?.id));
  task.then(()=>respond({ok:true})).catch(e=>respond({error:e.message}));return true;
 });
}
