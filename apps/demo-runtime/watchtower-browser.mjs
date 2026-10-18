import {normalizeDomain,watchtowerConfig} from './watchtower-domain.mjs';
const recent=new Map();
export function rememberBrowserDomain(raw,now=Date.now(),codes=[]){
 const domain=normalizeDomain(raw);if(!domain)return false;
 recent.delete(domain);recent.set(domain,{at:now,codes:codes.filter(code=>['portal_credentials','portal_payment'].includes(code)).slice(0,2)});while(recent.size>32)recent.delete(recent.keys().next().value);return true;
}
export function browserDomains(now=Date.now()){
 for(const [domain,value] of recent)if(now-value.at>Math.min(15,watchtowerConfig.retention.minutes)*60000)recent.delete(domain);
 return [...recent.keys()];
}

export function forgetBrowserDomains(){recent.clear();}

export function browserPortalSignals(){browserDomains();return [...recent.values()].flatMap(value=>value.codes);}
