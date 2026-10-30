import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import ConnectedVault from './views/ConnectedVault';
import PasswordView from './views/PasswordView';
import {generateReplacement} from './replacement-generator';
import type{DemoState}from'@sentinel/contracts/generated/DemoState';
import './fonts.css';import './styles.css';import './theme.css';import './readability.css';import './extension-vault.css';

declare const chrome:{runtime:{sendMessage:(data:unknown)=>Promise<any>;getURL:(path:string)=>string};permissions:{request:(data:{origins:string[]})=>Promise<boolean>}};
const parameters=new URLSearchParams(location.search),generator=parameters.get('generator')==='1';
let manager='',expires=0,protectedInFlight=0;let disposed=false;let catalog:DemoState['accounts']=[];
const send=async(message:Record<string,unknown>)=>{let response;try{response=await chrome.runtime.sendMessage({kind:'password_companion',...message,...(manager?{manager}:{})});}catch(error){if(/context invalidated|receiving end does not exist/i.test(error instanceof Error?error.message:''))throw Error('Sentinel was updated. Refresh this website tab and reopen Passwords.');throw error;}if(!response||response.error)throw Error(response?.error||'Open Sentinel to connect.');return response;};
async function vault(operation:string,data:Record<string,unknown>={}){
 if(!manager||Date.now()>=expires){const grant=await send({action:'manager-open'});manager=grant.manager;expires=grant.expires;}
 const protectedAction=!['status','list','matches','lock'].includes(operation);if(protectedAction)protectedInFlight++;
 let response:any;try{response=await send({action:'vault',operation,data});if(typeof response.password==='string'){
  if(disposed)throw Error('Password view closed.');
  if(document.hidden||!document.hasFocus())await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>{cleanup();reject(Error('Return to Sentinel and try again.'));},5000);const ready=()=>{if(disposed||document.hidden)return;if(document.hasFocus()){cleanup();resolve();}};const cleanup=()=>{clearTimeout(timer);window.removeEventListener('focus',ready);document.removeEventListener('visibilitychange',ready);};window.addEventListener('focus',ready);document.addEventListener('visibilitychange',ready);ready();});
  if(disposed||document.hidden)throw Error('Password view closed.');
 }if(Array.isArray(response.accounts))catalog=response.accounts;return response;}catch(error){if(response&&typeof response.password==='string')response.password='';throw error;}finally{if(protectedAction)protectedInFlight--;}
}
const origin=(host:unknown)=>{if(typeof host!=='string')throw Error('Enter a website.');const url=new URL(host.includes('://')?host:'https://'+host);if(url.protocol!=='https:'||url.username||url.password)throw Error('Use an HTTPS website.');return url.origin;};
async function call(method:string,data:Record<string,unknown>={}){
 if(method==='password.vault')return vault(String(data.action),(data.data||{})as Record<string,unknown>);
 const account=catalog.find(a=>a.id===data.id)as (DemoState['accounts'][number]&{origin?:string})|undefined;
 if(method==='vault.view'){if(!account)throw Error('Login unavailable.');return vault('fill',{id:account.id,origin:account.origin||origin(account.host)});}
 if(method==='vault.copy')return vault('copy',{id:data.id});
 if(method==='vault.remove')return vault('remove',{id:data.id});
 if(method==='vault.add')return vault('save',{origin:origin(data.host),name:data.name,user:data.user,password:data.password||generateReplacement(24,true,true,true)});
 if(method==='vault.update')return vault('edit',{id:data.id,patch:{origin:origin(data.host),name:data.name,user:data.user,...(typeof data.password==='string'?{password:data.password}:{})}});
 throw Error('Unsupported password action.');
}
const state:DemoState={revision:0,mode:'encrypted_vault',connected:true,unlocked:false,extensionId:'',accounts:[],events:[],scan:null};
function useGenerated(password:string){if(window.parent!==window)window.parent.postMessage({kind:'sentinel-generated-password',password},location.origin);}
function BrowserVault(){const[notice,setNotice]=useState('');async function tools(enable:boolean){try{if(enable&&!await chrome.permissions.request({origins:['https://*/*']}))throw Error('Website permission was not granted.');await vault('status');await send({action:enable?'enable':'disable'});setNotice(enable?'Website tools enabled.':'Website tools disabled.');}catch(error){setNotice(error instanceof Error?error.message:'Website tools unavailable.');}}return <><ConnectedVault state={state} call={call}/><details className="pm-footnote"><summary>Website tools</summary><p>Save sign-ins and fill logins on websites you approve.</p><button className="btn ghost" onClick={()=>void tools(true)}>Enable website tools</button> <button className="btn ghost" onClick={()=>void tools(false)}>Disable website tools</button>{notice&&<p role="status">{notice}</p>}</details></>;}
createRoot(document.getElementById('root')!).render(generator?<div className="shared-generator"><PasswordView onUse={useGenerated}/></div>:<BrowserVault/>);
const clear=()=>window.dispatchEvent(new Event('sentinel-clear-secrets'));window.addEventListener('blur',()=>{if(!protectedInFlight)clear();});window.addEventListener('pagehide',()=>{disposed=true;clear();});document.addEventListener('visibilitychange',()=>{if(document.hidden)window.dispatchEvent(new Event(protectedInFlight?'sentinel-hide-secrets':'sentinel-clear-secrets'));});
// The host checks both this extension origin and this exact child window.
new ResizeObserver(()=>window.parent.postMessage({kind:'sentinel-console-size',height:Math.min(900,Math.ceil(document.documentElement.scrollHeight))},location.origin)).observe(document.getElementById('root')!);
