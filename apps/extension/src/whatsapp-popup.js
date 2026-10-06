import {WHATSAPP_PERMISSION} from './whatsapp-control.js';
const button=document.getElementById('whatsapp-enable'),feedback=document.getElementById('whatsapp-status');
let enabled=false;
async function status(){try{const state=await chrome.runtime.sendMessage({kind:'whatsapp_status'});if(state?.error)throw new Error(state.error);enabled=state.enabled;button.textContent=enabled?'Pause WhatsApp warnings':'Enable WhatsApp warnings';feedback.textContent=enabled?'Enabled for supported incoming WhatsApp Web messages. Local checks only.':'WhatsApp inline warnings off.';}catch{feedback.textContent='WhatsApp capability unavailable.';}}
button.onclick=async()=>{button.disabled=true;try{if(!enabled&&!await chrome.permissions.request(WHATSAPP_PERMISSION))throw new Error('WhatsApp site access was declined.');const state=await chrome.runtime.sendMessage({kind:'whatsapp_toggle',enabled:!enabled});if(state?.error)throw new Error(state.error);await status();if(state.unavailableTabs)feedback.textContent+=' Reload WhatsApp to attach the observer.';}catch(e){feedback.textContent=e.message;}finally{button.disabled=false;}};
void status();
