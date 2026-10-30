// One bounded, cancellable native request. Never return or log connection secrets here.
export function nativeCall(operation,api=chrome,timeout=9000){
 return new Promise((resolve,reject)=>{let port,timer,finished=false;const finish=(error,value)=>{if(finished)return;finished=true;clearTimeout(timer);if(port){port.onMessage.removeListener(onMessage);port.onDisconnect.removeListener(onDisconnect);try{port.disconnect();}catch{}}error?reject(error):resolve(value);};const onMessage=value=>finish(null,value);const onDisconnect=()=>{const detail=api.runtime.lastError?.message;finish(Error(/host.*not found|specified native messaging host/i.test(detail||'')?'host_unavailable':'connection_unavailable'));};timer=setTimeout(()=>finish(Error('connection_timed_out')),timeout);
 try{if(typeof api.runtime.connectNative==='function'){port=api.runtime.connectNative('com.looptryx.sentinel');port.onMessage.addListener(onMessage);port.onDisconnect.addListener(onDisconnect);port.postMessage({operation});}else Promise.resolve(api.runtime.sendNativeMessage('com.looptryx.sentinel',{operation})).then(value=>finish(null,value),error=>finish(error));}catch(error){finish(error);}
 });
}
