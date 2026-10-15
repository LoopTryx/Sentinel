import {emailOrigins} from './control.js';
if(new URL(location.href).searchParams.get('view')==='settings'){
 for(const tab of document.querySelectorAll('[data-view]'))tab.setAttribute('aria-pressed',String(tab.dataset.view==='settings'));
 for(const panel of document.querySelectorAll('[data-panel]'))panel.hidden=panel.dataset.panel!=='settings';
}
const send=message=>chrome.runtime.sendMessage(message);
for(const button of document.querySelectorAll('[data-email-provider]')){
 const provider=button.dataset.emailProvider;
 const reader=document.createElement('p');reader.setAttribute('role','status');button.after(reader);
 const render=(enabled,state)=>{button.dataset.enabled=String(enabled);button.textContent=`${provider==='gmail'?'Gmail':'Outlook'}: ${enabled?'on':'off'}`;reader.textContent=!enabled?'':({partial:'Reading supported emails · partial coverage',unsupported_open_layout:'This email layout is unsupported',no_supported_open_message:'Open an email to check it',paused:'Reader paused while the tab is hidden',extraction_unavailable:'Email reader unavailable',consumer_unavailable:'Email checker unavailable'}[state]||'Open or refresh an email to check it');};
 send({kind:'email_status',provider}).then(s=>render(s?.enabled===true,s?.reader)).catch(()=>render(false));
 button.addEventListener('click',async()=>{
  const enabled=button.dataset.enabled!=='true';button.disabled=true;
  try{if(enabled&&!await chrome.permissions.request({permissions:['scripting'],origins:emailOrigins[provider]}))return;const result=await send({kind:'email_toggle',provider,enabled});if(result?.error)throw new Error();render(result.enabled,result.reader);}catch{document.getElementById('email-feedback').textContent='Email settings unavailable. Try again.';}finally{button.disabled=false;}
 });
}
const feedback=document.getElementById('email-feedback'),list=document.getElementById('email-trusted');
async function refresh(){const state=await send({kind:'email_senders'});list.replaceChildren();for(const address of state?.trusted||[]){const row=document.createElement('li'),remove=document.createElement('button');row.textContent=address+' ';remove.type='button';remove.textContent='Remove';remove.addEventListener('click',async()=>{await send({kind:'email_untrust',address});await refresh();});row.append(remove);list.append(row);}}
document.getElementById('email-trust-form').addEventListener('submit',async event=>{event.preventDefault();const input=document.getElementById('email-address');try{const result=await send({kind:'email_trust',address:input.value.trim()});if(result?.error)throw new Error();input.value='';feedback.textContent='Sender trusted. Requests for secrets or payment can still warn.';await refresh();}catch{feedback.textContent='Could not add that sender.';}});
document.getElementById('email-clear').addEventListener('click',async()=>{await send({kind:'email_clear'});await refresh();feedback.textContent='Email sender history cleared.';});
void refresh().catch(()=>{});
