// Only fixed navigation is exposed to the untrusted page surface.
const routes=Object.freeze({settings:'popup.html?view=settings',passwords:'popup.html?view=passwords',email:'popup.html?view=settings#email-preferences',whatsapp:'popup.html?view=settings#whatsapp-preferences',links:'popup.html?view=settings#link-preferences'});
const http=url=>{if(typeof url!=='string'||url.length>8192)return false;try{return ['http:','https:'].includes(new URL(url).protocol);}catch{return false;}};
const tabId=id=>Number.isInteger(id)&&id>=0&&id<=2147483647;
export function installFloatingControl(api){
 const injecting=new Set(),recent=new Map();let opening=0;
 const fallback=()=>Promise.resolve().then(()=>api.tabs.create({url:api.runtime.getURL('popup.html?view=settings#floating-unavailable')}));
 api.action?.onClicked?.addListener(tab=>{
  if(!tabId(tab?.id)||!http(tab.url)){void fallback().catch(()=>{});return;}
  if(injecting.has(tab.id)||injecting.size>=4)return;
  injecting.add(tab.id);
  // Request immediately in the toolbar-click gesture; activeTab is temporary.
  let grant;try{grant=api.permissions.request({permissions:['scripting']});}catch{grant=Promise.resolve(false);}
  void Promise.resolve(grant).then(async allowed=>{
   if(!allowed){await fallback();return;}
   await api.scripting.executeScript({target:{tabId:tab.id,frameIds:[0]},world:'ISOLATED',files:['src/floating-panel.js']});
  }).catch(()=>fallback().catch(()=>{})).finally(()=>injecting.delete(tab.id));
 });
 api.runtime.onMessage.addListener((message,sender,respond)=>{
  if(message?.kind!=='floating_open')return false;
  if(sender.id!==api.runtime.id||sender.frameId!==0||!tabId(sender.tab?.id)||!http(sender.url)||Object.keys(message).length!==2||typeof message.route!=='string'||message.route.length>32||!Object.hasOwn(routes,message.route)||sender.documentLifecycle&&sender.documentLifecycle!=='active'){respond({error:'Unavailable'});return false;}
  const now=Date.now();for(const [id,at]of recent)if(now-at>5000)recent.delete(id);
  if(opening>=4||recent.has(sender.tab.id)&&now-recent.get(sender.tab.id)<750){respond({error:'Busy'});return false;}
  if(recent.size>=32)recent.delete(recent.keys().next().value);recent.set(sender.tab.id,now);opening++;
  const destination=routes[message.route];
  let settled=false;const reply=value=>{if(!settled){settled=true;try{respond(value);}catch{/* Caller closed; no replay. */}}};
  const timer=setTimeout(()=>reply({error:'Timed out'}),5000);
  Promise.resolve().then(()=>api.tabs.create({url:api.runtime.getURL(destination)})).then(()=>reply({opened:true}),()=>reply({error:'Unavailable'})).finally(()=>{clearTimeout(timer);opening--;});return true;
 });
}
