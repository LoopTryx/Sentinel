import {createTopologyChecks} from './watchtower-topology.mjs';
import {browserDomains,browserPortalSignals} from './watchtower-browser.mjs';
import {createExternalChecks} from './watchtower-external.mjs';
import {execFile} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {isIP} from 'node:net';
import {assessDomain,normalizeDomain,watchtowerConfig as config} from './watchtower-domain.mjs';
export function assessMetadata(raw,history=new Map(),now=Date.now()){
 if(!raw||raw.version!==1||!Array.isArray(raw.domains)||raw.domains.length>config.limits.domains||!Array.isArray(raw.connections)||raw.connections.length>config.limits.connections||!['available','unavailable'].includes(raw.dnsStatus)||!['available','unavailable'].includes(raw.connectionStatus))throw Error('watchtower_unavailable');
 const domains=[...new Set(raw.domains.map(normalizeDomain).filter(Boolean))].map(domain=>{const key=createHash('sha256').update(domain).digest('hex'),last=history.get(key);history.delete(key);history.set(key,now);return assessDomain(domain,{firstSeen:last===undefined||now-last>config.retention.minutes*60000});});
 for(const [key,at] of history)if(now-at>config.retention.minutes*60000||history.size>config.limits.domains*2)history.delete(key);
 const connections=raw.connections.flatMap(row=>row&&isIP(row.address)&&Number.isInteger(row.port)&&row.port>0&&row.port<=65535&&typeof row.process==='string'&&/^[\p{L}\p{N}_. -]{1,80}$/u.test(row.process)?[{address:row.address,port:row.port,process:row.process}]:[]);
 return {version:1,observedAt:new Date().toISOString(),dnsStatus:raw.dnsStatus,connectionStatus:raw.connectionStatus,domains,connections,capabilities:{dnsCache:raw.dnsStatus==='available',connections:raw.connectionStatus==='available',browserUrls:false,tls:false,domainAge:false,reputation:false,blocking:false},limitations:['DNS cache entries are resolved names, not proof of a browser visit. Browser secure DNS can bypass this cache.','Connections are local metadata; no reliable domain-to-process or DNS-to-connection attribution is made.','Safe means no combined hostname indicators were found. It is not a reputation or safety guarantee.','No packet inspection, external queries, TLS interception, network probes or blocking. No browsing history is stored.']};
}
const topology=createTopologyChecks(config);
const history=new Map(),external=createExternalChecks({...config.externalLookups,retentionMinutes:config.retention.minutes});
let active=null;
export function observeDestinations(){
 if(active)return active;
 active=(async()=>{
  if(process.platform!=='win32')throw Error('watchtower_unsupported');
  const executable=join(process.env.SystemRoot??'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
  const stdout=await new Promise((resolve,reject)=>execFile(executable,['-NoProfile','-NonInteractive','-File',fileURLToPath(new URL('./watchtower-observe.ps1',import.meta.url))],{windowsHide:true,timeout:6500,maxBuffer:config.limits.outputBytes},(error,stdout)=>error?reject(Error('watchtower_unavailable')):resolve(stdout)));
  try{const raw=JSON.parse(String(stdout).replace(/^\uFEFF/,'')),visited=browserDomains();raw.domains=[...new Set([...visited,...raw.domains])].slice(0,config.limits.domains);const report=assessMetadata(raw,history);report.topology=topology.assess(raw.topology,{portalSignals:browserPortalSignals()});report.domains=report.domains.map(item=>({...assessDomain(item.domain,{firstSeen:item.firstSeen,external:external.read(item.domain)}),source:visited.includes(item.domain)?'browser':'dns_cache'}));report.capabilities.browserUrls=visited.length>0;report.capabilities.externalOptIn=config.externalLookups.enabled;report.capabilities.tls=report.domains.some(item=>item.tlsChecked);report.capabilities.domainAge=report.domains.some(item=>item.ageChecked);report.capabilities.reputation=report.domains.some(item=>item.reputationChecked);if(config.externalLookups.enabled)report.limitations[3]='Opted-in external checks run one destination per refresh, with bounded timeout and memory cache. TLS only checks observed browser hosts on public IPv4 addresses. No interception or blocking.';void external.schedule(report.domains.map(item=>item.domain),visited);return report;}catch{throw Error('watchtower_unavailable');}
 })().finally(()=>{active=null;});return active;
}
