// @vitest-environment jsdom
import {act} from 'react';import {createRoot} from 'react-dom/client';import {expect,it,vi} from 'vitest';import ConnectedVault from './views/ConnectedVault';import {demoCall} from './demo-bridge';import type {DemoState} from '@sentinel/contracts/generated/DemoState';
vi.mock('./demo-bridge',()=>({demoCall:vi.fn(async()=>({ok:true,password:'approved-fixture'}))}));(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
it('audits on demand, masks secrets, uses protected native actions and clears audit on unmount',async()=>{
 const state:DemoState={revision:0,mode:'synthetic_demo',connected:true,extensionId:'',unlocked:false,events:[],scan:null,accounts:[{id:'mail',name:'Orbit Mail',user:'alex@example.test',host:'mail.example.test',health:'Very weak',reused:true,reasons:['Avoid common password words.']}]};
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{await act(()=>root.render(<ConnectedVault state={state}/>));const click=async(text:string)=>act(async()=>{Array.from(host.querySelectorAll('button')).find(b=>b.textContent?.includes(text))!.click();});
 await act(()=>host.querySelector<HTMLButtonElement>('[aria-label="Check accounts"]')!.click());expect(host.querySelector('.pm-priority-high')).not.toBeNull();
 await click('Orbit Mail');expect(host.querySelector<HTMLInputElement>('[aria-label="Email"]')!.value).toBe('alex@example.test');
 await click('Show password');expect(host.querySelector<HTMLInputElement>('[aria-label="Password"]')!.value).toBe('approved-fixture');
 await act(()=>window.dispatchEvent(new Event('sentinel-clear-secrets')));expect(host.querySelector<HTMLInputElement>('[aria-label="Password"]')!.value).not.toBe('approved-fixture');
 await click('Copy password');expect(demoCall).toHaveBeenCalledWith('vault.copy',{id:'mail'});expect(host.textContent).not.toContain('invented-only');
 await click('Generate Replacement');expect(demoCall).toHaveBeenCalledWith('vault.rotate',{id:'mail'});
 await act(()=>host.querySelector<HTMLButtonElement>('[aria-label="Check accounts"]')!.click());expect(host.querySelector('.pm-priority-high')).toBeNull();
 expect(host.textContent).not.toContain('Unlock demo vault');expect(host.textContent).not.toContain('Generator & checker');
 expect(host.textContent).not.toContain('Local strength and reuse check');await click('Remove login');expect(demoCall).toHaveBeenCalledWith('vault.remove',{id:'mail'});
 }finally{await act(()=>root.unmount());host.remove();}
});
it('submits only login metadata through the protected add operation',async()=>{
 const state:DemoState={revision:0,mode:'synthetic_demo',connected:true,extensionId:'',unlocked:false,events:[],scan:null,accounts:[]};const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{await act(()=>root.render(<ConnectedVault state={state}/>));await act(()=>Array.from(host.querySelectorAll('button')).find(b=>b.textContent==='Add login')!.click());
 const fields=Array.from(host.querySelectorAll<HTMLFormElement>('form input'));for(const [index,value] of ['Notes','owner@example.test','notes.example.test'].entries())await act(()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(fields[index],value);fields[index].dispatchEvent(new Event('input',{bubbles:true}));});
 await act(()=>host.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));expect(demoCall).toHaveBeenCalledWith('vault.add',{name:'Notes',user:'owner@example.test',host:'notes.example.test'});expect(host.querySelector('form')).toBeNull();
 }finally{await act(()=>root.unmount());host.remove();}
});
it('native hiding revokes a pending reveal even if the window is reopened before completion',async()=>{
 const state:DemoState={revision:0,mode:'synthetic_demo',connected:true,extensionId:'',unlocked:false,events:[],scan:null,accounts:[{id:'mail',name:'Orbit Mail',user:'alex@example.test',host:'mail.example.test',health:'Very weak',reused:false,reasons:[]}]};
 let complete!:(value:unknown)=>void;vi.mocked(demoCall).mockImplementationOnce(()=>new Promise(resolve=>{complete=resolve;}));
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{await act(()=>root.render(<ConnectedVault state={state}/>));await act(()=>Array.from(host.querySelectorAll('button')).find(b=>b.textContent?.includes('Orbit Mail'))!.click());await act(()=>Array.from(host.querySelectorAll('button')).find(b=>b.textContent==='Show password')!.click());
 await act(()=>window.dispatchEvent(new Event('sentinel-clear-secrets')));await act(async()=>{complete({password:'late-secret'});});expect(host.querySelector<HTMLInputElement>('[aria-label="Password"]')!.value).not.toBe('late-secret');
 }finally{await act(()=>root.unmount());host.remove();}
});
