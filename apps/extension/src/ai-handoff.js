const KEY='sentinelAiPending';
export function handoffInput(url,question){
 if(typeof url!=='string'||url.length>2048||typeof question!=='string'||!question.trim()||question.length>1000)throw Error('Invalid question or URL.');
 const safe=new URL(url);if(!['http:','https:'].includes(safe.protocol))throw Error('Unsupported URL.');safe.username='';safe.password='';safe.search='';safe.hash='';
 return {url:safe.href,question:question.trim(),nonce:Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('')};
}
export async function sendAiHandoff(input,api=chrome){
 const record={input,expiresAt:Date.now()+300000};await api.storage.session.set({[KEY]:record});
 const result=await api.runtime.sendMessage({kind:'demo_call',method:'ai-handoff',data:input});
 if(result?.error||!result?.data?.handoffId)throw Error('Desktop unavailable. Open Sentinel and retry within five minutes.');
 await api.storage.session.remove(KEY);return result.data;
}
export async function pendingAiHandoff(api=chrome){const item=(await api.storage.session.get(KEY))[KEY];if(!item||item.expiresAt<=Date.now()){await api.storage.session.remove(KEY);return null;}return item.input;}
