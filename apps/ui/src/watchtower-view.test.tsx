// @vitest-environment jsdom
import {act} from 'react';import {createRoot} from 'react-dom/client';import {expect,it,vi} from 'vitest';
import WatchtowerView from './views/WatchtowerView';import {demoCall} from './demo-bridge';
vi.mock('./demo-bridge',()=>({demoCall:vi.fn()}));vi.mock('./use-auto-refresh',()=>({useAutoRefresh:()=>{}}));
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
it('shows hostname evidence without turning DNS cache into browsing or protection claims',async()=>{
 vi.mocked(demoCall).mockResolvedValue({version:1,coverage:'passive',observedAt:new Date().toISOString(),observation:{},checks:[],limitations:[],destinations:{dnsStatus:'available',connectionStatus:'unavailable',domains:[{domain:'paypa1-login.top',tier:'Likely Malicious',score:13,reasons:[{code:'lookalike',text:'Known-brand lookalike outside official domains.'}]}],connections:[],limitations:['No external lookup or blocking.']}});
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{await act(()=>root.render(<WatchtowerView/>));await act(async()=>{host.querySelector('button')!.click();});expect(demoCall).toHaveBeenCalledWith('wifi.assess');expect(host.textContent).toContain('Likely Malicious');expect(host.textContent).toContain('not proof of a website visit');expect(host.textContent).toContain('Blocking is not enabled');expect(host.querySelector('a')).toBeNull();const trust=Array.from(host.querySelectorAll('button')).find(button=>button.textContent==='Acknowledge warning')!;await act(async()=>trust.click());expect(demoCall).toHaveBeenCalledWith('watchtower.preference',{host:'paypa1-login.top',choice:'allow_once'});expect(host.textContent).toContain('It has not blocked these connections');}finally{await act(()=>root.unmount());host.remove();}
});

it('puts open Wi-Fi guidance ahead of routine domains and collapses unflagged observations',async()=>{
 vi.mocked(demoCall).mockResolvedValue({version:1,coverage:'passive',observedAt:new Date().toISOString(),observation:{connection:'wifi',security:'open',profile:'private',gateway:'configured',dns:'configured'},checks:[{level:'warn',title:'Open Wi-Fi',detail:'The wireless link has no encryption.'}],limitations:[],destinations:{dnsStatus:'available',connectionStatus:'available',domains:[{domain:'example.org',tier:'Safe',score:0,reasons:[]}],connections:[],limitations:[]}});
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{await act(()=>root.render(<WatchtowerView/>));await act(async()=>{host.querySelector('button')!.click();});expect(host.textContent).toContain('Before you use this network');expect(host.textContent).toContain('Use a trusted connection for sensitive work');const routine=host.querySelector('details.watchtower-routine') as HTMLDetailsElement;expect(routine).not.toBeNull();expect(routine.open).toBe(false);expect(routine.textContent).toContain('example.org');expect(host.textContent).not.toContain('Always trust');expect(host.textContent).not.toContain('Block unavailable');}finally{await act(()=>root.unmount());host.remove();}
});


it('keeps saved warning exceptions visible and removable',async()=>{
 vi.mocked(demoCall).mockResolvedValue({version:1,coverage:'passive',observedAt:new Date().toISOString(),observation:{connection:'ethernet'},checks:[],limitations:[],destinations:{dnsStatus:'available',connectionStatus:'available',domains:[],connections:[],limitations:[],preferences:{trusted:['example.org'],blockingAvailable:false}}});
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{await act(()=>root.render(<WatchtowerView/>));await act(async()=>{host.querySelector('button')!.click();});expect(host.textContent).toContain('Previously trusted domains');const button=Array.from(host.querySelectorAll('button')).find(b=>b.textContent==='Remove trust')!;await act(async()=>button.click());expect(demoCall).toHaveBeenCalledWith('watchtower.preference',{host:'example.org',choice:'untrust'});}finally{await act(()=>root.unmount());host.remove();}
});
