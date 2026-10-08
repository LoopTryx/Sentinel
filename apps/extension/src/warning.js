import snapshot from '../data/badware-snapshot.js';import {listState} from './navigation-policy.js';
const shortener=location.hash==='#shortener';
const listed=location.hash==='#listed';document.body.dataset.risk=listed?'listed':shortener?'shortener':'keywords';
document.getElementById('classification').textContent=listed?'REPORTED BADWARE RISK':'SUSPICIOUS URL WORDING';
document.getElementById('summary').textContent=shortener?'A known shortener contains prize or reward wording. Its final destination has not been checked.':listed?'A domain-list navigation rule raises this warning for sites reported as badware risks.':'A keyword rule raises this warning when the address combines reward bait with a payment request.';
const li=document.createElement('li');li.textContent=shortener?'A short link conceals its destination, and prize offers can be bait. Verify independently. This wording warning does not prove malware.':listed?'The rule uses a limited, offline subset of uBlock Origin’s maintained Badware risks list. Listings can be stale or mistaken; this is not a fresh malware verdict.':'Unexpected prizes that require payment are a common scam pattern. Wording alone does not prove fraud. Verify the offer through an independently obtained official address.';document.getElementById('reasons').append(li);
document.getElementById('list-status').textContent=snapshot.hosts.length+' supported domains · '+listState(snapshot)+' snapshot · '+snapshot.capturedAt.slice(0,10)+' · GPL-3.0 data attribution in the bundled third-party folder.';
// Reports the displayed local warning, not proof that navigation was prevented.
// Only bounded reason codes cross the paired transport; no destination is retained.
if(window.top===window&&(location.hash==='#listed'||location.hash==='#keywords'||shortener)){
 void chrome.runtime.sendMessage({kind:'demo_call',method:'event',data:{risk:'suspicious',codes:[listed?'risk_list':shortener?'shortened':'reward_payment']}}).catch(()=>{});
}
