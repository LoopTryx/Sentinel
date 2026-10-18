// Explicit opt-in, paired localhost only, hostnames only; never page paths/content.
const KEY='watchtowerShareHostnames';
export async function shareWatchtowerHostname(api,url,tab,fetcher=fetch){
 if(tab?.incognito||typeof url!=='string'||url.length>4096)return;
 const enabled=(await api.storage.local.get(KEY))[KEY];if(enabled!==true)return;
 const config=(await api.storage.session.get('sentinelDemoConnection')).sentinelDemoConnection;
 if(!config||!Number.isInteger(config.port)||config.port<1024||config.port>65535||!/^[a-f0-9]{64}$/.test(config.token??''))return;
 let parsed;try{parsed=new URL(url);}catch{return;}if(!['http:','https:'].includes(parsed.protocol))return;
 await fetcher(`http://127.0.0.1:${config.port}/watchtower-domain`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(2000),headers:{Authorization:'Bearer '+config.token,'X-Sentinel-Extension':api.runtime.id,'Content-Type':'application/json'},body:JSON.stringify({host:parsed.hostname})});
}
export function installWatchtowerSharing(api){
 let last=0;
 api.tabs?.onUpdated?.addListener((_id,change,tab)=>{if(!change.url||Date.now()-last<1000)return;last=Date.now();void shareWatchtowerHostname(api,change.url,tab).catch(()=>{});});
}

export async function forgetWatchtowerHostnames(api,fetcher=fetch){
 const config=(await api.storage.session.get('sentinelDemoConnection')).sentinelDemoConnection;
 if(!config||!Number.isInteger(config.port)||config.port<1024||config.port>65535||!/^[a-f0-9]{64}$/.test(config.token??''))return;
 await fetcher(`http://127.0.0.1:${config.port}/watchtower-domain`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(2000),headers:{Authorization:'Bearer '+config.token,'X-Sentinel-Extension':api.runtime.id,'Content-Type':'application/json'},body:'{"host":null}'});
}
