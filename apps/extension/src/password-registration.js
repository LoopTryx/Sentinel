// Restore enabled website tools after an extension update without requesting new access.
export async function restorePasswordTools(api){
 if((await api.storage.local.get('passwordCompanion')).passwordCompanion!==true)return;
 if(!await api.permissions.contains({origins:['https://*/*']}))return;
 const spec={id:'sentinel-passwords',matches:['https://*/*'],js:['src/password-content.js'],runAt:'document_idle',allFrames:false};
 const registered=await api.scripting.getRegisteredContentScripts({ids:[spec.id]});
 if(registered.length)await api.scripting.updateContentScripts([spec]);else await api.scripting.registerContentScripts([spec]);
 const tabs=await api.tabs.query({url:['https://*/*']});
 await Promise.allSettled(tabs.filter(t=>Number.isInteger(t.id)).map(t=>api.scripting.executeScript({target:{tabId:t.id,frameIds:[0]},world:'ISOLATED',files:['src/password-content.js']})));
}
