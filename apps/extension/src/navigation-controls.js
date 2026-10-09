const button=document.getElementById('navigation-enable');const feedback=document.getElementById('navigation-status');
let current=false;
async function status(){
 try{const response=await chrome.runtime.sendMessage({kind:'navigation_status'});if(response?.error)throw new Error();current=response.active??response.enabled;button.textContent=current?'Pause automatic URL warnings':'Enable automatic URL warnings';feedback.textContent=(response.upgradeNeeded?'Older warning rules active — pause and enable to upgrade':current&&!response.siteAccess?'Warning rules present — site access missing':current?'Automatic URL warnings enabled':'Automatic URL warnings disabled')+' · '+response.domains+' risk-listed domains · '+response.listState+' snapshot ('+response.date.slice(0,10)+').';}
 catch{feedback.textContent='Automatic warning state unavailable.';}
}
button.onclick=async()=>{
 button.disabled=true;
 try{if(!current&&!await chrome.permissions.request({origins:['http://*/*','https://*/*']}))throw new Error('Site access was declined. Address-bar checks still work.');const r=await chrome.runtime.sendMessage({kind:'navigation_toggle',enabled:!current});if(r?.error)throw new Error(r.error);await status();}
 catch(e){feedback.textContent=e.message;}finally{button.disabled=false;}
};
void status();
