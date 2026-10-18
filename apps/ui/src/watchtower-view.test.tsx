// @vitest-environment jsdom
import {act} from 'react';import {createRoot} from 'react-dom/client';import {expect,it,vi} from 'vitest';
import WatchtowerView from './views/WatchtowerView';import {demoCall} from './demo-bridge';
vi.mock('./demo-bridge',()=>({demoCall:vi.fn()}));vi.mock('./use-auto-refresh',()=>({useAutoRefresh:()=>{}}));
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
it('shows hostname evidence without turning DNS cache into browsing or protection claims',async()=>{
 vi.mocked(demoCall).mockResolvedValue({version:1,coverage:'passive',observedAt:new Date().toISOString(),observation:{},checks:[],limitations:[],destinations:{dnsStatus:'available',connectionStatus:'unavailable',domains:[{domain:'paypa1-login.top',tier:'Likely Malicious',score:13,reasons:[{code:'lookalike',text:'Known-brand lookalike outside official domains.'}]}],connections:[],limitations:['No external lookup or blocking.']}});
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{await act(()=>root.render(<WatchtowerView/>));await act(async()=>{host.querySelector('button')!.click();});expect(demoCall).toHaveBeenCalledWith('wifi.assess');expect(host.textContent).toContain('Likely Malicious');expect(host.textContent).toContain('not proof of a website visit');expect(host.textContent).toContain('Blocking is not enabled');expect(host.querySelector('a')).toBeNull();}finally{await act(()=>root.unmount());host.remove();}
});
