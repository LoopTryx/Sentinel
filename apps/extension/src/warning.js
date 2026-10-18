import snapshot from '../data/badware-snapshot.js';
import {listState,assessNavigation} from './navigation-policy.js';
import {handoffInput,sendAiHandoff,pendingAiHandoff} from './ai-handoff.js';

const listed=location.hash==='#listed';
document.body.dataset.risk=listed?'listed':'keywords';
document.getElementById('classification').textContent=listed?'REPORTED DOMAIN RISK':'SUSPICIOUS LINK WORDING';
document.getElementById('summary').textContent=listed?'This domain appears on the offline risk list.':'This address matches a scam-style wording rule.';
const reason=document.createElement('li');
reason.textContent=listed?'Listings can be stale or mistaken. This is not a fresh malware verdict.':'Unexpected prizes that require payment are a common scam pattern. Wording alone does not prove fraud.';
document.getElementById('reasons').append(reason);
const freshness=document.getElementById('list-status');
freshness.hidden=!listed;
freshness.textContent='Offline list · '+listState(snapshot).replaceAll('_',' ')+' · '+snapshot.capturedAt.slice(0,10);
document.getElementById('list-source').textContent=listed?snapshot.hosts.length+' supported domains from the limited uBlock Origin Badware risks subset. GPL-3.0 attribution is bundled in the third-party folder.':'This rule checks URL wording only; it does not verify the sender or establish that a site is malicious.';

let original=null;
if(location.hash.startsWith('#url=')){
 try{const candidate=location.hash.slice(5),assessment=assessNavigation(candidate);original=candidate;
  document.getElementById('summary').textContent='Local URL assessment · '+assessment.risk;
  const reasons=document.getElementById('reasons');reasons.replaceChildren();for(const signal of assessment.reasons){const li=document.createElement('li');li.textContent=signal.text;reasons.append(li);}
  document.getElementById('classification').textContent='LOCAL URL EVIDENCE';
 }catch{}
}
const section=document.querySelector('.warning-copy'),box=document.createElement('section');box.className='ai-warning';box.hidden=!original;
const button=document.createElement('button');button.textContent='Learn more in Sentinel';button.className='warning-action';button.disabled=!original;
const status=document.createElement('p');status.setAttribute('role','status');box.append(status,button);section.append(box);
let answerTimer=null,handoff=null;
async function explain(){
 try{
  handoff=await sendAiHandoff(handoffInput(original,'Why is this link concerning, and what should I do?'));
  status.textContent='Preparing an explanation…';let polling=false;
  answerTimer=setInterval(async()=>{if(Date.now()>handoff.expiresAt){clearInterval(answerTimer);return;}if(polling)return;polling=true;try{const response=await chrome.runtime.sendMessage({kind:'demo_call',method:'ai-result',data:{ref:handoff.finding.ref}});const quick=response?.data?.quick;if(quick){clearInterval(answerTimer);status.textContent=quick.text;}}catch{}finally{polling=false;}},1000);
 }catch{status.textContent='Open Sentinel to connect your assistant.';}
}
button.addEventListener('click',async()=>{if(button.disabled)return;button.disabled=true;try{if(!handoff)await explain();if(handoff){await chrome.tabs.create({url:chrome.runtime.getURL('continue.html')+'#'+handoff.finding.ref});}}catch{status.textContent='Open Sentinel to continue.';}finally{button.disabled=!original;}});
window.addEventListener('pagehide',()=>{if(answerTimer)clearInterval(answerTimer);});
if(original&&['listed','keywords'].includes(assessNavigation(original).kind))void explain();
