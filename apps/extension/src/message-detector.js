import {messageDetectorConfig as config} from '../data/message-detector-config.js';

/** Bounded local heuristic. No fetch, storage, raw matches, URLs or sender identifiers in output. */
export function normalizeMessage(text,preserveDigits=false) {
 if(typeof text!=='string'||text.length>config.limits.characters)throw new Error('Use a message of at most 4096 characters.');
 return text.normalize('NFKC').toLowerCase()
  .replace(/[٠-٩۰-۹]/gu,c=>String(c.charCodeAt(0)-(c<='٩'?1632:1776)))
  .replace(/[\u064b-\u065f\u0670\u0640\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/gu,'')
  .replace(/['’]/gu,'')
  .replace(/[01$@]/g,c=>preserveDigits&&/[01]/u.test(c)?c:({'0':'o','1':'l','$':'s','@':'a'}[c]))
  .replace(/([\p{L}])\1{2,}/gu,'$1')
  .replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
}
const boundary='[\\p{L}\\p{N}]';
function find(pattern,text) {
 return [...text.matchAll(new RegExp(`(?<!${boundary})(?:${pattern})(?!${boundary})`,'gu'))].slice(0,config.limits.matchesPerCategory);
}
const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const urlPattern=/(?:https?:\/\/|www\.)[^\s<>"'\u200b-\u200f]+|(?<![\p{L}\p{N}@])(?:[a-z0-9-]+\.)+(?:com|net|org|ly|gd|co|top|xyz|click|zip|mov|work|at)(?![\p{L}\p{N}_-])(?:\/[^\s<>"']*)?/giu;
function distance(a,b) {
 if(Math.abs(a.length-b.length)>config.maxBrandDistance)return Infinity;
 let row=Array.from({length:b.length+1},(_,i)=>i);
 for(let i=1;i<=a.length;i++) {const next=[i];for(let j=1;j<=b.length;j++)next[j]=Math.min(next[j-1]+1,row[j]+1,row[j-1]+(a[i-1]===b[j-1]?0:1));row=next;}
 return row[b.length];
}
function linksIn(text) {
 // Read raw text before leetspeak/punctuation normalization destroys URL structure.
 const matches=text.match(urlPattern)||[];
 return matches.slice(0,config.limits.urls).flatMap(raw=>{
  raw=raw.replace(/[),.!?;]+$/u,'');
  try {const url=new URL(/^https?:\/\//i.test(raw)?raw:`https://${raw}`);if(!['http:','https:'].includes(url.protocol))return [];return [url];}catch{return [];}
 });
}
function linkClues(url) {
 const host=url.hostname.toLowerCase().replace(/\.$/,'');
 if(host.length>config.limits.hostLength)return {suspicious:true,codes:['host_bounds']};
 const labels=host.split('.'),codes=[];
 const official=config.brands.some(b=>b.domains.some(d=>host===d||host.endsWith(`.${d}`)));
 if(config.shorteners.includes(host))codes.push('shortener');
 if(config.suspiciousTlds.includes(labels.at(-1)))codes.push('suspiciousTld');
 if(url.username||url.password)codes.push('embeddedCredentials');
 if(/^\d+\.\d+\.\d+\.\d+$/.test(host)||host.startsWith('['))codes.push('ipHost');
 if(labels.some(l=>l.startsWith('xn--')))codes.push('internationalized');
 if(!official&&labels.some(label=>label.length<=config.limits.labelLength&&config.brands.some(b=>{
  const folded=label.replace(/[01]/g,c=>c==='0'?'o':'l');
  return folded.includes(b.name)||distance(folded,b.name)<=config.maxBrandDistance;
 })))codes.push('lookalike');
 return {official,codes,suspicious:codes.length>0};
}
export function assessMessage(input,context={}) {
 if(typeof input!=='string'||input.length>config.limits.characters)throw new Error('Use a message of at most 4096 characters.');
 if(!context||typeof context!=='object'||Array.isArray(context))throw new Error('Invalid sender context.');
 // URL host/path/query words are one link signal, not independent message categories.
 const prose=input.replace(urlPattern,' ');
 let text=normalizeMessage(prose);
 let numericText=normalizeMessage(prose,true);
 for(const pattern of config.negatedRequests)text=text.replace(new RegExp(pattern,'gu'),match=>' '.repeat(match.length));
 for(const pattern of config.negatedRequests)numericText=numericText.replace(new RegExp(pattern,'gu'),match=>' '.repeat(match.length));
 const signals=[],positions=[];
 let score=0;
 for(const [category,data] of Object.entries(config.categories)) {
  // Each distinct configured signal contributes once; repetitions and overlapping
  // n-grams cannot inflate a category beyond its cap.
  const numericPatterns=[...(data.patternsNumeric||[]),...(category==='credentials'?config.numericRequestPatterns:[])];
  const groups=[...data.terms.map(term=>find(escape(normalizeMessage(term)),text)),...data.patterns.map(p=>find(p,text)),...numericPatterns.map(p=>find(p,numericText))];
  const matches=groups.flat();
  if(!matches.length)continue;
  const spans=[];let distinct=0;
  for(const group of groups){const match=group.find(m=>!spans.some(s=>m.index<s.end&&m.index+m[0].length>s.start));if(match){distinct++;for(const m of group)spans.push({start:m.index,end:m.index+m[0].length});}}
  const weight=config.weights[category];score+=Math.min(config.categoryCap,weight*distinct);
  signals.push({code:category,category,label:data.label,text:`${data.label}: ${data.reason}`});
  for(const match of matches.slice(0,config.limits.matchesPerCategory))positions.push({category,index:match.index});
 }
 const urls=linksIn(input),links=urls.map(linkClues),linkCodes=new Set(links.flatMap(l=>l.codes));
 const unverifiedLink=links.some(l=>!l.official);
 if(links.length){
  score+=Math.min(config.linkCap,config.weights.link+[...linkCodes].reduce((sum,c)=>sum+(config.weights[c]||config.weights.link),0));
  const explanations={lookalike:'a host resembles a known brand outside its listed domains',shortener:'a shortener conceals the destination',suspiciousTld:'an abuse-prone top-level domain is used (legitimate sites can use it too)',embeddedCredentials:'embedded credentials can disguise the real destination',ipHost:'the destination is an IP address',internationalized:'an internationalized host needs careful inspection',host_bounds:'the host exceeds the supported inspection bound'};
  signals.push({code:'link',category:'link',label:'Link',text:linkCodes.size?`Link: ${[...linkCodes].map(c=>explanations[c]).join('; ')}.`:'Link: a destination is included; it has not been visited or verified.'});
 }
 const categories=signals.map(s=>s.category),has=c=>categories.includes(c);
 const directRequest=config.requestPatterns.some(pattern=>find(pattern,text).length>0)||config.numericRequestPatterns.some(pattern=>find(pattern,numericText).length>0);
 const entities=prose.normalize('NFKC').replace(/[٠-٩۰-۹]/gu,c=>String(c.charCodeAt(0)-(c<='٩'?1632:1776)));
 const amount=/(?:[$€£]\s*\d+(?:[.,]\d+)?|\d+(?:[.,]\d+)?\s*(?:[$€£]|usd\b|aed\b|omr\b|ريال|درهم))/iu.test(entities);
 const phone=/(?<!\d)(?:\+?\d[\d ()-]{7,18}\d)(?!\d)/u.test(entities);
 if(categories.length>=2){
  score+=config.bonuses.crossCategory;
  if(has('reward')&&has('action')&&has('urgency'))score+=config.bonuses.rewardActionUrgency;
  if(positions.some((a,i)=>positions.slice(i+1).some(b=>a.category!==b.category&&text.slice(Math.min(a.index,b.index),Math.max(a.index,b.index)).split(/\s+/).length<=config.proximityWords)))score+=config.bonuses.proximity;
  if(has('link')&&unverifiedLink&&(has('urgency')||directRequest))score+=config.bonuses.linkPressure;
  if(directRequest)score+=config.bonuses.directRequest;
  if(amount)score+=config.weights.amount;
  if(phone)score+=config.weights.phone;
  if(context.firstTime===true)score+=config.bonuses.firstTime;
  if(context.foreignCountryCode===true)score+=config.bonuses.foreignCode;
 }
 const senderStatus=['saved','unsaved'].includes(context.senderStatus)?context.senderStatus:'unknown';
 const policy=context.trusted===true?'trusted':senderStatus;
 const thresholds=config.thresholds[policy];
 // Known contacts can be compromised. Trust never suppresses a direct request for secrets/money.
 const strongSaved=directRequest||(has('link')&&unverifiedLink&&has('credentials'))||(has('reward')&&has('action')&&(has('urgency')||has('credentials')));
 const eligible=categories.length>=2&&((senderStatus!=='saved'&&context.trusted!==true)||strongSaved);
 const threshold=directRequest&&context.trusted===true?config.thresholds.saved.suspicious:thresholds.suspicious;
 const flagged=eligible&&score>=threshold;
 const tier=flagged?(score>=thresholds.likely?'Likely Scam':'Suspicious'):'Safe';
 const reasons=flagged?[...signals]:[];
 if(flagged&&directRequest&&(senderStatus==='saved'||context.trusted===true))reasons.push({code:'contact_request',category:'context',text:'Known contacts can be compromised. Verify this money/code/password request through a separate channel; no message history was collected.'});
 if(flagged&&context.firstTime===true)reasons.push({code:'first_time',category:'context',text:'You marked this as a first-time sender; combined wording clues lowered the warning threshold.'});
 if(flagged&&context.foreignCountryCode===true)reasons.push({code:'foreign_code',category:'context',text:'You marked an unfamiliar country code. This is only a weak supporting clue, not evidence of fraud.'});
 return {risk:flagged?'suspicious':'unknown',tier,score,categories,reasons,signals,
  eventCodes:flagged?[...new Set(categories.map(c=>config.legacyEventCodes[c]).filter(Boolean))]:[],coverage:'partial',networkAccessed:false,
  context:{senderStatus,trusted:context.trusted===true,source:senderStatus==='unknown'&&context.trusted!==true?'unavailable':'user-provided'},
  borderline:eligible&&Math.abs(score-threshold)<=config.borderlineMargin,
  secondOpinion:{status:'disabled',reason:'Live message uploads are disabled; local rules only.'},
  disclaimer:tier==='Safe'?'No combined warning threshold reached. Safe is a rule label, not verification.':'Local wording clues, not proof of fraud or sender identity.',
  observations:{amount,phone,urlCount:urls.length},policyVersion:config.version};
}
