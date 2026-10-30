import {nativeCall} from './native-call.js';
import {messageFingerprint,alertHistory,rememberAlert} from './message-alert-history.js';
import {prepareMessageContext} from './message-candidates.js';
import {autoConnect} from './auto-connect.js';
import {messageExcerpt,messageSources} from './message-ai-data.js';
const references=new Map();let pending=0;
export async function messageAiRequest(message,sender,api=chrome){
 if(sender.id!==api.runtime.id||sender.frameId!==0||!Number.isInteger(sender.tab?.id))throw Error('forbidden');
 const url=new URL(sender.url);const source=url.protocol==='https:'?Object.keys(messageSources).find(key=>new URL(messageSources[key]).hostname===url.hostname||key==='outlook'&&['outlook.office.com','outlook.office365.com'].includes(url.hostname)):null;
 if(!source)throw Error('forbidden');
 const key=source==='whatsapp'?'whatsappOptIn':'emailOptIn_'+source;
 if((await api.storage.local.get(key))[key]!==true||!await api.permissions.contains({permissions:['scripting'],origins:source==='outlook'?['https://outlook.live.com/*','https://outlook.office.com/*','https://outlook.office365.com/*']:[messageSources[source]+'*']}))throw Error('feature_disabled');
 if(!['explain','result','open','notify'].includes(message.action)||!(message.action==='explain'?['action,kind,text','action,history,kind,text'].includes(Object.keys(message).sort().join(',')):Object.keys(message).sort().join(',')==='action,kind,ref'))throw Error('invalid_request');
 const scope=ref=>ref+':'+sender.tab.id+':'+String(sender.documentId??'')+':'+source;
 const now=Date.now();for(const [ref,row]of references)if(row.expiresAt<=now)references.delete(ref);
 if(message.action!=='explain'){const row=references.get(scope(message.ref));if(!row||row.tab!==sender.tab.id||row.document!==sender.documentId||row.source!==source)throw Error('finding_unknown_or_expired');}
 const fingerprint=message.action==='explain'?await messageFingerprint(source,messageExcerpt(message.text)):null;
 const history=message.action==='explain'?await alertHistory(api,source):null;
 const silent=history?.hashes.includes(fingerprint)===true;
 if(pending>=8)throw Error('busy');pending++;
 try{
  const data=message.action==='explain'?{source,...(silent?{silent:true}:{}),text:messageExcerpt(message.text),...(message.history!==undefined?{history:prepareMessageContext(message.history)}:{}),nonce:crypto.randomUUID().replaceAll('-','')}:{ref:message.ref};
  let config=(await api.storage.session.get('sentinelDemoConnection')).sentinelDemoConnection;
  if(!config)config=await autoConnect();
  const route=message.action==='explain'?'ai-message':message.action==='open'?'ai-open':message.action==='notify'?'ai-notify':'ai-result';
  const send=()=>{if(!config||!Number.isInteger(config.port)||config.port<1024||config.port>65535||!/^[a-f0-9]{64}$/.test(config.token))throw Error('connection_unavailable');return fetch(`http://127.0.0.1:${config.port}/${route}`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(5000),headers:{Authorization:'Bearer '+config.token,'X-Sentinel-Extension':api.runtime.id,'Content-Type':'application/json'},body:JSON.stringify(data)});};
  let response;try{response=await send();}catch{config=await autoConnect(true);response=await send();}
  if(response.status===401||response.status===403){const fresh=(await api.storage.session.get('sentinelDemoConnection')).sentinelDemoConnection;config=fresh?.token&&fresh.token!==config.token?fresh:await autoConnect(true);response=await send();}
  const reader=response.body.getReader(),chunks=[];let size=0;try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>32000)throw Error('invalid_response');chunks.push(part.value);}}finally{await reader.cancel();}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}const result=JSON.parse(new TextDecoder().decode(bytes));if(!response.ok||result.error)throw Error(['invalid_message','invalid_handoff','handoff_capacity','replayed_handoff','forbidden'].includes(result.error)?result.error:'desktop_unavailable');
  if(message.action==='explain'){if(!/^[a-f0-9]{32}$/.test(result.finding?.ref))throw Error('invalid_response');if(references.size>=64)references.delete(references.keys().next().value);references.set(scope(result.finding.ref),{tab:sender.tab.id,document:sender.documentId,source,fingerprint,epoch:history.epoch,expiresAt:result.expiresAt});return {ref:result.finding.ref,expiresAt:result.expiresAt};}
  if(message.action==='notify'){const row=references.get(scope(message.ref));await rememberAlert(api,source,row.fingerprint,row.epoch);const opened=await nativeCall('open-ai',api,4000);if(opened?.ok!==true)throw Error('connection_unavailable');return {notified:true};}
  if(message.action==='open'){const opened=await nativeCall('open-ai',api,4000);if(opened?.ok!==true)throw Error('connection_unavailable');return {opened:true};}
  if(source!=='whatsapp'&&result.quick?.verdict==='likely'){const row=references.get(scope(message.ref));await rememberAlert(api,source,row.fingerprint,row.epoch);}
  // Only the on-device answer is sent to the message page.
  if(result.localError)return {error:result.localError,message:'The quick explanation is unavailable. Open Sentinel for more details.'};
  return {quick:result.quick??null};
 }finally{pending--;}
}

export function messageAiError(error){
 const code=String(error?.message??'');
 if(/native messaging host not found|specified native messaging host/i.test(code))return {error:'host_unavailable',message:"Chrome cannot reach Sentinel's desktop connector."};
 const messages={feature_disabled:'Turn on message warnings for this site in Sentinel.',forbidden:'This page could not be verified for message explanations.',invalid_request:'Refresh this page to update Sentinel.',invalid_message:'This message could not be prepared for analysis.',invalid_handoff:'This message could not be prepared for analysis.',handoff_capacity:'Several messages are being checked. Try again shortly.',busy:'Several messages are being checked. Try again shortly.',finding_unknown_or_expired:'Reopen this message to check it again.',connection_unavailable:'The desktop connector could not connect. Open Sentinel and try again.',desktop_unavailable:'Sentinel could not accept the request. Restart Sentinel and refresh this page.'};
 return {error:Object.hasOwn(messages,code)?code:'connection_unavailable',message:messages[code]||'The desktop connection is unavailable. Open Sentinel and try again.'};
}
