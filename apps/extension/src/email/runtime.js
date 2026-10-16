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
  const banner=showEmailWarning(root,result,{onWrongFlag:async()=>{const response=await request({kind:'email_feedback',tier:result.tier});if(response?.recorded!==true)throw new Error('Feedback unavailable.');return response;},onManageTrust:async()=>{const response=await request({kind:'email_open_settings'});if(response?.opened!==true)throw new Error('Settings unavailable.');return response;}});
  const links=result.tier==='Likely Scam'?guardEmailLinks(root,{isCurrent}):()=>{};
  cleanups.set(root,()=>{links();banner();});
 },onStatus:status=>{lastStatus={kind:'email_reader_status',state:status.state,messages:status.messages||0};void request(lastStatus).catch(()=>{});for(const [root,cleanup]of cleanups)if(!root.isConnected||['unsupported_open_layout','no_supported_open_message','extraction_unavailable'].includes(status.state)){cleanup();cleanups.delete(root);}}});
 async function poll(){try{if(!(await request({kind:'email_status'}))?.enabled){stop();return;}if(lastStatus)await request(lastStatus);}catch{stop();return;}if(!stopped)timer=doc.defaultView.setTimeout(poll,5000);}
 timer=doc.defaultView.setTimeout(poll,5000);
 return stop;
}
