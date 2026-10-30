// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import Dashboard from './Dashboard';
import {demoCall} from '../demo-bridge';
vi.mock('../demo-bridge',()=>({demoCall:vi.fn(),useDemoState:()=>({state:{events:[]},error:''})}));
vi.mock('../state',()=>({useThreat:()=>({feed:[],snapshot:null,level:'preview'})}));
(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
it('shows actual laptop metrics and scan actions instead of fixture widgets',async()=>{
 vi.mocked(demoCall).mockImplementation(async method=>method==='device.snapshot'?{cpu:{name:'Intel Core i3',load:23,cores:4,threads:8},gpu:['Intel UHD'],gpuUsage:19,memory:{total:8589934592,available:4294967296},disks:[{name:'C:',total:512000000000,free:256000000000}],battery:{percent:75,charging:true},os:'Windows 11',uptimeSeconds:3600}:{available:true,monitoring:true,queue:0,scan:{state:'idle'},events:[],engine:'Sentinel'});
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{await act(async()=>{root.render(<Dashboard/>);});expect(host.textContent).toContain('Intel Core i3');expect(host.textContent).toContain('Intel UHD');expect(host.textContent).toContain('19%');expect(host.textContent).toContain('Device Overview');expect(host.textContent).not.toMatch(/Windows Security|Your laptop, at a glance|Checking protection status/);expect(host.textContent).not.toMatch(/DEMO ACCOUNTS|REVIEW FINDINGS|FILES INSPECTED|ATTACK SIMULATION/);const quick=Array.from(host.querySelectorAll('button')).find(b=>b.textContent?.includes('Quick scan'))!;await act(async()=>quick.click());expect(demoCall).toHaveBeenCalledWith('security.scan',{mode:'quick'});}finally{await act(()=>root.unmount());host.remove();}
});
it('never paints a missing engine or failed hardware read as healthy',async()=>{
 vi.mocked(demoCall).mockRejectedValue(new Error('Device information unavailable'));
 const host=document.createElement('div');const root=createRoot(host);try{await act(async()=>root.render(<Dashboard/>));expect(host.textContent).toContain('unavailable');expect(host.textContent).not.toContain('Your device is protected');expect(Array.from(host.querySelectorAll('button')).find(b=>b.textContent?.includes('Full scan'))?.disabled).toBe(true);}finally{await act(()=>root.unmount());}
});
it('keeps incomplete scan coverage visible instead of claiming a clean device',async()=>{
 vi.mocked(demoCall).mockResolvedValue({available:true,scan:{state:'incomplete',mode:'quick',checkedFiles:42,skippedFiles:3},events:[]});
 const host=document.createElement('div');const root=createRoot(host);try{await act(async()=>root.render(<Dashboard/>));expect(host.textContent).toContain('Scan incomplete');expect(host.textContent).toContain('42 files checked');expect(host.textContent).toContain('3 skipped');expect(host.textContent).not.toContain('Your device is protected');}finally{await act(()=>root.unmount());}
});
it('routes Stop to cancellation of the owned native scan',async()=>{
 vi.mocked(demoCall).mockResolvedValue({available:true,scan:{state:'scanning',mode:'full',checkedFiles:42},events:[]});
 const host=document.createElement('div');const root=createRoot(host);try{await act(async()=>root.render(<Dashboard/>));const stop=Array.from(host.querySelectorAll('button')).find(b=>b.textContent==='Stop scan')!;expect(stop).toBeTruthy();await act(async()=>stop.click());expect(demoCall).toHaveBeenCalledWith('security.cancel',{});}finally{await act(()=>root.unmount());}
});


it('preserves paused scan controls and exposes stale definitions without a healthy claim',async()=>{
 vi.mocked(demoCall).mockResolvedValue({available:true,signatures:3628111,definitionsAt:1,definitionsFresh:false,scan:{state:'paused',mode:'full',checkedFiles:4},events:[]});
 const host=document.createElement('div');const root=createRoot(host);try{await act(async()=>root.render(<Dashboard/>));expect(host.textContent).toContain('Checking a download first');expect(host.textContent).toContain('automatic quarantine is paused');expect(Array.from(host.querySelectorAll('button')).find(b=>b.textContent?.includes('Quick scan'))?.disabled).toBe(true);expect(Array.from(host.querySelectorAll('button')).find(b=>b.textContent==='Stop scan')).toBeTruthy();}finally{await act(()=>root.unmount());}
});
it('requests a native file picker without sending renderer paths',async()=>{
 vi.mocked(demoCall).mockResolvedValue({available:true,scan:{state:'idle'},events:[]});
 const host=document.createElement('div');const root=createRoot(host);try{await act(async()=>root.render(<Dashboard/>));await act(async()=>Array.from(host.querySelectorAll('button')).find(b=>b.textContent==='Scan a file')!.click());expect(demoCall).toHaveBeenCalledWith('security.select',{kind:'file'});}finally{await act(()=>root.unmount());}
});
