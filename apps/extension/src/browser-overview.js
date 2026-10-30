import {autoConnect} from './auto-connect.js';
import {nativeCall} from './native-call.js';
let pending=null,cached=null,at=0,metricsPending=null,metricsAt=0;
const fields=['cpuPercent','memoryTotal','memoryAvailable','storageTotal','storageFree','chromeMemory','chromeProcesses'];
let metrics=Object.fromEntries(fields.map(key=>[key,null]));
function collect(api){if(metricsPending||Date.now()-metricsAt<4000)return;metricsPending=nativeCall('overview',api,2500).then(value=>{if(value?.error)throw Error('metrics_unavailable');const next={};for(const key of fields)next[key]=typeof value?.[key]==='number'&&Number.isFinite(value[key])&&value[key]>=0?value[key]:null;metrics=next;}).catch(()=>{metrics=Object.fromEntries(fields.map(key=>[key,null]));}).finally(()=>{metricsAt=Date.now();metricsPending=null;if(cached)cached={...cached,metrics,metricsPending:false,at:Date.now()};});}
export async function browserOverview(message,sender,api=chrome){
 if(sender.id!==api.runtime.id||sender.url?.split(/[?#]/)[0]!==api.runtime.getURL('popup.html')||Object.keys(message).join(',')!=='kind')throw Error('forbidden');
 collect(api);if(cached&&Date.now()-at<4000)return {...cached,metrics,metricsPending:!!metricsPending};if(pending)return pending;
 pending=(async()=>{let connected=false;try{let c=await autoConnect();const probe=async()=>{const r=await fetch(`http://127.0.0.1:${c.port}/state`,{method:'POST',headers:{Authorization:'Bearer '+c.token,'X-Sentinel-Extension':api.runtime.id,'Content-Type':'application/json'},body:'{}',redirect:'error',signal:AbortSignal.timeout(2000)});await r.body?.cancel();if(!r.ok)throw Error('disconnected');};try{await probe();}catch{c=await autoConnect(true);await probe();}connected=true;}catch{}cached={connected,metrics,metricsPending:!!metricsPending,at:Date.now(),tabMemoryAvailable:false};at=Date.now();return cached;})();try{return await pending;}finally{pending=null;}
}
