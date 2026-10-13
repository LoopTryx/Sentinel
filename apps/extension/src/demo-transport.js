const KEY='sentinelDemoConnection';
import {autoConnect} from './auto-connect.js';
const actions=new Set(['state','unlock','lock','event','vault.copy','vault.rotate']);
export async function demoRequest(message,sender) {
 const page=sender.url?.split(/[?#]/)[0];
 if(sender.id!==chrome.runtime.id || ![chrome.runtime.getURL('popup.html'),chrome.runtime.getURL('xray.html')].includes(page))throw new Error('forbidden');
 if(page===chrome.runtime.getURL('xray.html')&&message.method!=='event')throw new Error('forbidden');
 if(!actions.has(message.method))throw new Error('unsupported');
 const data=message.data??{};
 if(JSON.stringify(data).length>4096)throw new Error('invalid_request');
 if(message.method.startsWith('vault.')){
  if(Object.keys(data).length!==1||!/^[a-zA-Z0-9_-]{1,64}$/.test(data.id??''))throw new Error('invalid_request');
  const result=await chrome.runtime.sendNativeMessage('com.looptryx.sentinel',{operation:message.method==='vault.copy'?'copy':'rotate',id:data.id});
  if(result?.ok!==true)throw new Error(result?.error||'Windows approval unavailable.');
  return {ok:true};
 }
 let config=(await chrome.storage.session.get(KEY))[KEY];
 if(!config&&page===chrome.runtime.getURL('popup.html'))config=await autoConnect();
 if(!config||!Number.isInteger(config.port)||config.port<1024||config.port>65535||!/^[a-f0-9]{64}$/.test(config.token))throw new Error('Desktop disconnected. Pair in Connection & test controls.');
 const url=`http://127.0.0.1:${config.port}/${message.method}`;
 let response;
 try{response=await fetch(url,{method:'POST',redirect:'error',signal:AbortSignal.timeout(5000),headers:{Authorization:'Bearer '+config.token,'X-Sentinel-Extension':chrome.runtime.id,'Content-Type':'application/json'},body:JSON.stringify(data)});}catch(error){
  if(message.method!=='state'||page!==chrome.runtime.getURL('popup.html'))throw error;
  const fresh=await autoConnect();response=await fetch(`http://127.0.0.1:${fresh.port}/state`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(5000),headers:{Authorization:'Bearer '+fresh.token,'X-Sentinel-Extension':chrome.runtime.id,'Content-Type':'application/json'},body:'{}'});
 }
 if([401,403].includes(response.status)&&message.method==='state'&&page===chrome.runtime.getURL('popup.html')){const fresh=await autoConnect();response=await fetch(`http://127.0.0.1:${fresh.port}/state`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(5000),headers:{Authorization:'Bearer '+fresh.token,'X-Sentinel-Extension':chrome.runtime.id,'Content-Type':'application/json'},body:'{}'});}
 const reader=response.body.getReader();const chunks=[];let length=0;
 try{while(true){const part=await reader.read();if(part.done)break;length+=part.value.length;if(length>131072)throw new Error('response_too_large');chunks.push(part.value);}}finally{await reader.cancel();}
 const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 const result=JSON.parse(new TextDecoder().decode(bytes));
 if(!response.ok||result.error)throw new Error(result.error||'runtime_unavailable');
 return result;
}
