import {createHmac,randomBytes} from 'node:crypto';import {isIP} from 'node:net';
const rank={unknown:-1,open:0,wep:1,wpa2:2,wpa3:3},mac=value=>typeof value==='string'&&/^(?:[0-9a-f]{2}:){5}[0-9a-f]{2}$/.test(value)&&value!=='00:00:00:00:00:00'&&value!=='ff:ff:ff:ff:ff:ff';
const text=value=>typeof value==='string'&&value.length<=128&&!/[\x00-\x1f\x7f]/.test(value);
export function createTopologyChecks(config,{clock=()=>Date.now()}={}){
 const key=randomBytes(32),networks=new Map(),routes=new Map();let system=null;
 const hash=value=>createHmac('sha256',key).update(value).digest('hex');
 return {assess(raw,{portalSignals=[]}={}){
  if(!raw||raw.version!==1||!['available','unavailable'].includes(raw.wifiStatus)||!Array.isArray(raw.networks)||raw.networks.length>32||!Array.isArray(raw.neighbors)||raw.neighbors.length>64||!Array.isArray(raw.dns)||raw.dns.length>16||!text(raw.connectedSsid))return {available:false,tier:'Unavailable',reasons:[],limitations:['Topology observations unavailable.']};
  const now=clock(),ttl=config.retention.minutes*60000;for(const map of [networks,routes])for(const [id,value] of map)if(now-value.at>ttl)map.delete(id);
  const reasons=[],add=code=>{if(!reasons.some(item=>item.code===code))reasons.push({code,...config.topology.signals[code]});};
  if(raw.internet==='limited'&&raw.connectedSsid&&portalSignals.length){if(portalSignals.includes('portal_credentials'))add('portalCredentials');if(portalSignals.includes('portal_payment'))add('portalPayment');add('limitedPortal');}
  const nearby=raw.networks.filter(row=>row&&text(row.ssid)&&mac(row.bssid)&&Object.hasOwn(rank,row.security)&&Number.isInteger(row.signal)&&row.signal>=0&&row.signal<=100&&Number.isInteger(row.channel)&&row.channel>=0&&row.channel<=233);
  const names=new Set(nearby.map(row=>row.ssid));for(const name of names){
   const group=nearby.filter(row=>row.ssid===name),id=hash(name),known=networks.get(id);
   if(known&&known.samples>=config.topology.minimumObservations){
    if(group.some(row=>!known.bssids.has(hash(row.bssid))))add('newBssid');if(group.some(row=>!known.channels.has(row.channel)))add('channelChanged');
    if(group.some(row=>rank[row.security]>=0&&rank[row.security]<known.security))add('weakerSecurity');
    if(known.security>=2&&group.some(row=>row.security==='open'))add('openKnownName');
   }
   if(group.length>1&&Math.max(...group.map(row=>row.signal))-Math.min(...group.map(row=>row.signal))>=config.topology.signalDifference)add('signalDifference');
   if(!known){const strength=Math.max(...group.map(row=>rank[row.security]));networks.set(id,{at:now,samples:1,security:strength,channels:new Set(group.map(row=>row.channel)),bssids:new Set(group.filter(row=>rank[row.security]===strength).map(row=>hash(row.bssid)))});}else{known.samples++;known.at=now;}
  }
  const routeId=hash(raw.connectedSsid+'|'+raw.interfaceIndex+'|'+raw.gatewayIp),old=routes.get(routeId),dns=raw.dns.filter(ip=>isIP(ip)).sort().join('|');
  if(old){if(mac(raw.gatewayMac)&&old.mac&&hash(raw.gatewayMac)!==old.mac)add('gatewayMacChanged');if(dns&&old.dns&&hash(dns)!==old.dns)add('dnsChanged');}
  if(isIP(raw.gatewayIp))routes.set(routeId,{at:now,mac:old?.mac||(mac(raw.gatewayMac)?hash(raw.gatewayMac):''),dns:old?.dns||(dns?hash(dns):'')});
  const byMac=new Map();for(const row of raw.neighbors)if(row&&isIP(row.ip)&&mac(row.mac)){const set=byMac.get(row.mac)??new Set();set.add(row.ip);byMac.set(row.mac,set);}if([...byMac.values()].some(set=>set.size>1))add('duplicateMac');
  const validHash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);if(system&&now-system.at<=ttl){if(validHash(raw.hostsHash)&&system.hosts&&raw.hostsHash!==system.hosts)add('hostsChanged');if(validHash(raw.proxyHash)&&system.proxy&&raw.proxyHash!==system.proxy)add('proxyChanged');}
  if(!system||now-system.at>ttl)system={at:now,hosts:validHash(raw.hostsHash)?raw.hostsHash:'',proxy:validHash(raw.proxyHash)?raw.proxyHash:''};
  while(networks.size>64)networks.delete(networks.keys().next().value);while(routes.size>32)routes.delete(routes.keys().next().value);
  const score=reasons.reduce((total,row)=>total+row.weight,0),groups=new Set(reasons.map(row=>row.category));const tier=groups.size<2?'Safe':score>=config.topology.likely?'Likely Malicious':score>=config.topology.suspicious?'Suspicious':'Safe';
  return {available:true,wifiStatus:raw.wifiStatus,tier,score,reasons,nearbyCount:nearby.length,baseline:'session_first_observation',internet:['internet','limited'].includes(raw.internet)?raw.internet:'unknown',limitations:['Session baselines are observations, not approved trusted networks. They reset on restart and expire.','New access points, roaming, DHCP, VPNs, bridges and legitimate edits can cause these changes. These signs do not prove an evil twin or ARP attack.','Wi-Fi parsing currently supports recognized English netsh fields. Permission/location restrictions may make Wi-Fi evidence unavailable.','Sensitive form-field presence can be supplied only by the opted-in extension. Field values and page content are never sent; this correlation cannot confirm a captive portal.']};
 }};
}
