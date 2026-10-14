import {createSenderStore} from './sender-store.js';
export const emailOrigins={gmail:['https://mail.google.com/*'],outlook:['https://outlook.live.com/*','https://outlook.office.com/*','https://outlook.office365.com/*']};
export function installEmailControl(api){
 const store=createSenderStore(api);let chain=Promise.resolve(),pending=0;
 const status=async provider=>({enabled:(await api.storage.local.get(`emailOptIn_${provider}`))[`emailOptIn_${provider}`]===true&&await api.permissions.contains({permissions:['scripting'],origins:emailOrigins[provider]})});
 async function toggle(provider,enabled){
  if(enabled&&!await api.permissions.contains({permissions:['scripting'],origins:emailOrigins[provider]}))throw new Error('Site access required.');
  await api.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
  await api.storage.local.set({[`emailOptIn_${provider}`]:enabled});
  const id=`sentinel-email-${provider}`,registered=await api.scripting.getRegisteredContentScripts({ids:[id]});
  if(enabled&&!registered.length)await api.scripting.registerContentScripts([{id,matches:emailOrigins[provider],js:['src/email/bootstrap.js'],runAt:'document_idle',allFrames:false}]);
  if(!enabled&&registered.length)await api.scripting.unregisterContentScripts({ids:[id]});
  // Cap work; existing tabs beyond the bound start on their next page load.
  const tabs=(await api.tabs.query({url:emailOrigins[provider]})).slice(0,32);
  for(const tab of tabs)if(Number.isInteger(tab.id))try{if(enabled)await api.scripting.executeScript({target:{tabId:tab.id},files:['src/email/bootstrap.js']});else await api.tabs.sendMessage(tab.id,{kind:'email_stop'});}catch{/* Closed or inaccessible tab. */}
  return status(provider);
 }
 api.runtime.onMessage.addListener((message,sender,respond)=>{
  if(sender.id!==api.runtime.id||typeof message?.kind!=='string'||!message.kind.startsWith('email_'))return false;
  const popup=sender.url?.split(/[?#]/)[0]===api.runtime.getURL('popup.html');
  let provider=null;try{const url=new URL(sender.url);if(url.protocol==='https:')provider=Object.keys(emailOrigins).find(p=>emailOrigins[p].some(o=>new URL(o).hostname===url.hostname));}catch{}
  const content=sender.frameId===0&&Number.isInteger(sender.tab?.id)&&provider;
  if(!popup&&!content)return false;
  if(pending>=16){respond({error:'Email operation busy.'});return false;}pending++;
  const task=chain.then(async()=>{
   if(message.kind==='email_status'){
    const selected=popup?message.provider:provider;if(!emailOrigins[selected])throw new Error();return status(selected);
   }
   if(content){
    if(message.kind==='email_feedback'){
     if(Object.keys(message).some(k=>!['kind','tier'].includes(k))||!['Suspicious','Likely Scam'].includes(message.tier)||!await status(provider).then(s=>s.enabled))throw new Error();
     await api.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
     const raw=(await api.storage.local.get('emailWrongFlagCount')).emailWrongFlagCount;
     await api.storage.local.set({emailWrongFlagCount:Math.min(10000,(Number.isInteger(raw)&&raw>=0?raw:0)+1)});return {recorded:true};
    }
    if(message.kind!=='email_context'||!await status(provider).then(s=>s.enabled))throw new Error();
    if(Object.keys(message).some(k=>!['kind','address'].includes(k)))throw new Error();
    return store.context(message.address);
   }
   if(message.kind==='email_toggle'&&emailOrigins[message.provider]&&typeof message.enabled==='boolean')return toggle(message.provider,message.enabled);
   if(message.kind==='email_senders')return store.list();
   if(message.kind==='email_trust')return store.trust(message.address);
   if(message.kind==='email_untrust')return store.untrust(message.address);
   if(message.kind==='email_clear')return store.clear();
   throw new Error();
  });
  chain=task.catch(()=>{});task.then(respond).catch(()=>respond({error:'Email operation unavailable.'})).finally(()=>pending--);return true;
 });
}
