import snapshot from '../data/badware-snapshot.js';
import {explainUrl} from './local-checks.js';
// Match paired bait in the path only. A single word such as "malware" can be an educational article.
const reward='(?:prize|lottery|reward|winner)',payment='(?:payment|fee|deposit)';
// Keep each direction below Chrome's compiled RE2 memory limit. Non-capturing
// token groups also avoid allocating captures that redirects never use.
const pair=(a,b)=>'^https?://[^/?#]+/[^?#]*\\b'+a+'\\b[^?#]*\\b'+b+'\\b';
export const BAIT_REGEXES=[pair(reward,payment),pair(payment,reward)];
const RULE_IDS=[9001,9002,9003];
export function listState(feed,now=Date.now()){
 const time=Date.parse(feed.capturedAt);
 if(!Number.isFinite(time))return 'unavailable';
 if(time>now+300000)return 'clock_anomaly';
 return now-time>5*86400000?'stale':'current';
}
export function assessNavigation(input,feed=snapshot){
 const local=explainUrl(input);const host=local.host.toLowerCase().replace(/\.$/,'');
 const listed=feed.hosts.some(h=>host===h||host.endsWith('.'+h));
 const keywords=BAIT_REGEXES.some(regex=>new RegExp(regex,'i').test(input));
 const reason=listed?{code:'risk_list',text:'This host matches the bundled uBlock Origin Badware risks subset. This is a reported risk, not a fresh malware scan.'}:keywords?{code:'reward_payment',text:'The URL path combines reward bait and a payment request. Verify the offer independently before opening it.'}:null;
 return {...local,kind:listed?'listed':keywords?'keywords':'unknown',risk:listed||keywords?'suspicious':local.risk,listState:listState(feed),listSource:feed.source,listDate:feed.capturedAt,reputationChecked:true,reasons:reason?[reason,...local.reasons.filter(r=>r.code!==reason.code)]:local.reasons};
}
export function makeNavigationRules(feed=snapshot){
 return [
  {id:9001,priority:20,action:{type:'redirect',redirect:{extensionPath:'/warning.html#listed'}},condition:{requestDomains:feed.hosts,resourceTypes:['main_frame']}},
  ...BAIT_REGEXES.map((regexFilter,index)=>({id:9002+index,priority:10,action:{type:'redirect',redirect:{extensionPath:'/warning.html#keywords'}},condition:{regexFilter,isUrlFilterCaseSensitive:false,resourceTypes:['main_frame']}})),
 ];
}
export async function setNavigationWarnings(api,enabled){
 if(enabled&&!await api.permissions.contains({origins:['http://*/*','https://*/*']}))throw new Error('Site access is required for automatic navigation warnings.');
 if(enabled){for(const regex of BAIT_REGEXES){const supported=await api.declarativeNetRequest.isRegexSupported({regex,isCaseSensitive:false});if(!supported.isSupported)throw new Error('This Chrome build does not support the keyword rule.');}}
 await api.declarativeNetRequest.updateDynamicRules({removeRuleIds:RULE_IDS,addRules:enabled?makeNavigationRules():[]});
 return navigationWarningStatus(api);
}
export async function navigationWarningStatus(api){
 const rules=await api.declarativeNetRequest.getDynamicRules();
 const access=await api.permissions.contains({origins:['http://*/*','https://*/*']});
 return {enabled:access&&RULE_IDS.every(id=>rules.some(r=>r.id===id)),listState:listState(snapshot),domains:snapshot.hosts.length,date:snapshot.capturedAt};
}
