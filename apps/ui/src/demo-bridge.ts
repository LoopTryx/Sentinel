import {useEffect, useState} from 'react';
import type {DemoState} from '@sentinel/contracts/generated/DemoState';
import {isDemoState} from './demo-state';
type NativePort={postMessage:(message:string)=>void;addEventListener:(kind:string,handler:(e:{data:unknown})=>void)=>void};
const port=()=> (window as unknown as {chrome?:{webview?:NativePort}}).chrome?.webview;
let serial=0, listening=false;
const pending=new Map<string,{resolve:(data:any)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
export function demoCall(method:string,data:Record<string,unknown>={}):Promise<any>{
 const native=typeof window==='undefined'?undefined:port();
 if(!native)return Promise.reject(new Error('Desktop demo runtime unavailable.'));
 if(!listening){native.addEventListener('message',e=>{const message=e.data as {id?:string;data?:unknown;kind?:string};if(message?.kind==='vault-clear'){window.dispatchEvent(new Event('sentinel-clear-secrets'));return;}if(typeof message?.id!=='string')return;const request=pending.get(message.id);if(!request)return;clearTimeout(request.timer);pending.delete(message.id);const value=message.data as {error?:string};if(typeof value?.error==='string')request.reject(new Error(value.error));else request.resolve(value);});listening=true;}
 if(pending.size>=4)return Promise.reject(new Error('Desktop busy. Try again.'));
 const id='demo_'+(++serial);
 return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(new Error('Desktop connection timed out.'));},method.startsWith('usb.admission.')||method==='usb.ducky.block'||method==='usb.ducky.allow'||method==='usb.admission.open'?150000:method==='scan.select'?300000:method.startsWith('quarantine.')||method==='restore.request'||method.startsWith('vault.')?75000:10000);pending.set(id,{resolve,reject,timer});try{native.postMessage(JSON.stringify({id,method,data}));}catch{clearTimeout(timer);pending.delete(id);reject(new Error('Desktop unavailable.'));}});
}
export function useDemoState(){
 const [state,setState]=useState<DemoState|null>(null);
 const [error,setError]=useState('');
 useEffect(()=>{if(!port())return;let live=true,busy=false;async function poll(){if(busy)return;busy=true;try{const data=await demoCall('state');if(!isDemoState(data))throw new Error('Invalid demo state.');if(live){setState(data);setError('');}}catch(e){if(live){setState(null);setError(e instanceof Error?e.message:'Disconnected');}}finally{busy=false;}}void poll();const timer=setInterval(poll,900);return()=>{live=false;clearInterval(timer);};},[]);
 return {state,error};
}
