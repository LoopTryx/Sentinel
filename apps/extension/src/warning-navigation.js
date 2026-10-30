export async function continueWarning(message,sender,api){
 if(sender.id!==api.runtime.id||sender.frameId!==0||!Number.isInteger(sender.tab?.id)||sender.tab.id<0||sender.tab.id>1000000000||Object.keys(message).join(',')!=='kind')throw Error('forbidden');
 const page=new URL(sender.url);if(page.href.split('#')[0]!==api.runtime.getURL('warning.html')||!page.hash.startsWith('#url='))throw Error('forbidden');
 const destination=new URL(page.hash.slice(5));if(!['http:','https:'].includes(destination.protocol)||destination.username||destination.password||destination.href.length>2048)throw Error('invalid_destination');
 destination.hash='';const target=destination.href;
 const id=100000+sender.tab.id;
 await api.declarativeNetRequest.updateSessionRules({removeRuleIds:[id],addRules:[{id,priority:100,action:{type:'allow'},condition:{tabIds:[sender.tab.id],regexFilter:'^'+target.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$',isUrlFilterCaseSensitive:true,resourceTypes:['main_frame']}}]});
 try{await api.tabs.update(sender.tab.id,{url:target});}catch(e){await api.declarativeNetRequest.updateSessionRules({removeRuleIds:[id]});throw e;}
 return {ok:true};
}
export function installWarningNavigation(api){
 api.runtime.onMessage.addListener((message,sender,respond)=>{if(message?.kind!=='warning_continue')return false;continueWarning(message,sender,api).then(respond).catch(()=>respond({error:'Could not continue to this site.'}));return true;});
 const clear=tabId=>{if(Number.isInteger(tabId)&&tabId>=0&&tabId<=1000000000)void api.declarativeNetRequest.updateSessionRules({removeRuleIds:[100000+tabId]}).catch(()=>{});};
 // Preserve explicit consent for this exact address until its tab closes.
 api.tabs?.onRemoved?.addListener(clear);
}
