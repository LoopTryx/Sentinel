const KEY='sentinelDemoConnection';
const actions=new Set(['state','unlock','lock','reveal','rotate','event']);
export async function demoRequest(message,sender) {
 const page=sender.url?.split(/[?#]/)[0];
 if(sender.id!==chrome.runtime.id || ![chrome.runtime.getURL('popup.html'),chrome.runtime.getURL('xray.html')].includes(page))throw new Error('forbidden');
 if(page===chrome.runtime.getURL('xray.html')&&message.method!=='event')throw new Error('forbidden');
 if(!actions.has(message.method))throw new Error('unsupported');
 const data=message.data??{};
 if(JSON.stringify(data).length>4096)throw new Error('invalid_request');
 const config=(await chrome.storage.session.get(KEY))[KEY];
 if(!config||!Number.isInteger(config.port)||config.port<1024||config.port>65535||!/^[a-f0-9]{64}$/.test(config.token))throw new Error('Desktop disconnected. Pair in Connection & test controls.');
 const url=`http://127.0.0.1:${config.port}/${message.method}`;
 const response=await fetch(url,{method:'POST',redirect:'error',signal:AbortSignal.timeout(5000),headers:{Authorization:'Bearer '+config.token,'X-Sentinel-Extension':chrome.runtime.id,'Content-Type':'application/json'},body:JSON.stringify(data)});
 const reader=response.body.getReader();const chunks=[];let length=0;
 try{while(true){const part=await reader.read();if(part.done)break;length+=part.value.length;if(length>131072)throw new Error('response_too_large');chunks.push(part.value);}}finally{await reader.cancel();}
 const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 const result=JSON.parse(new TextDecoder().decode(bytes));
 if(!response.ok||result.error)throw new Error(result.error||'runtime_unavailable');
 return result;
}
