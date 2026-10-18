// Explicit opt-in, paired localhost only, hostnames only; never page paths/content.
const KEY='watchtowerShareHostnames';
export async function shareWatchtowerHostname(api,url,tab,fetcher=fetch,codes=[]){
 if(tab?.incognito||typeof url!=='string'||url.length>4096)return;
 const enabled=(await api.storage.local.get(KEY))[KEY];if(enabled!==true)return;
 const config=(await api.storage.session.get('sentinelDemoConnection')).sentinelDemoConnection;
 if(!config||!Number.isInteger(config.port)||config.port<1024||config.port>65535||!/^[a-f0-9]{64}$/.test(config.token??''))return;
 let parsed;try{parsed=new URL(url);}catch{return;}if(!['http:','https:'].includes(parsed.protocol))return;
 await fetcher(`http://127.0.0.1:${config.port}/watchtower-domain`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(2000),headers:{Authorization:'Bearer '+config.token,'X-Sentinel-Extension':api.runtime.id,'Content-Type':'application/json'},body:JSON.stringify({host:parsed.hostname,...(codes.length?{codes:codes.filter(code=>['portal_credentials','portal_payment'].includes(code)).slice(0,2)}:{})})});
}
export function installWatchtowerSharing(api){
 let lastUrl=0,lastFields=0;
 api.tabs?.onUpdated?.addListener((id,change,tab)=>{
  if(tab?.incognito||(!change.url&&change.status!=='complete'))return;const now=Date.now();if(change.status==='complete'){if(now-lastFields<1000)return;lastFields=now;}else{if(now-lastUrl<1000)return;lastUrl=now;}
  void (async()=>{const url=change.url??tab.url;if(!url)return;
   const allowed=(await api.storage.local.get(KEY))[KEY]===true;if(!allowed)return;
   let codes=[];
   if(change.status==='complete'&&api.scripting?.executeScript)try{
    const results=await api.scripting.executeScript({target:{tabId:id,allFrames:false},func:()=>{
     const signals=[];if(document.querySelector('input[type="password"]'))signals.push('portal_credentials');
     if(document.querySelector('input[autocomplete="cc-number"]'))signals.push('portal_payment');return signals;
    }});if(Array.isArray(results?.[0]?.result))codes=results[0].result;
   }catch{}
   await shareWatchtowerHostname(api,url,tab,fetch,codes);
  })().catch(()=>{});
 });
}

export async function forgetWatchtowerHostnames(api,fetcher=fetch){
 const config=(await api.storage.session.get('sentinelDemoConnection')).sentinelDemoConnection;
 if(!config||!Number.isInteger(config.port)||config.port<1024||config.port>65535||!/^[a-f0-9]{64}$/.test(config.token??''))return;
 await fetcher(`http://127.0.0.1:${config.port}/watchtower-domain`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(2000),headers:{Authorization:'Bearer '+config.token,'X-Sentinel-Extension':api.runtime.id,'Content-Type':'application/json'},body:'{"host":null}'});
}
