// Isolated-world bootstrap, restricted by registration to WhatsApp Web.
void (async()=>{
 if(location.origin!=='https://web.whatsapp.com'||window.top!==window)return;
 if(!globalThis.__sentinelWhatsAppListener){
  globalThis.__sentinelWhatsAppListener=(message,sender)=>{
   if(sender.id===chrome.runtime.id&&message?.kind==='whatsapp_stop'){
    globalThis.__sentinelWhatsAppGeneration=(globalThis.__sentinelWhatsAppGeneration||0)+1;
    globalThis.__sentinelWhatsApp?.stop();globalThis.__sentinelWhatsApp=null;
   }
  };
  chrome.runtime.onMessage.addListener(globalThis.__sentinelWhatsAppListener);
 }
 const generation=globalThis.__sentinelWhatsAppGeneration=(globalThis.__sentinelWhatsAppGeneration||0)+1;
 globalThis.__sentinelWhatsApp?.stop();globalThis.__sentinelWhatsApp=null;
 const status=await chrome.runtime.sendMessage({kind:'whatsapp_content_status'});
 if(!status?.enabled)return;
 const {mountWhatsAppWarnings}=await import(chrome.runtime.getURL('src/whatsapp-inline.js'));
 const current=await chrome.runtime.sendMessage({kind:'whatsapp_content_status'});
 if(!current?.enabled||generation!==globalThis.__sentinelWhatsAppGeneration)return;
 globalThis.__sentinelWhatsApp?.stop();
 globalThis.__sentinelWhatsApp=mountWhatsAppWarnings(document);
 const interval=setInterval(async()=>{
  if(generation!==globalThis.__sentinelWhatsAppGeneration){clearInterval(interval);return;}
  try{const state=await chrome.runtime.sendMessage({kind:'whatsapp_content_status'});if(generation===globalThis.__sentinelWhatsAppGeneration&&!state?.enabled)globalThis.__sentinelWhatsAppListener({kind:'whatsapp_stop'},{id:chrome.runtime.id});}
  catch{if(generation===globalThis.__sentinelWhatsAppGeneration)globalThis.__sentinelWhatsAppListener({kind:'whatsapp_stop'},{id:chrome.runtime.id});}
  if(generation!==globalThis.__sentinelWhatsAppGeneration||!globalThis.__sentinelWhatsApp)clearInterval(interval);
 },3000);
})().catch(()=>{/* No message contents or private identifiers in diagnostics. */});
