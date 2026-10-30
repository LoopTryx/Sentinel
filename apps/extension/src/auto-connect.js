import {nativeCall} from './native-call.js';
let connecting=null;
export async function autoConnect(force=false){
 if(!force){const value=(await chrome.storage.session.get('sentinelDemoConnection')).sentinelDemoConnection;if(value&&value.extensionId===chrome.runtime.id&&Number.isInteger(value.port)&&value.port>=1024&&value.port<=65535&&/^[a-f0-9]{64}$/.test(value.token))return value;}
 if(connecting)return connecting;
 connecting=connect();try{return await connecting;}finally{connecting=null;}
}
async function connect(){
 const config=await nativeCall('connect');
 if(!config||config.extensionId!==chrome.runtime.id||!Number.isInteger(config.port)||config.port<1024||config.port>65535||!/^[a-f0-9]{64}$/.test(config.token))throw Error('connection_unavailable');
 await chrome.storage.session.set({sentinelDemoConnection:{extensionId:config.extensionId,port:config.port,token:config.token}});
 return config;
}
