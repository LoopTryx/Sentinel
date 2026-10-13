import snapshot from '../data/badware-snapshot.js';
import {listState} from './navigation-policy.js';

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
