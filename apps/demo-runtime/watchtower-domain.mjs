import {readFileSync} from 'node:fs';
import {domainToASCII,domainToUnicode} from 'node:url';
import {isIP} from 'node:net';
import {inspectMessageLink} from '../extension/src/message-detector.js';
import {messageDetectorConfig} from '../extension/data/message-detector-config.js';
export const watchtowerConfig=JSON.parse(readFileSync(new URL('./watchtower-config.json',import.meta.url),'utf8'));
const groups={lookalike:'identity',mixedScript:'identity',brandSubdomain:'identity',suspiciousTld:'hosting',ipHost:'hosting',internationalized:'international',shortener:'redirect',hyphens:'structure',longName:'structure',subdomains:'structure',entropy:'structure'};
const descriptions={lookalike:'The hostname resembles a known brand outside its official domains.',mixedScript:'A hostname label mixes Latin and Cyrillic or Greek characters.',brandSubdomain:'A known brand appears as a subdomain of an unrelated hostname.',suspiciousTld:'The top-level domain is on the editable caution list.',ipHost:'The destination is a raw IP address; legitimate services also use these.',internationalized:'The hostname uses internationalized encoding.',shortener:'A link shortener hides the final destination, which is not inspected.',hyphens:'The hostname contains several hyphens.',longName:'A hostname label is unusually long.',subdomains:'The hostname has many nested labels.',entropy:'A long label has a random-looking character distribution.'};
const under=(host,domain)=>host===domain||host.endsWith('.'+domain);
export function normalizeDomain(value){
 if(typeof value!=='string'||value.length>253||!value)return null;
 if(isIP(value))return value.toLowerCase();
 if(/[\s\x00-\x20\x7f/\\?#@:%]/u.test(value))return null;
 const input=value.replace(/\.$/,'').toLowerCase();
 if(isIP(input))return input;
 const ascii=domainToASCII(input);if(!ascii||ascii.length>253||!ascii.includes('.')||ascii.split('.').some(label=>!label||label.length>63||! /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)))return null;
 return ascii;
}
function entropy(label){const counts=new Map();for(const char of label)counts.set(char,(counts.get(char)||0)+1);return [...counts.values()].reduce((n,count)=>n-count/label.length*Math.log2(count/label.length),0);}
export function assessDomain(input,{firstSeen=true}={},config=watchtowerConfig){
 const domain=normalizeDomain(input);if(!domain)return null;
 const raw=domainToUnicode(domain),labels=domain.split('.'),clues=inspectMessageLink('https://'+domain),codes=new Set(clues.codes.filter(code=>Object.hasOwn(groups,code)));
 const folded=[...raw].map(c=>config.confusables[c]??c).join('');if(folded!==raw&&inspectMessageLink('https://'+folded).official)codes.add('lookalike');
 if(isIP(domain))codes.add('ipHost');
 if(raw.split('.').some(label=>/\p{Script=Latin}/u.test(label)&&/[\p{Script=Cyrillic}\p{Script=Greek}]/u.test(label)))codes.add('mixedScript');
 if(!clues.official&&labels.slice(0,-2).some(label=>messageDetectorConfig.brands.some(brand=>label===brand.name)))codes.add('brandSubdomain');
 if(labels.some(label=>label.length>=config.naming.longLabel))codes.add('longName');
 if(labels.some(label=>(label.match(/-/g)||[]).length>=config.naming.hyphens))codes.add('hyphens');
 if(labels.length>=config.naming.subdomains)codes.add('subdomains');
 if(labels.some(label=>label.length>=config.naming.entropyMinLength&&entropy(label)>=config.naming.entropy))codes.add('entropy');
 const categories=new Set([...codes].map(code=>groups[code]));let score=[...codes].reduce((n,code)=>n+(config.weights[code]??0),0);
 if(categories.has('identity')&&categories.has('hosting'))score+=config.bonuses.brandAndHosting;
 if(categories.size>=3)score+=config.bonuses.threeCategories;
 if(firstSeen&&codes.size)score+=config.bonuses.firstSeen;
 const trusted=clues.official||[...config.popularDomains,...config.trustedDomains].some(entry=>under(domain,entry));
 const minimum=config.thresholds.minimumCategories;const suspicious=trusted?config.thresholds.trustedSuspicious:config.thresholds.suspicious,likely=trusted?config.thresholds.trustedLikely:config.thresholds.likely;
 const tier=categories.size<minimum?'Safe':score>=likely?'Likely Malicious':score>=suspicious?'Suspicious':'Safe';
 return {domain,tier,score,reasons:[...codes].map(code=>({code,category:groups[code],text:descriptions[code]})),trusted,firstSeen,coverage:'hostname_only',reputationChecked:false,tlsChecked:false,ageChecked:false};
}
