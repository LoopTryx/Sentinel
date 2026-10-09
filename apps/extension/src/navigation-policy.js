import snapshot from '../data/badware-snapshot.js';
import {explainUrl} from './local-checks.js';
// Match paired bait in the path only. A single word such as "malware" can be an educational article.
const reward='(?:prize|lottery|reward|winner)',payment='(?:payment|fee|deposit)';
// Keep each direction below Chrome's compiled RE2 memory limit. Non-capturing
// token groups also avoid allocating captures that redirects never use.
const pair=(a,b)=>'^https?://[^/?#]+/[^?#]*\\b'+a+'\\b[^?#]*\\b'+b+'\\b';
export const BAIT_REGEXES=[pair(reward,payment),pair(payment,reward)];
export const SHORTENER_REWARD_REGEX='^https?://(?:bit\\.ly|tinyurl\\.com|t\\.co|is\\.gd)(?::(?:80|443))?/[^?#]*\\b'+reward+'\\b';
const RULE_IDS=[9001,9002,9003,9004];
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
 const shortener=new RegExp(SHORTENER_REWARD_REGEX,'i').test(input);
 const reason=listed?{code:'risk_list',text:'This host matches the bundled uBlock Origin Badware risks subset. This is a reported risk, not a fresh malware scan.'}:keywords?{code:'reward_payment',text:'The URL path combines reward bait and a payment request. Verify the offer independently before opening it.'}:null;
 const shortReason={code:'shortened',text:'Prize wording on a known shortener hides the destination. Verify independently; this is not proof of malware.'};
 const finding=reason||(shortener?shortReason:null);
 return {...local,kind:listed?'listed':keywords?'keywords':shortener?'shortener':'unknown',risk:listed||keywords||shortener?'suspicious':local.risk,listState:listState(feed),listSource:feed.source,listDate:feed.capturedAt,reputationChecked:true,reasons:finding?[finding,...local.reasons.filter(r=>r.code!==finding.code)]:local.reasons};
}
export function makeNavigationRules(feed=snapshot){
 return [
  {id:9001,priority:20,action:{type:'redirect',redirect:{extensionPath:'/warning.html#listed'}},condition:{requestDomains:feed.hosts,resourceTypes:['main_frame']}},
  ...BAIT_REGEXES.map((regexFilter,index)=>({id:9002+index,priority:10,action:{type:'redirect',redirect:{extensionPath:'/warning.html#keywords'}},condition:{regexFilter,isUrlFilterCaseSensitive:false,resourceTypes:['main_frame']}})),
  {id:9004,priority:9,action:{type:'redirect',redirect:{extensionPath:'/warning.html#shortener'}},condition:{regexFilter:SHORTENER_REWARD_REGEX,isUrlFilterCaseSensitive:false,resourceTypes:['main_frame']}},
 ];
}
export async function setNavigationWarnings(api,enabled){
 if(enabled&&!await api.permissions.contains({origins:['http://*/*','https://*/*']}))throw new Error('Site access is required for automatic navigation warnings.');
 if(enabled){for(const regex of [...BAIT_REGEXES,SHORTENER_REWARD_REGEX]){const supported=await api.declarativeNetRequest.isRegexSupported({regex,isCaseSensitive:false});if(!supported.isSupported)throw new Error('This Chrome build does not support the keyword rule.');}}
 await api.declarativeNetRequest.updateDynamicRules({removeRuleIds:RULE_IDS,addRules:enabled?makeNavigationRules():[]});
 return navigationWarningStatus(api);
}
export async function navigationWarningStatus(api){
 const rules=await api.declarativeNetRequest.getDynamicRules();
 const access=await api.permissions.contains({origins:['http://*/*','https://*/*']});
 const active=RULE_IDS.some(id=>rules.some(r=>r.id===id)); const complete=RULE_IDS.every(id=>rules.some(r=>r.id===id));
 return {active,enabled:access&&complete,upgradeNeeded:active&&!complete,siteAccess:access,listState:listState(snapshot),domains:snapshot.hosts.length,date:snapshot.capturedAt};
}
