// Explicit toolbar gesture only. No tab creation or URL navigation.
const http=url=>{try{return ['http:','https:'].includes(new URL(url).protocol);}catch{return false;}};
export function installFloatingControl(api){
 const injecting=new Set();
 api.action?.onClicked?.addListener(tab=>{
  const id=tab?.id;
  if(!Number.isInteger(id)||id<0||!http(tab.url)||injecting.has(id)||injecting.size>=4)return;
  injecting.add(id);
  const target={tabId:id,frameIds:[0]};
  void Promise.resolve().then(async()=>{
   await api.scripting.removeCSS({target,files:['src/ui-overlay.css']});
   await api.scripting.insertCSS({target,files:['src/ui-overlay.css']});
   await api.scripting.executeScript({target,world:'ISOLATED',files:['src/ui-overlay.js']});
   await api.action.setBadgeText?.({tabId:id,text:''});
  }).catch(()=>{
   // Chrome forbids injection on internal pages and some protected documents.
   // A badge reports failure without changing the user's page or opening tabs.
   return api.action.setBadgeText?.({tabId:id,text:'!'});
  }).catch(()=>{}).finally(()=>injecting.delete(id));
 });
}
