// @vitest-environment jsdom
import {act} from 'react';import {createRoot} from 'react-dom/client';import {expect,it,vi} from 'vitest';import ConnectedVault from './views/ConnectedVault';import {demoCall} from './demo-bridge';import type {DemoState} from '@sentinel/contracts/generated/DemoState';
vi.mock('./demo-bridge',()=>({demoCall:vi.fn(async()=>({ok:true}))}));(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
it('audits on demand, masks secrets, uses protected native actions and clears audit on unmount',async()=>{
 const state:DemoState={revision:0,mode:'synthetic_demo',connected:true,extensionId:'',unlocked:false,events:[],scan:null,accounts:[{id:'mail',name:'Orbit Mail',user:'alex@example.test',host:'mail.example.test',health:'Very weak',reused:true,reasons:['Avoid common password words.']}]};
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{await act(()=>root.render(<ConnectedVault state={state}/>));const click=async(text:string)=>act(async()=>{Array.from(host.querySelectorAll('button')).find(b=>b.textContent?.includes(text))!.click();});
 await act(()=>host.querySelector<HTMLButtonElement>('[aria-label="Check accounts"]')!.click());expect(host.querySelector('.pm-priority-high')).not.toBeNull();
 await click('Orbit Mail');expect(host.querySelector<HTMLInputElement>('[aria-label="Email"]')!.value).toBe('alex@example.test');
 await click('Copy password');expect(demoCall).toHaveBeenCalledWith('vault.copy',{id:'mail'});expect(host.textContent).not.toContain('invented-only');
 await click('Generate Replacement');expect(demoCall).toHaveBeenCalledWith('vault.rotate',{id:'mail'});
 await act(()=>host.querySelector<HTMLButtonElement>('[aria-label="Check accounts"]')!.click());expect(host.querySelector('.pm-priority-high')).toBeNull();
 expect(host.textContent).not.toContain('Unlock demo vault');expect(host.textContent).not.toContain('Generator & checker');
 }finally{await act(()=>root.unmount());host.remove();}
});
