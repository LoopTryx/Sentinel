export async function autoConnect(){
 const config=await chrome.runtime.sendNativeMessage('com.looptryx.sentinel',{operation:'connect'});
 if(!config||config.extensionId!==chrome.runtime.id||!Number.isInteger(config.port)||config.port<1024||config.port>65535||!/^[a-f0-9]{64}$/.test(config.token))throw Error('connection_unavailable');
 await chrome.storage.session.set({sentinelDemoConnection:{port:config.port,token:config.token}});
 return config;
}
