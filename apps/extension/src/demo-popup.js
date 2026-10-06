const $=id=>document.getElementById(id);
const call=async(method,data={})=>{const r=await chrome.runtime.sendMessage({kind:'demo_call',method,data});if(r?.error)throw new Error(r.error);return r?.data;};
let epoch=0,lastRevision=-1,lastUnlocked=false,busy=false,lastSignature='';
function clearSecrets(){epoch++;document.querySelectorAll('.demo-secret').forEach(e=>e.textContent='••••••••');}
async function refresh(){
 if(busy)return;busy=true;
 try{
  const state=await call('state');if(state?.mode!=='synthetic_demo'||!Array.isArray(state.accounts)||state.accounts.length>128)throw new Error('Invalid demo state.');
  if(lastRevision!==state.revision||lastUnlocked!==state.unlocked)clearSecrets();lastRevision=state.revision;lastUnlocked=state.unlocked;
  $('desktop-status').textContent='Desktop demo connected';$('demo-lock').textContent=state.unlocked?'Lock demo vault':'Unlock demo vault';$('demo-lock').disabled=false;
  const signature=JSON.stringify([state.accounts,state.unlocked,state.revision]);
  if(signature===lastSignature)return;lastSignature=signature;
  const list=$('demo-accounts');list.replaceChildren();
  for(const account of state.accounts){
   const item=document.createElement('article');item.className='vault-card';
   const heading=document.createElement('strong');heading.textContent=`${account.name} · ${account.health}${account.reused?' · REUSED':''}`;
   const identity=document.createElement('p');identity.textContent=`${account.user} · ${account.host}`;
   const reasons=document.createElement('p');reasons.textContent=account.reasons.join(' ') +(account.reused?' Use a different password for each account.':'');
   const secret=document.createElement('code');secret.className='demo-secret';secret.textContent='••••••••';
   const reveal=document.createElement('button');reveal.textContent='Show dummy password';reveal.disabled=!state.unlocked;
   reveal.onclick=async()=>{const turn=++epoch;try{const r=await call('reveal',{id:account.id});if(turn===epoch&&lastUnlocked&&secret.isConnected)secret.textContent=r.password;}catch{ $('demo-feedback').textContent='Reveal unavailable.';}};
   const rotate=document.createElement('button');rotate.textContent='Generate & save demo replacement';rotate.disabled=!state.unlocked;
   rotate.onclick=async()=>{clearSecrets();try{await call('rotate',{id:account.id});$('demo-feedback').textContent='Demo replacement saved. Website accounts were not changed.';await refresh();}catch{$('demo-feedback').textContent='Replacement unavailable.';}};
   item.append(heading,identity,reasons,secret,reveal,rotate);list.append(item);
  }
 }catch(error){clearSecrets();lastUnlocked=false;lastSignature='';$('desktop-status').textContent='Desktop disconnected';$('demo-lock').disabled=true;$('demo-accounts').replaceChildren();$('demo-feedback').textContent=error.message;}
 finally{busy=false;}
}
$('demo-extension-id').textContent=chrome.runtime.id;
$('demo-pair').onclick=async()=>{
 clearSecrets();const port=Number($('demo-port').value),token=$('demo-key').value.trim();
 if(!Number.isInteger(port)||port<1024||port>65535||!/^[a-f0-9]{64}$/.test(token)){ $('demo-pair-feedback').textContent='Enter the port and pairing key shown by the desktop.';return;}
 try{
  const allowed=await chrome.permissions.request({origins:['http://127.0.0.1/*']});if(!allowed)throw new Error('Local connection permission was declined.');
  await chrome.storage.session.set({sentinelDemoConnection:{port,token}});$('demo-key').value='';await refresh();$('demo-pair-feedback').textContent='Pairing saved for this browser session. Restarting the browser requires pairing again.';
 }catch(error){$('demo-pair-feedback').textContent=error.message;}
};
$('demo-disconnect').onclick=async()=>{clearSecrets();await chrome.storage.session.remove('sentinelDemoConnection');await refresh();};
$('demo-lock').onclick=async()=>{clearSecrets();try{await call(lastUnlocked?'lock':'unlock');await refresh();}catch{$('demo-feedback').textContent='Desktop unavailable.';}};
window.addEventListener('sentinel-local-assessment',event=>{const result=event.detail;void call('event',{risk:result.risk,codes:result.reasons.map(r=>r.code)}).catch(()=>{});});
window.addEventListener('pagehide',clearSecrets);document.addEventListener('visibilitychange',()=>{if(document.hidden)clearSecrets();});
void refresh();setInterval(()=>{if(!document.hidden)void refresh();},1500);
