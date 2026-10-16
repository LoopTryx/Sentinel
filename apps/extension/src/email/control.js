import {canonicalSender,createSenderStore} from './sender-store.js';
export const emailOrigins={gmail:['https://mail.google.com/*'],outlook:['https://outlook.live.com/*','https://outlook.office.com/*','https://outlook.office365.com/*']};
export function installEmailControl(api){
 const store=createSenderStore(api);let chain=Promise.resolve(),pending=0;const readers=new Map(),observed=new Map();
 const readerStates=['partial','unsupported_open_layout','no_supported_open_message','paused','extraction_unavailable','consumer_unavailable'];
 const status=async provider=>{const enabled=(await api.storage.local.get(`emailOptIn_${provider}`))[`emailOptIn_${provider}`]===true&&await api.permissions.contains({permissions:['scripting'],origins:emailOrigins[provider]});for(const [id,row]of readers)if(Date.now()-row.at>15000)readers.delete(id);const latest=[...readers.values()].filter(row=>row.provider===provider).sort((a,b)=>b.at-a.at)[0];return {enabled,...(latest&&enabled?{reader:latest.state,messages:latest.messages}:{})};};
 async function toggle(provider,enabled){
  if(!enabled)for(const [id,row]of observed)if(row.provider===provider)observed.delete(id);
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
    if(message.kind==='email_trust_current'){
     if(Object.keys(message).length!==2||!Object.hasOwn(message,'address')||!await status(provider).then(s=>s.enabled))throw new Error();
     const address=canonicalSender(message.address),row=observed.get(sender.tab.id);
     if(!row||row.provider!==provider||row.documentId!==sender.documentId||Date.now()-row.at>600000||!row.addresses.includes(address))throw new Error();
     return store.trust(address);
    }
    if(message.kind==='email_open_settings'){
     if(Object.keys(message).length!==1||!await status(provider).then(s=>s.enabled))throw new Error();
     await api.tabs.create({url:api.runtime.getURL('popup.html?view=settings#email-trust-form')});return {opened:true};
    }
    if(message.kind==='email_reader_status'){
     if(Object.keys(message).some(k=>!['kind','state','messages'].includes(k))||!readerStates.includes(message.state)||!Number.isInteger(message.messages)||message.messages<0||message.messages>8||!await status(provider).then(s=>s.enabled))throw new Error();
     if(readers.size>=32&&!readers.has(sender.tab.id))readers.delete(readers.keys().next().value);
     readers.set(sender.tab.id,{provider,state:message.state,messages:message.messages,at:Date.now()});return {recorded:true};
    }
    if(message.kind==='email_feedback'){
     if(Object.keys(message).some(k=>!['kind','tier'].includes(k))||!['Suspicious','Likely Scam'].includes(message.tier)||!await status(provider).then(s=>s.enabled))throw new Error();
     await api.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
     const raw=(await api.storage.local.get('emailWrongFlagCount')).emailWrongFlagCount;
     await api.storage.local.set({emailWrongFlagCount:Math.min(10000,(Number.isInteger(raw)&&raw>=0?raw:0)+1)});return {recorded:true};
    }
    if(message.kind!=='email_context'||!await status(provider).then(s=>s.enabled))throw new Error();
    if(Object.keys(message).some(k=>!['kind','address'].includes(k)))throw new Error();
    const address=canonicalSender(message.address),context=await store.context(address);
    for(const [id,row]of observed)if(Date.now()-row.at>600000)observed.delete(id);
    if(observed.size>=32&&!observed.has(sender.tab.id))observed.delete(observed.keys().next().value);
    const prior=observed.get(sender.tab.id),addresses=prior?.provider===provider&&prior.documentId===sender.documentId?prior.addresses.filter(value=>value!==address):[];
    observed.set(sender.tab.id,{provider,documentId:sender.documentId,addresses:[...addresses,address].slice(-8),at:Date.now()});
    return context;
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
