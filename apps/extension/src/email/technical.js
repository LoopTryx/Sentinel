import {inspectMessageLink} from '../message-detector.js';
import {emailDetectorConfig as policy} from '../../data/email-detector-config.js';
import {messageDetectorConfig as common} from '../../data/message-detector-config.js';
const mixed=value=>/\p{Script=Latin}/u.test(value)&&/\p{Script=Cyrillic}/u.test(value);
const host=value=>{try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)?url.hostname.toLowerCase():null;}catch{return null;}};
const domain=value=>typeof value==='string'?value.split('@').at(-1).toLowerCase():null;
/** Names and exposed metadata only. No downloads, navigation or network reputation calls. */
export function inspectEmail(email){
 const signals=[];
 const add=(code,label,category=code)=>{if(!signals.some(s=>s.code===code)&&signals.length<policy.limits.signals)signals.push({code,label,category});};
 const sender=domain(email.sender?.address),reply=domain(email.replyTo);
 if(sender&&reply&&sender!==reply)add('replyTo','Reply address uses a different domain','sender');
 if(sender){
  const clue=inspectMessageLink(`https://${sender}`);
  if(clue.codes.includes('lookalike'))add('brandSender','Sender domain resembles a brand outside its listed domains','sender');
  if(policy.freeMail.includes(sender)&&policy.companyClaims.some(c=>(email.sender?.name||'').toLowerCase().includes(c)))add('freeMailClaim','Company claim uses a free email provider','sender');
 }
 if(Object.values(email.authentication||{}).some(v=>typeof v==='string'&&/^fail$/i.test(v)))add('authentication','An exposed email authentication check failed','authentication');
 if(mixed(`${email.sender?.name||''} ${email.subject||''}`))add('mixedScript','Mixed Latin and Cyrillic characters need inspection','script');
 const textLinks=(email.body||'').slice(0,8192).match(/https?:\/\/[^\s<>"']+|www\.[^\s<>"']+/giu)||[];
 const links=[...(email.links||[]),...textLinks.slice(0,policy.limits.links).map(value=>({text:value,destination:value.startsWith('www.')?`https://${value}`:value}))].slice(0,policy.limits.links);
 for(const link of links){
  const destination=link.destination||link.href;
  if(typeof destination!=='string'||destination.length>2048)continue;
  let url;try{url=new URL(destination);if(!['http:','https:'].includes(url.protocol))continue;}catch{continue;}
  const actual=url.hostname.toLowerCase(),label=(link.text||'').trim();
  const displayed=host(/^www\./i.test(label)?`https://${label}`:label);
  if(displayed&&displayed!==actual)add('linkMismatch','Link label and destination use different domains','link');
  const clue=inspectMessageLink(destination);
  if(clue.suspicious)add('riskyLink','Link has a shortener, unusual host or brand resemblance','link');
  if(actual.split('.').length>policy.maxSubdomains)add('subdomains','Link contains many subdomains','link');
  if(policy.linkPaths.some(p=>url.pathname.toLowerCase().split(/[^a-z]+/).includes(p)))add('loginPath','Link requests account access or verification','link');
  if(!clue.official&&common.brands.some(brand=>url.pathname.toLowerCase().split(/[^a-z]+/).includes(brand.name)))add('brandPath','Brand name appears in a path outside its listed domains','link');
  if(mixed(label)||mixed(destination))add('mixedScript','Mixed Latin and Cyrillic characters need inspection','script');
 }
 for(const item of (email.attachments||[]).slice(0,policy.limits.attachments)){
  const name=(typeof item==='string'?item:item.name||'').slice(0,256).toLowerCase(),parts=name.split('.'),ext=parts.at(-1);
  if(policy.attachmentExtensions.executable.includes(ext)){
   add('dangerousAttachment','Attachment name indicates executable content','attachment');
   if(parts.length>2&&/^(pdf|docx?|xlsx?|jpg|png|txt)$/.test(parts.at(-2)))add('doubleExtension','Attachment uses a misleading double extension','attachment');
  }
  if(policy.attachmentExtensions.macro.includes(ext))add('macroAttachment','Attachment name indicates a macro-capable document','attachment');
  if(policy.attachmentExtensions.html.includes(ext))add('htmlAttachment','Attachment name indicates a web document','attachment');
  if(policy.attachmentExtensions.archive.includes(ext)&&/\bpassword\b|كلمة المرور/iu.test(email.body||''))add('passwordArchive','Archive is accompanied by a password','attachment');
 }
 const subject=email.subject||'';
 if(subject.length>=8&&(/[A-Z]/.test(subject)&&subject===subject.toUpperCase()||/[!?]{3,}/.test(subject)))add('subjectStyle','Subject uses strong visual pressure','style');
 if((email.body||'').length<80&&((email.links||[]).length||(email.attachments||[]).length))add('shortBody','Very short message relies on a link or attachment','style');
 if(email.imageOnly===true)add('imageOnly','Image-only content cannot be inspected as text','style');
 if(email.threadExists===false&&/^\s*(re|fw|fwd):/i.test(subject))add('fakeThread','Subject implies a conversation that is absent','style');
 return signals;
}
