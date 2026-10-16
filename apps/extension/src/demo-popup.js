const $=id=>document.getElementById(id);
const call=async(method,data={})=>{const r=await chrome.runtime.sendMessage({kind:'demo_call',method,data});if(r?.error)throw Error(r.error);return r?.data;};
let busy=false,lastSignature='',checking=false;
function priority(a){return a.reused||['Weak','Very weak'].includes(a.health)?'high':a.health==='Stronger'?'low':['Moderate','Fair','Good'].includes(a.health)?'medium':'unknown';}
function paint(){for(const card of document.querySelectorAll('.vault-card'))card.dataset.priority=checking?card.dataset.audit:'';$('check-accounts').setAttribute('aria-pressed',String(checking));$('demo-accounts').classList.toggle('checking',checking);}
async function refresh(){if(busy)return;busy=true;try{
 const state=await call('state');if(state?.mode!=='synthetic_demo'||!Array.isArray(state.accounts)||state.accounts.length>128)throw Error('Invalid state');
 $('desktop-status').textContent='Console connected';document.body.dataset.connected='true';
 const signature=JSON.stringify([state.accounts,state.revision]);if(signature===lastSignature)return;lastSignature=signature;
 const list=$('demo-accounts');list.replaceChildren();
 for(const account of state.accounts){const card=document.createElement('article');card.className='vault-card';card.dataset.audit=priority(account);card.dataset.search=JSON.stringify([account.name,account.user,account.host]).toLowerCase();
  const heading=document.createElement('strong');heading.textContent=account.name;
  const fields=document.createElement('div');fields.className='account-fields';
  for(const [label,value] of [['Email',account.user],['Website',account.host],['Password','••••••••••••']]){const wrapper=document.createElement('label');wrapper.textContent=label;const field=document.createElement('input');field.readOnly=true;field.value=value;field.setAttribute('aria-label',label);if(label==='Password')field.type='password';wrapper.append(field);fields.append(wrapper);}
  const health=document.createElement('p');health.className='account-health';health.textContent=account.health+(account.reused?' · Reused':'');health.title=account.reasons.join(' ');
  const actions=document.createElement('div');actions.className='actions';
  for(const [label,method] of [['Copy password','vault.copy'],['Generate Replacement','vault.rotate']]){const button=document.createElement('button');button.textContent=label;button.onclick=async()=>{if(busy)return;busy=true;actions.querySelectorAll('button').forEach(b=>b.disabled=true);$('demo-feedback').textContent='Approve the Windows prompt to continue.';try{await call(method,{id:account.id});$('demo-feedback').textContent=method==='vault.copy'?'Password copied.':'Replacement saved.';lastSignature='';}catch{$('demo-feedback').textContent='Windows approval declined or action unavailable.';}finally{busy=false;actions.querySelectorAll('button').forEach(b=>b.disabled=false);void refresh();}};actions.append(button);}
  card.append(heading,fields,health,actions);list.append(card);
 }
 paint();filter();
 }catch{$('desktop-status').textContent='Waiting for console';document.body.dataset.connected='false';lastSignature='';$('demo-accounts').replaceChildren();$('demo-feedback').textContent='Automatic connection unavailable. Open Sentinel and reload this extension.';}finally{busy=false;}}
function filter(){const query=$('account-search').value.toLowerCase();for(const card of document.querySelectorAll('.vault-card'))card.hidden=!card.dataset.search.includes(query);}
$('account-search').addEventListener('input',filter);
$('check-accounts').onclick=()=>{checking=!checking;paint();};
for(const tab of document.querySelectorAll('[data-view]'))tab.addEventListener('click',()=>{checking=false;paint();});
$('demo-extension-id').textContent=chrome.runtime.id;
$('copy-extension-id').onclick=async()=>{await navigator.clipboard.writeText(chrome.runtime.id);$('copy-extension-id').textContent='Copied';};
$('demo-reconnect').onclick=()=>{lastSignature='';void refresh();};
window.addEventListener('pagehide',()=>{checking=false;});
void refresh();setInterval(()=>{if(!document.hidden)void refresh();},1500);
