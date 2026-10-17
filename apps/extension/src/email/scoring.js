import {assessMessage,normalizeMessage} from '../message-detector.js';
import {emailDetectorConfig as defaultPolicy} from '../../data/email-detector-config.js';
import {messageDetectorConfig} from '../../data/message-detector-config.js';
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const pattern=s=>new RegExp(`(?<![\\p{L}\\p{N}])(?:${s})(?![\\p{L}\\p{N}])`,'gu');
/** Local-only scoring. Results never contain email text, addresses, filenames or URLs. */
export function assessEmail(email,context={},technical=[],policy=defaultPolicy){
 if(!email||typeof email.body!=='string'||email.body.length>8192||email.subject!==null&&typeof email.subject!=='string'||(email.subject||'').length>512)throw new Error('Email text outside supported bounds.');
 if(!Array.isArray(technical)||technical.length>policy.limits.signals)throw new Error('Technical signals outside supported bounds.');
 const raw=`${email.subject||''} ${email.body}`.slice(0,policy.limits.text),chunks=[];
 for(let i=0;i<raw.length;i+=4096)chunks.push(raw.slice(i,i+4096));
 const base=chunks.map(text=>assessMessage(text,{senderStatus:'saved',trusted:true}));
 let normalized=chunks.map(text=>normalizeMessage(text.replace(/https?:\/\/[^\s<>"']+|www\.[^\s<>"']+/giu,' '))).join(' ');
 for(const p of messageDetectorConfig.negatedRequests)normalized=normalized.replace(new RegExp(p,'gu'),s=>' '.repeat(s.length));
 const signals=[],positions=[];let score=0;
 const add=(code,label,weight,group=code)=>{if(signals.some(s=>s.code===code))return;signals.push({code,category:group,label,text:label});score+=weight;};
 const baseCategories=new Set(base.flatMap(r=>r.categories));
 for(const id of baseCategories){const weight=policy.baseWeights[id]||0;if(weight)add(`text_${id}`,messageDetectorConfig.categories[id]?.label||id,weight,id);}
 for(const [id,category] of Object.entries(policy.categories)){
  let matched=0;
  for(const phrase of category.phrases){const match=pattern(escape(normalizeMessage(phrase))).exec(normalized);if(match){matched++;positions.push({id,index:match.index});}}
  if(matched)add(id,category.label,Math.min(policy.limits.categoryCap,category.weight*matched),({emailAction:'action',emailCredentials:'credentials',accountSecurity:'accountThreat',pressure:'urgency'}[id]||id));
 }
 for(const [id,rule]of Object.entries(policy.semanticPatterns||{})){
  const match=rule.patterns.map(p=>pattern(p).exec(normalized)).find(Boolean);
  if(match){add(id,rule.label,rule.weight,rule.category);positions.push({id:rule.category,index:match.index});}
 }
 for(const signal of technical){if(typeof signal.code!=='string'||!Object.hasOwn(policy.technicalWeights,signal.code))throw new Error('Invalid technical signal.');add(signal.code,signal.label,policy.technicalWeights[signal.code],signal.category||signal.code);}
 const directRequest=base.some(r=>r.reasons.some(reason=>reason.code==='contact_request'));
 const changedBank=policy.changedBankPatterns.some(p=>pattern(p).test(normalized));
 const groups=new Set(signals.map(s=>s.category));
 const hasPressure=groups.has('urgency')||groups.has('pressure')||groups.has('fear')||groups.has('secrecy');
 const riskyLink=technical.some(s=>['riskyLink','linkMismatch','brandPath'].includes(s.code));
 const riskyAttachment=technical.some(s=>['dangerousAttachment','doubleExtension','macroAttachment','htmlAttachment','passwordArchive'].includes(s.code));
 if(groups.size>=2){
  score+=policy.bonuses.combination;
  if(positions.some((a,i)=>positions.slice(i+1).some(b=>a.id!==b.id&&normalized.slice(Math.min(a.index,b.index),Math.max(a.index,b.index)).split(/\s+/u).length<=policy.proximityWords)))score+=policy.bonuses.proximity;
  if(hasPressure&&riskyLink)score+=policy.bonuses.pressureLink;
  if(riskyAttachment&&(hasPressure||baseCategories.has('credentials')))score+=policy.bonuses.attachmentPressure;
  if(directRequest)score+=policy.bonuses.directRequest;
  if(changedBank)score+=policy.bonuses.changedBank;
  if(context.firstTime===true)score+=policy.bonuses.firstTime;
 }
 const known=context.known===true||context.trusted===true;
 const strong=directRequest||changedBank||riskyLink&&(baseCategories.has('credentials')||groups.has('accountThreat'))||riskyAttachment&&hasPressure||groups.has('inheritance')&&baseCategories.has('action')&&hasPressure;
 const actionable=baseCategories.has('action')||groups.has('emailAction')||directRequest||changedBank||hasPressure||riskyLink||riskyAttachment;
 const threshold=context.trusted===true?policy.thresholds.trusted:known?policy.thresholds.known:context.firstTime===true?policy.thresholds.firstTime:policy.thresholds.unknown;
 const eligible=groups.size>=2&&actionable&&(!known||strong);
 const flagged=eligible&&(score>=threshold||known&&(directRequest||changedBank));
 const tier=flagged?(score>=policy.thresholds.likely?'Likely Scam':'Suspicious'):'Safe';
 const reasons=flagged?signals.map(s=>({code:s.code,category:s.category,text:s.label})):[];
 if(flagged&&!known)reasons.unshift({code:'unknown_sender',category:'context',text:context.firstTime===true?'First-time sender':'Sender identity is unverified'});
 if(flagged&&known&&(directRequest||changedBank))reasons.unshift({code:'known_request',category:'context',text:'A known sender is asking for money, codes, passwords or changed payment details. Verify separately.'});
 return {tier,risk:flagged?'suspicious':'unknown',score,threshold,categories:[...groups],reasons,coverage:'partial',borderline:eligible&&Math.abs(score-threshold)<=2,networkAccessed:false,secondOpinion:'disabled',identityVerified:false};
}
