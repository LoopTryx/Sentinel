import {normalizeDomain,watchtowerConfig} from './watchtower-domain.mjs';
const recent=new Map();
export function rememberBrowserDomain(raw,now=Date.now()){
 const domain=normalizeDomain(raw);if(!domain)return false;
 recent.delete(domain);recent.set(domain,now);while(recent.size>32)recent.delete(recent.keys().next().value);return true;
}
export function browserDomains(now=Date.now()){
 for(const [domain,at] of recent)if(now-at>Math.min(15,watchtowerConfig.retention.minutes)*60000)recent.delete(domain);
 return [...recent.keys()];
}

export function forgetBrowserDomains(){recent.clear();}
