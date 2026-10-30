import {gmailSelectors} from './providers/gmail.js';
import {outlookSelectors} from './providers/outlook.js';
import {isMessageCandidate,priorVisibleText} from '../message-candidates.js';
import {mountMessageAi} from '../message-ai-inline.js';
import {observeOpenedEmails,emailProvider} from './extraction.js';
import {assessEmail} from './scoring.js';
import {inspectEmail} from './technical.js';
import {showEmailWarning} from './banner.js';
import {guardEmailLinks} from './link-guard.js';
export async function startEmailWarnings(doc,api){
 if(!emailProvider(doc))return;
 let stopped=false,observer,timer,lastStatus=null;const cleanups=new Map();
 const request=message=>new Promise((resolve,reject)=>{const timeout=doc.defaultView.setTimeout(()=>reject(new Error('Email operation timed out.')),3000);api.runtime.sendMessage(message).then(resolve,reject).finally(()=>doc.defaultView.clearTimeout(timeout));});
 function stop(){if(stopped)return;stopped=true;observer?.stop();doc.defaultView.clearTimeout(timer);for(const cleanup of cleanups.values())cleanup();cleanups.clear();api.runtime.onMessage.removeListener(listener);doc.defaultView.removeEventListener('pagehide',stop);globalThis.__sentinelEmailStarted=false;}
 const listener=message=>{if(message?.kind==='email_stop')stop();};
 api.runtime.onMessage.addListener(listener);doc.defaultView.addEventListener('pagehide',stop,{once:true});
 try{if(!(await request({kind:'email_status'}))?.enabled){stop();return;}}catch{stop();return;}
 observer=observeOpenedEmails(doc,{onEmail:async(snapshot,root,isCurrent)=>{
  let context={};if(snapshot.sender.address)try{context=await request({kind:'email_context',address:snapshot.sender.address});}catch{}
  if(stopped||!isCurrent())return;
  cleanups.get(root)?.();
  const result=assessEmail(snapshot,context,inspectEmail(snapshot));
  let banner=()=>{},links=()=>{};
  const showConfirmed=verdict=>{
   if(stopped||!isCurrent())return;
   banner();links();banner=()=>{};links=()=>{};
   if(verdict!=='likely')return;
   const confirmed={...result,tier:'Likely Scam'};
   banner=showEmailWarning(root,confirmed,{...(snapshot.sender.address?{onTrustSender:()=>request({kind:'email_trust_current',address:snapshot.sender.address})}:{}),onWrongFlag:async()=>{const response=await request({kind:'email_feedback',tier:confirmed.tier});if(response?.recorded!==true)throw Error('Feedback unavailable.');return response;}});
   links=guardEmailLinks(root,{isCurrent});
  };
  const provider=emailProvider(doc)?.id;
  // Outlook context is accepted only inside an explicitly identified conversation.
  // Never gather unrelated reading panes or inbox rows as past messages.
  const thread=provider==='gmail'?root.closest('[role="main"]'):root.closest('[data-conversation-id]');
  const selectors=provider==='gmail'?gmailSelectors:outlookSelectors;
  const contextNodes=thread?Array.from(thread.querySelectorAll(selectors.roots)):[];
  const history=priorVisibleText(contextNodes,root,selectors.body);
  const current=((snapshot.subject||'')+'\n'+snapshot.body).slice(0,3000);
  const ai=result.tier!=='Safe'||isMessageCandidate(current)?mountMessageAi(root.querySelector(selectors.body)||root,current,api,{isCurrent,history,candidateOnly:true,animate:true,onVerdict:showConfirmed}):()=>{};
  cleanups.set(root,()=>{links();ai();banner();});
 },onStatus:status=>{lastStatus={kind:'email_reader_status',state:status.state,messages:status.messages||0};void request(lastStatus).catch(()=>{});for(const [root,cleanup]of cleanups)if(!root.isConnected||['unsupported_open_layout','no_supported_open_message','extraction_unavailable'].includes(status.state)){cleanup();cleanups.delete(root);}}});
 async function poll(){try{if(!(await request({kind:'email_status'}))?.enabled){stop();return;}if(lastStatus)await request(lastStatus);}catch{if(!stopped)timer=doc.defaultView.setTimeout(poll,2000);return;}if(!stopped)timer=doc.defaultView.setTimeout(poll,5000);}
 timer=doc.defaultView.setTimeout(poll,5000);
 return stop;
}
