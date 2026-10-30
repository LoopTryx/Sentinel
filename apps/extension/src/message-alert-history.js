// Only one-way message fingerprints are retained, never message or contact text.
export async function messageFingerprint(source,text){
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(source+'\n'+text));
 return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
}
export async function alertHistory(api,source){
 const key='messageAlerts_'+source,row=(await api.storage.local.get(key))[key];
 return {key,epoch:typeof row?.epoch==='string'?row.epoch:'initial',hashes:Array.isArray(row?.hashes)?row.hashes.filter(h=>/^[a-f0-9]{64}$/.test(h)):[]};
}
let writes=Promise.resolve();
export function rememberAlert(api,source,hash,epoch){
 const task=writes.then(async()=>{const row=await alertHistory(api,source);if(row.epoch!==epoch||row.hashes.includes(hash))return;
 // Fail closed at the storage bound rather than evicting old suppression rules.
 if(row.hashes.length>=20000)throw Error('alert_history_full');
 await api.storage.local.set({[row.key]:{epoch,hashes:[...row.hashes,hash]}});
 });writes=task.catch(()=>{});return task;
}
export async function resetAlerts(api,source){
 await writes;await api.storage.local.set({['messageAlerts_'+source]:{epoch:crypto.randomUUID(),hashes:[]}});
}
