import {openPasswordPanel} from './password-panel.js';
const ID='sentinel-passwords';
export function siteOrigin(value){const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password)throw Error('Use an HTTPS website.');return u.origin;}
export function createPasswordCompanion(api,request){
 const captures=new Map(),managers=new Map();let lastPrompt=0;
 function clean(){for(const [id,r]of captures)if(r.expiry<Date.now()){r.password='';captures.delete(id);}}
 async function current(row){const tab=await api.tabs.get(row.tab);if(siteOrigin(tab.url)!==row.origin)throw Error('The website changed. Try again.');return tab;}
 async function fillDocument(row,value){try{await current(row);
   await api.scripting.executeScript({target:{tabId:row.tab,documentIds:[row.document]},world:'ISOLATED',func:(origin,user,password,fieldId)=>{
    if(location.origin!==origin||window.top!==window)throw Error('Website changed.');
    const roots=[document],inputs=[];for(let i=0;i<roots.length&&i<64;i++)for(const n of roots[i].querySelectorAll('*')){if(n instanceof HTMLInputElement)inputs.push(n);if(n.shadowRoot&&roots.length<64)roots.push(n.shadowRoot);}
    const fields=inputs.filter(n=>n.type==='password'||n.type==='text'&&['current-password','new-password'].includes(n.autocomplete)).filter(n=>n.dataset.sentinelPasswordTarget===fieldId&&n.isConnected&&!n.disabled&&!n.readOnly&&n.getClientRects().length);const field=fields.length===1?fields[0]:null;
    if(!field)throw Error('Select a password field again.');
    const form=field.form||field.getRootNode(),logins=[...form.querySelectorAll('input')].filter(n=>n!==field&&!['current-password','new-password'].includes(n.autocomplete)&&['text','email'].includes(n.type)&&n.getClientRects().length&&!n.disabled&&!n.readOnly),login=logins.find(n=>n.autocomplete==='username'||n.type==='email')||logins.find(n=>/user|email|login|identifier/i.test(n.name+' '+n.id))||(logins.length===1?logins[0]:null);
    const set=(el,v)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));};
    if(user&&login)set(login,user);set(field,password);delete field.dataset.sentinelPasswordTarget;
   },args:[row.origin,value.user||'',value.password,row.fieldId]});
 }finally{value.password='';}}
 async function handle(message,sender){
  clean();if(sender.id!==api.runtime.id)throw Error('forbidden');
  const fieldPanel=sender.url?.split(/[?#]/)[0]===api.runtime.getURL('field-vault.html');
  const sharedVault=sender.url?.split(/[?#]/)[0]===api.runtime.getURL('src/console-ui/vault-console.html');
  const managerTab=Number.isInteger(sender.tab?.id)?sender.tab.id:-1,managerFrameId=Number.isInteger(sender.frameId)?sender.frameId:-1;
  const popup=fieldPanel||['popup.html','src/console-ui/vault-console.html'].some(path=>sender.url?.split(/[?#]/)[0]===api.runtime.getURL(path));
  if(!popup){
   if((await api.storage.local.get('passwordCompanion')).passwordCompanion!==true)throw Error('Password tools are disabled.');
   if(sender.frameId!==0||!Number.isInteger(sender.tab?.id)||typeof sender.documentId!=='string'||!await api.permissions.contains({origins:[siteOrigin(sender.url)+'/*']}))throw Error('forbidden');
   const origin=siteOrigin(sender.url);if(origin!==siteOrigin(sender.tab.url))throw Error('forbidden');
   if(message.action==='login_success'){
    const entry=[...captures].reverse().find(([,r])=>r.tab===sender.tab.id&&(r.document===sender.documentId||message.afterNavigation===true)&&r.origin===origin&&r.password);
    if(!entry)return {ok:true};const [id,row]=entry;
    await request('save',{origin:row.origin,name:new URL(row.origin).hostname,user:row.user,password:row.password});row.password='';captures.delete(id);return {saved:true};
   }
   if(message.action==='resume'){const pending=[...captures].reverse().find(([,r])=>r.tab===sender.tab.id&&r.password);if(pending)await openPasswordPanel(api,sender.tab.id,pending[0]);return {ok:true};}
   if(!['capture','generator'].includes(message.action))throw Error('forbidden');
   if(message.action==='generator'&&!/^[a-f0-9]{32}$/.test(message.fieldId||''))throw Error('Select a password field again.');
   if(message.action==='capture'&&(typeof message.user!=='string'||message.user.length>254||!message.user.trim()||typeof message.password!=='string'||message.password.length>256||!message.password))throw Error('invalid_login');
   if(message.action==='capture'){try{const equal=await request('matches',{origin,user:message.user,password:message.password});if(equal.matches===true)return {unchanged:true};}catch{/* A comparison outage must not discard a submitted login. */}}
   if(Date.now()-lastPrompt<3000)throw Error('Try again shortly.');lastPrompt=Date.now();
   if(captures.size>=8)throw Error('Close an existing password prompt first.');
   const id=crypto.randomUUID(),row={tab:sender.tab.id,document:sender.documentId,origin,fieldId:message.fieldId||null,newPassword:message.newPassword===true,user:message.user||'',password:message.password||'',expiry:Date.now()+120000};captures.set(id,row);
   try{await openPasswordPanel(api,row.tab,id,row.fieldId);}catch{/* Pending capture stays in trusted session storage until the user opens the panel. */}return {ok:true};
  }
  if(popup&&!fieldPanel&&message.action==='manager-open'){
   if(typeof sender.documentId!=='string'||(!sharedVault&&(managerTab<0||managerFrameId<=0))||(managerTab>=0&&managerFrameId<0))throw Error('forbidden');
   for(const [id,g]of managers)if(g.expiry<Date.now()||g.tab===managerTab&&g.document===sender.documentId)managers.delete(id);
   if(managers.size>=8)throw Error('Close an existing vault panel first.');
   const manager=crypto.randomUUID();managers.set(manager,{tab:managerTab,frame:managerFrameId,document:sender.documentId,expiry:Date.now()+600000});return {manager,expires:Date.now()+600000};
  }
  const grant=managers.get(message.manager),managerFrame=popup&&!fieldPanel&&grant&&grant.expiry>Date.now()&&grant.tab===managerTab&&grant.frame===managerFrameId&&grant.document===sender.documentId;
  if(fieldPanel){
   const bound=captures.get(message.ref);
   if(!['details','autofill','accounts','fill','generate','save','dismiss'].includes(message.action)||!bound||sender.tab?.id!==bound.tab||!Number.isInteger(sender.frameId)||sender.frameId<=0||new URL(sender.url).searchParams.get('ref')!==message.ref)throw Error('forbidden');
   if((await api.storage.local.get('passwordCompanion')).passwordCompanion!==true||!await api.permissions.contains({origins:[bound.origin+'/*']}))throw Error('Password tools are disabled.');
   if(!bound.password||!['details','save','dismiss'].includes(message.action))await current(bound);
  }else if(!managerFrame&&(sharedVault||sender.frameId!==undefined&&sender.frameId!==0))throw Error('Open the vault in Chrome’s password popup.');
  if(managerFrame&&!['vault','enable','disable'].includes(message.action))throw Error('forbidden');
  if(message.action==='enable'){
   if(managerFrame)message={...message,tabId:grant.tab};
   const origins=['https://*/*'];if(!await api.permissions.contains({origins}))throw Error('Website permission is required.');
   if(!(await api.scripting.getRegisteredContentScripts({ids:[ID]})).length)await api.scripting.registerContentScripts([{id:ID,matches:origins,js:['src/password-content.js'],runAt:'document_idle',allFrames:false}]);await api.storage.local.set({passwordCompanion:true});if(Number.isInteger(message.tabId)&&message.tabId>=0){try{const tab=await api.tabs.get(message.tabId);siteOrigin(tab.url);await api.scripting.executeScript({target:{tabId:message.tabId,frameIds:[0]},world:'ISOLATED',files:['src/password-content.js']});}catch{/* Registered script applies on the next supported navigation. */}}return {ok:true};
  }
  if(message.action==='disable'){await api.scripting.unregisterContentScripts({ids:[ID]}).catch(()=>{});await api.storage.local.set({passwordCompanion:false});for(const row of captures.values())row.password='';captures.clear();return {ok:true};}
  if(message.action==='vault'){
   if(!['status','unlock','lock','list','fill','save','remove','edit','copy'].includes(message.operation))throw Error('forbidden');return request(message.operation,message.data||{});
  }
  const row=captures.get(message.ref);if(!row)throw Error('This password request expired. Return to the website.');
  if(['accounts','fill','generate','autofill'].includes(message.action)){await current(row);if(!/^[a-f0-9]{32}$/.test(row.fieldId||''))throw Error('Select a password field again.');}
  if(message.action==='details')return {origin:row.origin,user:row.user,hasPassword:!!row.password,newPassword:row.newPassword===true,...await request('status',{})};
  if(message.action==='dismiss'){row.password='';captures.delete(message.ref);return {ok:true};}
  if(message.action==='save'){
   if(!row.password)throw Error('No submitted password.');const result=await request('save',{origin:row.origin,name:new URL(row.origin).hostname,user:row.user,password:row.password});row.password='';captures.delete(message.ref);return result;
  }
  if(message.action==='autofill'){if(row.password||row.newPassword)throw Error('Choose a password for this field.');const value=await request('autofill',{origin:row.origin});if(value.automatic===true){await fillDocument(row,value);captures.delete(message.ref);return {filled:true};}return {accounts:value.accounts||[]};}
  if(message.action==='accounts')return request('list',{});
  if(message.action==='fill'||message.action==='generate'){
   let value;if(message.action==='fill')value=await request('fill',{id:message.id,origin:row.origin});
   else {if(typeof message.password!=='string'||message.password.length<12||message.password.length>48||/[\x00-\x1f\x7f]/.test(message.password))throw Error('Invalid generated password.');value={password:message.password};}
   await fillDocument(row,value);
   value.password='';captures.delete(message.ref);return {ok:true};
  }
  throw Error('unsupported');
 }
 let tail=Promise.resolve(),queued=0;
 return (message,sender)=>{
  if(queued>=16)return Promise.reject(Error('Password manager busy.'));queued++;
  const task=tail.then(async()=>{
   const session=api.storage.session,key='sentinelPasswordPendingV1';
   if(session){await session.setAccessLevel?.({accessLevel:'TRUSTED_CONTEXTS'});const grants=(await session.get('sentinelPasswordManagersV1')).sentinelPasswordManagersV1;managers.clear();if(Array.isArray(grants)&&grants.length<=8)for(const [id,g]of grants)if(typeof id==='string'&&g&&Number.isInteger(g.tab)&&Number.isInteger(g.frame)&&typeof g.document==='string'&&Number.isFinite(g.expiry))managers.set(id,g);const rows=(await session.get(key))[key];captures.clear();if(Array.isArray(rows)&&rows.length<=8)for(const [id,row]of rows){if(typeof id==='string'&&row&&typeof row.origin==='string'&&typeof row.password==='string'&&row.password.length<=256&&typeof row.user==='string'&&row.user.length<=254&&(row.fieldId===null||/^[a-f0-9]{32}$/.test(row.fieldId||''))&&Number.isInteger(row.tab)&&typeof row.document==='string'&&Number.isFinite(row.expiry))captures.set(id,row);}}
   clean();try{return await handle(message,sender);}finally{clean();if(session)await session.set({[key]:[...captures],sentinelPasswordManagersV1:[...managers]});}
  }).finally(()=>{queued--;});tail=task.catch(()=>{});return task;
 };
}
async function nativeRequest(action,data){
 const result=await chrome.runtime.sendNativeMessage('com.looptryx.sentinel',{operation:'vault',action,data});
 if(!result||result.error)throw Error(result?.error||'Vault unavailable.');return result;
}
export const passwordCompanion=globalThis.chrome?createPasswordCompanion(chrome,nativeRequest):null;
