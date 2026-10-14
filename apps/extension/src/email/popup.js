import {emailOrigins} from './control.js';
const send=message=>chrome.runtime.sendMessage(message);
for(const button of document.querySelectorAll('[data-email-provider]')){
 const provider=button.dataset.emailProvider;
 const render=enabled=>{button.dataset.enabled=String(enabled);button.textContent=`${provider==='gmail'?'Gmail':'Outlook'}: ${enabled?'on':'off'}`;};
 send({kind:'email_status',provider}).then(s=>render(s?.enabled===true)).catch(()=>render(false));
 button.addEventListener('click',async()=>{
  const enabled=button.dataset.enabled!=='true';button.disabled=true;
  try{if(enabled&&!await chrome.permissions.request({permissions:['scripting'],origins:emailOrigins[provider]}))return;const result=await send({kind:'email_toggle',provider,enabled});if(result?.error)throw new Error();render(result.enabled);}catch{document.getElementById('email-feedback').textContent='Email settings unavailable. Try again.';}finally{button.disabled=false;}
 });
}
const feedback=document.getElementById('email-feedback'),list=document.getElementById('email-trusted');
async function refresh(){const state=await send({kind:'email_senders'});list.replaceChildren();for(const address of state?.trusted||[]){const row=document.createElement('li'),remove=document.createElement('button');row.textContent=address+' ';remove.type='button';remove.textContent='Remove';remove.addEventListener('click',async()=>{await send({kind:'email_untrust',address});await refresh();});row.append(remove);list.append(row);}}
document.getElementById('email-trust-form').addEventListener('submit',async event=>{event.preventDefault();const input=document.getElementById('email-address');try{const result=await send({kind:'email_trust',address:input.value.trim()});if(result?.error)throw new Error();input.value='';feedback.textContent='Sender trusted. Requests for secrets or payment can still warn.';await refresh();}catch{feedback.textContent='Could not add that sender.';}});
document.getElementById('email-clear').addEventListener('click',async()=>{await send({kind:'email_clear'});await refresh();feedback.textContent='Email sender history cleared.';});
void refresh().catch(()=>{});
