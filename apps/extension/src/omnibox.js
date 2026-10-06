import {explainUrl} from './local-checks.js';
// Only a deliberate Sentinel keyword session reaches this entry point.
export function installOmnibox(api) {
 const suggestion=()=>api.omnibox.setDefaultSuggestion({description:'Link X-Ray: inspect an HTTP/HTTPS address locally before opening it'});
 api.omnibox.onInputStarted.addListener(suggestion);
 api.omnibox.onInputChanged.addListener(()=>suggestion());
 let chain=Promise.resolve();
 async function enter(text, disposition) {
  let fragment='invalid';
  try {
   const url=text.trim();const result=explainUrl(url);
   if(result.reasons.some(r=>r.code==='credentials'))throw new Error('credentials');
   const all=await api.storage.session.get(null);const now=Date.now();
   const items=Object.entries(all).filter(([k])=>k.startsWith('sentinelXray:')).sort((a,b)=>a[1].expires-b[1].expires);
   const expired=items.filter(([,v])=>!Number.isFinite(v?.expires)||v.expires<=now).map(([k])=>k);
   const live=items.filter(([k])=>!expired.includes(k));
   const prune=[...expired,...live.slice(0,Math.max(0,live.length-15)).map(([k])=>k)];
   if(prune.length)await api.storage.session.remove(prune);
   fragment=crypto.randomUUID();await api.storage.session.set({['sentinelXray:'+fragment]:{url,expires:now+600000}});
  }catch{fragment='invalid';}
  const url=api.runtime.getURL('xray.html')+'#'+fragment;
  if(disposition==='currentTab'){
   const [tab]=await api.tabs.query({active:true,currentWindow:true});
   if(Number.isInteger(tab?.id)){await api.tabs.update(tab.id,{url});return;}
  }
  await api.tabs.create({url,active:disposition!=='newBackgroundTab'});
 }
 api.omnibox.onInputEntered.addListener((text,disposition)=>{
  const run=chain.then(()=>enter(text,disposition));chain=run.catch(()=>{});return run;
 });
}
