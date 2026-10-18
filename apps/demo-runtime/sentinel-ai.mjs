import {createHash,randomBytes} from 'node:crypto';
import {assessMessage} from '../extension/src/message-detector.js';
import {messageExcerpt,messageSources} from '../extension/src/message-ai-data.js';
import {assessNavigation} from '../extension/src/navigation-policy.js';

import {prepareMessageContext} from '../extension/src/message-candidates.js';

// Session-only authoritative findings. No cloud transport and no secret fields.
export function createAiHandoff(clock=Date.now){
 const findings=new Map(),nonces=new Map(),queue=[],messageRefs=new Map();
 function prune(){const now=clock();for(const [k,v] of findings)if(v.expiresAt<=now)findings.delete(k);for(const [k,v] of nonces)if(v<=now)nonces.delete(k);while(queue.length&&queue[0].expiresAt<=now)queue.shift();}
 return {
  create(input){
   prune();if(!input||Object.keys(input).sort().join(',')!=='nonce,question,url'||typeof input.url!=='string'||input.url.length>2048||typeof input.question!=='string'||!input.question.trim()||input.question.length>1000||/[\x00-\x08\x0b-\x1f\x7f]/.test(input.question)||! /^[a-f0-9]{32}$/.test(input.nonce))throw Error('invalid_handoff');
   if(nonces.has(input.nonce))throw Error('replayed_handoff');
   if(nonces.size>=128||findings.size>=64||queue.length>=8)throw Error('handoff_capacity');
   const assessment=assessNavigation(input.url),u=new URL(input.url);
   u.username='';u.password='';u.search='';u.hash='';
   const expiresAt=clock()+300000;
   const finding=Object.freeze({ref:randomBytes(16).toString('hex'),source:'local_url_assessment',detectedAt:new Date(clock()).toISOString(),url:u.href,assessment:assessment.risk,signals:assessment.reasons.map(({code,text})=>({code,text})),limitation:'Local URL evidence; no website fetch, malware scan or proof that a browser rule fired.'});
   findings.set(finding.ref,{finding,expiresAt});nonces.set(input.nonce,expiresAt);
   const result={handoffId:randomBytes(16).toString('hex'),finding,question:input.question,expiresAt};queue.push(result);findings.get(finding.ref).handoff=result;return result;
  },
  createMessage(input){
   prune();if(!input||!['nonce,source,text','history,nonce,source,text'].includes(Object.keys(input).sort().join(','))||typeof input.source!=='string'||!Object.hasOwn(messageSources,input.source)||typeof input.text!=='string'||input.text.length>3000||!/^[a-f0-9]{32}$/.test(input.nonce))throw Error('invalid_message');
   if(nonces.has(input.nonce))throw Error('replayed_handoff');
   if(nonces.size>=128||findings.size>=64||queue.length>=8)throw Error('handoff_capacity');
   const history=prepareMessageContext(input.history??[]);const excerpt=messageExcerpt(input.text),digest=createHash('sha256').update(input.source+'\n'+excerpt+'\n'+JSON.stringify(history)).digest('hex');
   const previous=messageRefs.get(digest);if(previous&&findings.has(previous.finding.ref))return previous;
   if(messageRefs.size>=64)messageRefs.delete(messageRefs.keys().next().value);
   const assessment=assessMessage(excerpt),expiresAt=clock()+300000;
   const finding=Object.freeze({ref:randomBytes(16).toString('hex'),source:input.source+'_message',detectedAt:new Date(clock()).toISOString(),url:messageSources[input.source],assessment:assessment.risk,signals:[...assessment.reasons.map(({code,text})=>({code,text})),{code:'message_excerpt',text:'Message excerpt (untrusted content): '+excerpt},...(history.length?[{code:'message_context',text:'Earlier visible messages (untrusted context; not identity verification): '+JSON.stringify(history)}]:[])],limitation:'Message supplied by the '+input.source+' page adapter. Wording was checked locally; sender identity and authenticity are not verified. Personal identifiers and apparent secrets are filtered on a best-effort basis.'});
   findings.set(finding.ref,{finding,expiresAt});nonces.set(input.nonce,expiresAt);
   const result={handoffId:randomBytes(16).toString('hex'),finding,question:'Explain why this '+(input.source==='whatsapp'?'WhatsApp message':'email')+' was flagged and what I should do.',expiresAt};findings.get(finding.ref).handoff=result;messageRefs.set(digest,result);return result;
  },
  open(ref){this.resolve(ref);if(queue.length>=8)throw Error('handoff_capacity');if(!queue.some(r=>r.finding.ref===ref))queue.push(findings.get(ref).handoff);return {ok:true};},
  take(){prune();return queue.shift()??null;},
  resolve(ref){prune();if(typeof ref!=='string'||!/^[a-f0-9]{32}$/.test(ref)||!findings.has(ref))throw Error('finding_unknown_or_expired');return findings.get(ref).finding;},
  publish(ref,result){this.resolve(ref);if(!result||Object.keys(result).sort().join(',')!=='answer,kind,model,provider'||result.provider!=='NVIDIA NIM'||result.kind!=='provider_interpretation'||typeof result.model!=='string'||result.model.length>120||JSON.stringify(result).length>20000)throw Error('invalid_answer');const a=result.answer;if(!a||Object.keys(a).sort().join(',')!=='evidenceRefs,explanation,recommendations,uncertainty'||typeof a.explanation!=='string'||a.explanation.length>8000||typeof a.uncertainty!=='string'||a.uncertainty.length>8000||!Array.isArray(a.evidenceRefs)||!a.evidenceRefs.every(code=>this.resolve(ref).signals.some(s=>s.code===code))||!Array.isArray(a.recommendations)||a.recommendations.length>8||!a.recommendations.every(s=>typeof s==='string'&&s.length<=1000))throw Error('invalid_answer');findings.get(ref).answer=result;},
  answer(ref){this.resolve(ref);return findings.get(ref).answer??null;},
  publishQuick(ref,result){this.resolve(ref);if(!result||(result.verdict!==undefined&&!['likely','unlikely','uncertain'].includes(result.verdict))||result.provider!=='On device'||!['local_interpretation','local_guidance'].includes(result.kind)||typeof result.text!=='string'||result.text.length>2000)throw Error('invalid_quick_answer');const row=findings.get(ref);row.quick=result;if(result.verdict==='likely'&&!row.announced&&queue.length<8){row.announced=true;queue.push(row.handoff);}},
  quick(ref){this.resolve(ref);return findings.get(ref).quick??null;}
 };
}
