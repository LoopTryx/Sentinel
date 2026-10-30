import {createHmac,randomBytes} from 'node:crypto';import {publicIPv4} from './watchtower-external.mjs';
export function createTrafficChecks(config,{clock=()=>Date.now()}={}){
 const key=randomBytes(32),flows=new Map(),groups=new Map(),dnsSeen=new Map(),dnsEvents=[];let initialized=false;
 const hash=value=>createHmac('sha256',key).update(value).digest('hex');
 return {assess(connections,domains,dnsAnswers=[]){
  const now=clock(),window=Math.min(config.traffic.windowSeconds*1000,config.retention.minutes*60000),findings=[];for(const map of [flows,dnsSeen])for(const [id,at] of map)if(now-at>config.retention.minutes*60000)map.delete(id);for(const [id,row] of groups)if(now-row.at>window)groups.delete(id);while(dnsEvents.length&&now-dnsEvents[0]>window)dnsEvents.shift();
  const add=(subject,codes,target=null)=>{const reasons=codes.map(code=>({code,...config.traffic.signals[code]})),score=reasons.reduce((n,r)=>n+r.weight,0),categories=new Set(reasons.map(r=>r.category));const tier=categories.size<2?'Safe':score>=config.traffic.likely?'Likely Malicious':score>=config.traffic.suspicious?'Suspicious':'Safe';if(tier!=='Safe')findings.push({reference:hash(subject).slice(0,32),subject,tier,score,reasons,target});};
  for(const domain of domains){const id=hash(domain.domain);if(!dnsSeen.has(id)&&initialized&&!domain.trusted&&domain.reasons.some(row=>row.code==='entropy'))dnsEvents.push(now);dnsSeen.set(id,now);}
  if(dnsEvents.length>=config.traffic.randomDnsBurst)add('Device DNS observations',['randomDnsNames','dnsBurst']);
  const answers=new Set(dnsAnswers);for(const row of connections){
   if(!publicIPv4(row.address))continue;const id=hash([row.pid,row.process,row.processStartedAt,row.address,row.port].join('|')),flow=hash([id,row.localPort,row.createdAt].join('|'));let group=groups.get(id);if(!group){group={at:now,times:[]};groups.set(id,group);}group.at=now;
   if(row.localPort&&row.createdAt&&!flows.has(flow)){if(initialized&&group.times.at(-1)!==now)group.times.push(now);flows.set(flow,now);}group.times=group.times.filter(at=>now-at<=window).slice(-12);
   const codes=[];if(!answers.has(row.address))codes.push('uncachedDestination');if(!config.traffic.usualPorts.includes(row.port))codes.push('unusualPort');
   if(group.times.length>=config.traffic.minimumBeaconConnections){const intervals=group.times.slice(1).map((at,i)=>at-group.times[i]),mean=intervals.reduce((a,b)=>a+b,0)/intervals.length,spread=Math.sqrt(intervals.reduce((n,value)=>n+(value-mean)**2,0)/intervals.length);if(mean>=config.traffic.minimumBeaconSeconds*1000&&spread/mean<=config.traffic.beaconVariation)codes.push('regularConnections');}
   add(`${row.process} (${row.pid??'unknown'}) to ${row.address}:${row.port}`,codes,{address:row.address,port:row.port,pid:row.pid??null});
  }
  initialized=true;while(flows.size>512)flows.delete(flows.keys().next().value);while(groups.size>128)groups.delete(groups.keys().next().value);while(dnsSeen.size>256)dnsSeen.delete(dnsSeen.keys().next().value);while(dnsEvents.length>128)dnsEvents.shift();
  return {findings:findings.slice(0,16),coverage:'sampled_metadata',uploadsAvailable:false,nxdomainAvailable:false,limitations:['30-second established-connection snapshots miss short-lived flows. Repeated sightings of one connection are not treated as beaconing.','Regular reconnections and random-looking DNS bursts can be legitimate telemetry or services; these are heuristic warnings.','Missing DNS-cache association does not prove use of a raw-IP URL. Secure DNS and cache limits can explain it. DNS activity is not attributed to a process.','Per-application upload bytes and NXDOMAIN query rates are unavailable with these collectors; neither is claimed. No encrypted payloads are inspected.']};
 }};
}
