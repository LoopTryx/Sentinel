import {lookup} from 'node:dns/promises';import {connect,checkServerIdentity} from 'node:tls';
import {normalizeDomain} from './watchtower-domain.mjs';
const feed='https://raw.githubusercontent.com/openphish/public_feed/refs/heads/main/feed.txt';
export function publicIPv4(ip){
 if(typeof ip!=='string'||!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(ip))return false;
 const [a,b,c,d]=ip.split('.').map(Number);if([a,b,c,d].some(n=>n>255))return false;
 return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0||b===2)||a===198&&(b===18||b===19||b===51&&c===100)||a===203&&b===0&&c===113||a===100&&b>=64&&b<=127);
}
async function boundedText(fetcher,url,limit){
 const response=await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(2500)});if(!response.ok)throw Error();
 const reader=response.body.getReader(),chunks=[];let size=0;try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>limit)throw Error();chunks.push(Buffer.from(part.value));}}finally{await reader.cancel();}return Buffer.concat(chunks).toString('utf8');
}
export async function certificateEvidence(domain,{resolve=lookup,dial=connect,now=Date.now()}={}){
 const addresses=await Promise.race([resolve(domain,{all:true,family:4}),new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error()),2000);timer.unref?.();})]);
 if(!Array.isArray(addresses)||!addresses.length||addresses.some(row=>!publicIPv4(row.address)))return {status:'refused_private_destination'};
 return new Promise(resolve=>{
  let socket,done=false;const finish=value=>{if(done)return;done=true;clearTimeout(timer);socket?.destroy();resolve(value);};const timer=setTimeout(()=>finish({status:'unavailable'}),2500);
  // Diagnostic handshake only. No HTTP request or application bytes are sent.
  // Authentication failure is evidence, never permission to use the connection.
  try{socket=dial({host:addresses[0].address,port:443,servername:domain,rejectUnauthorized:false},()=>{
   try{const cert=socket.getPeerCertificate(),codes=[];if(!cert?.raw){finish({status:'unavailable'});return;}
    const from=Date.parse(cert.valid_from),to=Date.parse(cert.valid_to);if(!Number.isFinite(from)||!Number.isFinite(to)){finish({status:'unavailable'});return;}
    if(to<now)codes.push('expiredCertificate');if(from>now)codes.push('futureCertificate');if(checkServerIdentity(domain,cert))codes.push('mismatchedCertificate');
    if(!socket.authorized)codes.push(socket.authorizationError==='DEPTH_ZERO_SELF_SIGNED_CERT'?'selfSignedCertificate':'untrustedCertificate');
    finish({status:'checked',codes,issuedDays:Math.max(0,Math.floor((now-from)/86400000))});
   }catch{finish({status:'unavailable'});}
  });socket.once('error',()=>finish({status:'unavailable'}));}catch{finish({status:'unavailable'});}
 });
}
export function createExternalChecks(config,{fetcher=fetch,certificate=certificateEvidence,now=()=>Date.now()}={}){
 const cache=new Map();const ttl=Math.max(1,Math.min(10,config.retentionMinutes??10))*60000;const prune=()=>{for(const [domain,value] of cache)if(now()-value.at>=ttl)cache.delete(domain);};let pending=null,feedCache=null,feedAt=0,cycle=0;
 async function check(domain,visited){
  const result={tls:{status:'off'},age:{status:'off'},reputation:{status:'off'}};
  if(!config.enabled)return result;
  if(!normalizeDomain(domain)||/\.(?:local|lan|internal|home|test|invalid|example|onion|arpa)$/.test(domain))return result;
  if(config.reputation)try{
   if(!feedCache||now()-feedAt>3600000){const text=await boundedText(fetcher,feed,2*1024*1024),hosts=new Set();for(const row of text.split('\n').slice(0,50000)){try{const url=new URL(row);const host=normalizeDomain(url.hostname);if(host)hosts.add(host);}catch{}}feedCache=hosts;feedAt=now();}
   result.reputation={status:'checked',listed:feedCache.has(domain)};
  }catch{result.reputation={status:'unavailable'};}
  if(config.rdap){const parts=domain.split('.'),tld=parts.at(-1);result.age={status:'unsupported'};if(['com','net'].includes(tld))try{
   const subject=parts.slice(-2).join('.'),value=JSON.parse(await boundedText(fetcher,`https://rdap.verisign.com/${tld}/v1/domain/${subject}`,65536));
   const event=Array.isArray(value.events)&&value.events.find(row=>row.eventAction==='registration'),registered=Date.parse(event?.eventDate);
   result.age=Number.isFinite(registered)&&registered<=now()?{status:'checked',days:Math.floor((now()-registered)/86400000)}:{status:'unavailable'};
  }catch{result.age={status:'unavailable'};}}
  if(config.tls){result.tls={status:'requires_browser_observation'};if(visited)try{result.tls=await certificate(domain);}catch{result.tls={status:'unavailable'};}}
  return result;
 }
 return {read(domain){prune();const value=cache.get(domain);return value&&now()-value.at<ttl?value.result:null;},
  schedule(domains,visited=[]){prune();
   if(!config.enabled||pending||!domains.length)return;const domain=domains[cycle++%domains.length];
   pending=check(domain,visited.includes(domain)).then(result=>{cache.delete(domain);cache.set(domain,{at:now(),result});while(cache.size>32)cache.delete(cache.keys().next().value);}).finally(()=>{pending=null;});return pending;
  }};
}
