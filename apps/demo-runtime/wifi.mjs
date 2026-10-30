import {observeDestinations} from './watchtower-observe.mjs';
import {execFile} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const fields={connection:['wifi','ethernet','disconnected','unknown'],profile:['public','private','domain','unknown'],security:['open','wep','wpa2','wpa3','unknown'],gateway:['configured','missing','unknown'],dns:['configured','missing','unknown'],vpn:['observed','unknown'],proxy:['configured','not_configured','unknown']};
export function validateObservation(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==7)return null;
 const result={};for(const [key,allowed] of Object.entries(fields)){if(!allowed.includes(value[key]))return null;result[key]=value[key];}return result;
}
export function assessObservation(observation){
 const checks=[];
 if(observation.connection==='disconnected')checks.push({level:'info',title:'No active connection',detail:'Connect to a network, then check again.'});
 if(observation.security==='open')checks.push({level:'warn',title:'Open Wi-Fi',detail:'The wireless link has no encryption. HTTPS still protects properly secured website content. Prefer a trusted network for sensitive work.'});
 if(observation.security==='wep')checks.push({level:'warn',title:'Legacy Wi-Fi encryption',detail:'WEP is obsolete. Use a network configured with WPA2 or WPA3.'});
 if(observation.profile==='public')checks.push({level:'info',title:'Public network profile',detail:'Windows treats this as a public network. Keep discovery and sharing off; this profile alone does not identify a malicious network.'});
 if(observation.gateway==='missing')checks.push({level:'warn',title:'No default gateway observed',detail:'The connection may provide local access only. This is not evidence of an attack.'});
 if(observation.dns==='missing')checks.push({level:'warn',title:'No DNS configuration observed',detail:'Name resolution may be unavailable. Check network configuration before using this connection.'});
 return {version:1,observedAt:new Date().toISOString(),observation,checks,coverage:'passive',limitations:['Captive portals and evil twins are not verified.','VPN protection is not established by adapter visibility.','No approved baseline or active traffic inspection is configured.']};
}
let busy=false;
export async function observeWifi(){
 if(process.platform!=='win32')throw new Error('wifi_unsupported');
 if(busy)throw new Error('wifi_busy');busy=true;
 try{
  const destinations=observeDestinations().catch(()=>({version:1,unavailable:true,domains:[],connections:[],dnsStatus:'unavailable',connectionStatus:'unavailable',capabilities:{blocking:false,tls:false,reputation:false,domainAge:false,browserUrls:false},limitations:['Local destination metadata is unavailable. No safety conclusion can be drawn.']}));
  const executable=join(process.env.SystemRoot??'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
  const output=await new Promise((resolve,reject)=>execFile(executable,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',fileURLToPath(new URL('./wifi-observe.ps1',import.meta.url))],{windowsHide:true,timeout:8000,maxBuffer:8192},(error,stdout)=>error?reject(new Error('wifi_unavailable')):resolve(stdout)));
  let value;try{value=JSON.parse(String(output).replace(/^\uFEFF/,''));}catch{throw new Error('wifi_unavailable');}
  const observation=validateObservation(value);if(!observation)throw new Error('wifi_unavailable');return {...assessObservation(observation),destinations:await destinations};
 }finally{busy=false;}
}
