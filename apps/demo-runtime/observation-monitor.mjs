export function createObservationMonitor({collect,intervalMs}){
 let stopped=false,pending=null,timer=null,snapshot=null;
 function refresh(){
  if(stopped||pending)return pending;
  pending=Promise.resolve().then(collect).then(value=>{if(!stopped)snapshot=value;},()=>{if(!stopped)snapshot=null;}).finally(()=>{pending=null;if(!stopped){timer=setTimeout(refresh,intervalMs);timer.unref?.();}});
  return pending;
 }
 void refresh();
 return {async read(){if(stopped)throw Error('observation_unavailable');if(!snapshot&&pending)await pending;if(stopped||!snapshot)throw Error('observation_unavailable');return snapshot;},async close(){stopped=true;clearTimeout(timer);if(pending)await pending;snapshot=null;}};
}
