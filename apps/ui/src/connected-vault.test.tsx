// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import ConnectedVault from './views/ConnectedVault';
import type {DemoState} from '@sentinel/contracts/generated/DemoState';
vi.mock('./demo-bridge',()=>({demoCall:vi.fn(async()=>({password:'invented-only'}))}));
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
it('renders computed weakness and recommendations, and clears revealed dummy on lock',async()=>{
 const state:DemoState={revision:0,mode:'synthetic_demo',connected:true,extensionId:'',unlocked:true,events:[],scan:null,accounts:[{id:'mail',name:'Orbit Mail',user:'alex@example.test',host:'mail.example.test',health:'Very weak',reused:true,reasons:['Avoid common password words.']}]};
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{
  await act(()=>root.render(<ConnectedVault state={state}/>));
  const click=async(text:string)=>act(async()=>{Array.from(host.querySelectorAll('button')).find(b=>b.textContent?.includes(text))!.click();});
  await click('Orbit Mail');expect(host.textContent).toContain('Avoid common password words.');expect(host.textContent).toContain('Give every account its own password.');
  await click('Show dummy password');expect(host.textContent).toContain('invented-only');
  await act(()=>root.render(<ConnectedVault state={{...state,unlocked:false}}/>));expect(host.textContent).not.toContain('invented-only');expect(host.textContent).toContain('synthetic passwords only');
 }finally{await act(()=>root.unmount());host.remove();}
});
