import {emailExtractionLimits as limits} from '../../data/email-extraction-config.js';
import {gmailAdapter} from './providers/gmail.js';
import {outlookAdapter} from './providers/outlook.js';
export function emailProvider(doc){
 const url=new URL(doc.URL);if(url.protocol!=='https:')return null;
 return [gmailAdapter,outlookAdapter].find(adapter=>adapter.hosts.includes(url.hostname))||null;
}

/** Internal adapter seam. Nothing is registered or enabled automatically.
 * onEmail receives transient private data for a future local scorer only.
 * Cache holds only DOM references and SHA-256 digests, never email bodies. */
export function observeOpenedEmails(doc,{onEmail,onStatus=()=>{},adapter=emailProvider(doc),crypto=globalThis.crypto}={}){
 if(typeof onEmail!=='function')throw new Error('A local email consumer is required.');
 if(!adapter){onStatus({state:'unsupported',messages:0});return {refresh:async()=>{},stop(){}};}
 if(!crypto?.subtle)throw new Error('Local fingerprinting unavailable.');
 const win=doc.defaultView,cache=new Map();let stopped=false,running=false,queued=false,timer=null,generation=0;
 const report=(state,messages=0)=>{if(!stopped)onStatus({provider:adapter.id,state,messages});};
 async function refresh(){
  if(stopped)return;if(doc.hidden){report('paused');return;}if(running){queued=true;return;}
  running=true;const revision=generation;let supported=0;
  try{
   const roots=adapter.roots(doc).slice(0,limits.messages),live=new Set(roots);
   for(const node of cache.keys())if(!live.has(node)||!node.isConnected)cache.delete(node);
   if(!roots.length){report('no_supported_open_message');return;}
   for(const root of roots){
    if(stopped||generation!==revision)return;
    const snapshot=adapter.read(root);if(!snapshot){cache.delete(root);continue;}
    supported++;
    const bytes=new TextEncoder().encode(JSON.stringify(snapshot));
    const digest=await crypto.subtle.digest('SHA-256',bytes);
    if(stopped||generation!==revision||!root.isConnected)return;
    const key=Array.from(new Uint8Array(digest),value=>value.toString(16).padStart(2,'0')).join('');
    if(cache.get(root)===key)continue;
    cache.set(root,key);
    try{onEmail(snapshot,root);}catch{cache.delete(root);report('consumer_unavailable');return;}
   }
   report(supported?'partial':'unsupported_open_layout',supported);
  }catch{report('extraction_unavailable');}
  finally{running=false;if(queued&&!stopped){queued=false;schedule();}}
 }
 function schedule(){
  if(stopped||doc.hidden)return;generation++;
  if(running){queued=true;return;}
  if(timer===null)timer=win.setTimeout(()=>{timer=null;void refresh();},limits.debounceMs);
 }
 const observer=new win.MutationObserver(mutations=>{
  const relevant=mutations.length>64||mutations.slice(0,64).some(m=>{
   const target=m.target.nodeType===1?m.target:m.target.parentElement;if(target?.closest('[data-sentinel-email]'))return false;
   const nodes=[...m.addedNodes,...m.removedNodes];return !(nodes.length>0&&nodes.every(n=>n.nodeType===1&&n.hasAttribute?.('data-sentinel-email')));
  });
  if(relevant)schedule();
 });
 observer.observe(doc.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['hidden','aria-hidden','href','email','data-email-address','title','class']});
 doc.addEventListener('visibilitychange',schedule);
 const ready=refresh();
 return {ready,refresh,stop(){stopped=true;generation++;observer.disconnect();if(timer!==null)win.clearTimeout(timer);doc.removeEventListener('visibilitychange',schedule);cache.clear();}};
}
