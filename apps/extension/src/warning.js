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
const section=document.querySelector('.warning-copy'),box=document.createElement('section');box.className='ai-warning';
const question=document.createElement('textarea');question.maxLength=1000;question.value='Why is this link concerning, and what should I do?';question.setAttribute('aria-label','Question for SentinelAI');
const button=document.createElement('button');button.textContent='Ask SentinelAI';button.className='warning-action';button.disabled=!original;
const status=document.createElement('p');status.setAttribute('role','status');
const preview=document.createElement('pre');preview.style.whiteSpace='pre-wrap';preview.style.overflowWrap='anywhere';
box.append(question,preview,button,status);section.append(box);
function updatePreview(){try{const input=handoffInput(original,question.value);preview.textContent='Transfer to your local Sentinel console (not NVIDIA):\n'+JSON.stringify({url:input.url,question:input.question},null,2);}catch{preview.textContent='Original URL unavailable. Re-enable navigation warnings to install the updated rules.';}}
question.addEventListener('input',updatePreview);updatePreview();
let answerTimer=null;
button.addEventListener('click',async()=>{if(button.disabled)return;button.disabled=true;try{const handoff=await sendAiHandoff(handoffInput(original,question.value));status.textContent='Question delivered. Open Sentinel → SentinelAI. Cloud analysis still requires a separate approval.';if(answerTimer)clearInterval(answerTimer);let polling=false;answerTimer=setInterval(async()=>{if(Date.now()>handoff.expiresAt){clearInterval(answerTimer);return;}if(polling)return;polling=true;try{const response=await chrome.runtime.sendMessage({kind:'demo_call',method:'ai-result',data:{ref:handoff.finding.ref}});const result=response?.data?.result;if(result){clearInterval(answerTimer);const answer=document.createElement('section');answer.className='ai-provider-answer';const title=document.createElement('h2');title.textContent='SentinelAI · NVIDIA interpretation';const explanation=document.createElement('p');explanation.textContent=result.answer.explanation;const uncertainty=document.createElement('p');uncertainty.textContent=result.answer.uncertainty;answer.append(title,explanation,uncertainty);for(const tip of result.answer.recommendations){const p=document.createElement('p');p.textContent=tip;answer.append(p);}box.append(answer);status.textContent='Approved AI response received. Your local detection result is unchanged.';}}catch{}finally{polling=false;}},2000);}catch(e){status.textContent=e.message;}finally{button.disabled=!original;}});
window.addEventListener('pagehide',()=>{if(answerTimer)clearInterval(answerTimer);});
void pendingAiHandoff().then(pending=>{if(pending&&pending.url===handoffInput(original||pending.url,question.value).url){question.value=pending.question;updatePreview();status.textContent='A pending question can be retried.';}}).catch(()=>{});
