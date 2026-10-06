import {assessNavigation} from './navigation-policy.js';
const $=id=>document.getElementById(id);
$('leave').onclick=()=>{location.replace('popup.html');};
async function inspect(){
 const id=location.hash.slice(1);history.replaceState(null,'','xray.html');
 if(!/^[a-f0-9-]{36}$/.test(id))throw new Error('Enter a full HTTP/HTTPS URL using the Sentinel address-bar keyword. URLs containing credentials are refused.');
 const key='sentinelXray:'+id;const item=(await chrome.storage.session.get(key))[key];await chrome.storage.session.remove(key);
 if(!item||item.expires<=Date.now())throw new Error('This assessment expired. Start a new check from Chrome’s address bar.');
 const result=assessNavigation(item.url);if(result.reasons.some(r=>r.code==='credentials'))throw new Error('URLs with embedded credentials are refused.');
 document.body.dataset.risk=result.kind;
 $('classification').textContent=result.kind==='listed'?'REPORTED BADWARE RISK':result.risk==='suspicious'?'SUSPICIOUS ADDRESS':'SAFETY UNKNOWN';
 $('list-status').textContent='Offline list: '+result.listSource+' · '+result.listState+' · '+result.listDate.slice(0,10)+'. No match never establishes safety.';
 $('heading').textContent=result.risk==='suspicious'?'This link may be harmful':'No local warning signs found · safety unknown';
 $('destination').textContent='Destination: '+result.host+' ('+result.scheme+', port '+result.port+')';
 for(const reason of result.reasons){const li=document.createElement('li');li.textContent=reason.text;$('reasons').append(li);}
 $('continue').hidden=false;$('continue').onclick=()=>{location.replace(item.url);};
 try{const response=await chrome.runtime.sendMessage({kind:'demo_call',method:'event',data:{risk:result.risk,codes:result.reasons.map(r=>r.code)}});if(response?.error)throw new Error();$('desktop-result').textContent='Assessment reason codes logged in the paired desktop.';}catch{$('desktop-result').textContent='Desktop disconnected. This local assessment was not logged.';}
}
void inspect().catch(error=>{$('heading').textContent='Link assessment unavailable';$('destination').textContent=error.message;});
