import {emailOrigins} from './control.js';
if(new URL(location.href).searchParams.get('view')==='settings'){
 for(const tab of document.querySelectorAll('[data-view]'))tab.setAttribute('aria-pressed',String(tab.dataset.view==='settings'));
 for(const panel of document.querySelectorAll('[data-panel]'))panel.hidden=panel.dataset.panel!=='settings';
}
const send=message=>chrome.runtime.sendMessage(message);
for(const button of document.querySelectorAll('[data-email-provider]')){
 const provider=button.dataset.emailProvider;
 const render=enabled=>{button.dataset.enabled=String(enabled);button.setAttribute('aria-checked',String(enabled));button.setAttribute('aria-label',`${provider==='gmail'?'Gmail':'Outlook'} warnings`);};
 send({kind:'email_status',provider}).then(s=>render(s?.enabled===true,s?.reader)).catch(()=>render(false));
 button.addEventListener('click',async()=>{
  const enabled=button.dataset.enabled!=='true';button.disabled=true;
  try{if(enabled&&!await chrome.permissions.request({permissions:['scripting'],origins:emailOrigins[provider]}))return;const result=await send({kind:'email_toggle',provider,enabled});if(result?.error)throw new Error();render(result.enabled,result.reader);}catch{const feedback=document.getElementById('email-feedback');feedback.hidden=false;feedback.textContent='Could not update email warnings. Try again.';}finally{button.disabled=false;}
 });
}
