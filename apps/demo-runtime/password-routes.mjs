import {credentialOrigin} from './password-vault.mjs';
export async function passwordRoute(vault,action,data){
 const shape=names=>data&&typeof data==='object'&&!Array.isArray(data)&&Object.keys(data).sort().join(',')===names.sort().join(',');
 if(action==='matches'&&shape(['origin','user','password']))return vault.matches(credentialOrigin(data.origin),data.user,data.password);
 if(action==='status'&&shape([]))return vault.status();
 if(action==='unlock'&&shape(['passphrase']))return vault.unlock(data.passphrase);
 if(action==='rekey'&&shape(['passphrase']))return vault.rekey(data.passphrase);
 if(action==='list'&&shape([]))return {accounts:vault.list()};
 if(action==='remove'&&shape(['id']))return vault.remove(data.id);
 if(action==='edit'&&shape(['id','patch'])&&data.patch&&typeof data.patch==='object'&&!Array.isArray(data.patch)&&Object.keys(data.patch).every(key=>['name','origin','user','password'].includes(key)))return vault.edit(data.id,data.patch);
 if(action==='lock'&&shape([])){vault.lock();return {ok:true};}
 if(action==='list'&&shape(['origin']))return {accounts:vault.list(credentialOrigin(data.origin))};
 if(action==='save'&&shape(['origin','user','password','name']))return vault.save(data);
 if(action==='fill'&&shape(['id','origin']))return vault.fill(data.id,credentialOrigin(data.origin));
 throw Error('invalid_vault_request');
}
