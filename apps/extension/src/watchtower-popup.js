import {forgetWatchtowerHostnames} from './watchtower-share.js';
const checkbox=document.getElementById('watchtower-share'),feedback=document.getElementById('watchtower-share-status');
if(checkbox){
 chrome.storage.local.get('watchtowerShareHostnames').then(value=>{checkbox.checked=value.watchtowerShareHostnames===true;});
 checkbox.addEventListener('change',async()=>{checkbox.disabled=true;try{
  if(checkbox.checked&&!await chrome.permissions.request({origins:['http://*/*','https://*/*']}))throw Error();
  await chrome.storage.local.set({watchtowerShareHostnames:checkbox.checked});if(!checkbox.checked)void forgetWatchtowerHostnames(chrome).catch(()=>{});feedback.textContent=checkbox.checked?'Sharing hostnames with the paired local desktop. No paths, page content or private tabs.':'Hostname sharing off.';
 }catch{checkbox.checked=false;feedback.textContent='Permission declined. Hostname sharing stays off.';}finally{checkbox.disabled=false;}});
}
