const ID='sentinel-whatsapp';
export const WHATSAPP_PERMISSION={permissions:['scripting'],origins:['https://web.whatsapp.com/*']};
export async function whatsAppStatus(api){
 const optedIn=(await api.storage.local.get('whatsappOptIn')).whatsappOptIn===true;
 if(!optedIn)return {enabled:false};
 const granted=await api.permissions.contains(WHATSAPP_PERMISSION);
 if(!granted)return {enabled:false};
 const scripts=await api.scripting.getRegisteredContentScripts({ids:[ID]});
 return {enabled:scripts.some(s=>s.id===ID)};
}
export async function setWhatsAppWarnings(api,enabled){
 const granted=await api.permissions.contains(WHATSAPP_PERMISSION);
 if(enabled&&!granted)throw new Error('WhatsApp site and scripting permission required.');
 // Persist opt-out before any asynchronous tab cleanup or API that can fail.
 await api.storage.local.set({whatsappOptIn:enabled});
 let scripts=[];
 try{scripts=await api.scripting.getRegisteredContentScripts({ids:[ID]});}catch{if(enabled)throw new Error('WhatsApp scripting unavailable.');}
 if(enabled&&!scripts.length)await api.scripting.registerContentScripts([{id:ID,matches:['https://web.whatsapp.com/*'],js:['src/whatsapp-bootstrap.js'],runAt:'document_idle',allFrames:false}]);
 if(!enabled&&scripts.length)await api.scripting.unregisterContentScripts({ids:[ID]});
 const tabs=await api.tabs.query(enabled?{url:'https://web.whatsapp.com/*'}:{});
 let unavailableTabs=0;
 for(const tab of tabs){
  if(!Number.isInteger(tab.id)||(enabled&&!tab.url?.startsWith('https://web.whatsapp.com/')))continue;
  try{if(enabled)await api.scripting.executeScript({target:{tabId:tab.id},files:['src/whatsapp-bootstrap.js']});else await api.tabs.sendMessage(tab.id,{kind:'whatsapp_stop'});}catch{if(enabled)unavailableTabs++;}
 }
 return {...await whatsAppStatus(api),unavailableTabs};
}
