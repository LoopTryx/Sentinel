// @vitest-environment jsdom
import {act} from 'react';import {createRoot} from 'react-dom/client';import {expect,it,vi} from 'vitest';
import Dashboard from './views/Dashboard';import {demoCall} from './demo-bridge';
vi.mock('./demo-bridge',()=>({demoCall:vi.fn(),useDemoState:()=>({state:{events:[]}})}));
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
it('reads status without starting scans and sends only explicit bounded actions',async()=>{
 vi.mocked(demoCall).mockImplementation(async method=>method==='security.status'?{available:true,monitoring:false,scan:{state:'idle'},events:[]}:{});
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{await act(async()=>root.render(<Dashboard/>));expect(demoCall).not.toHaveBeenCalledWith('security.scan',expect.anything());const full=Array.from(host.querySelectorAll('button')).find(b=>b.textContent?.includes('Full scan'))!;await act(async()=>full.click());expect(demoCall).toHaveBeenCalledWith('security.scan',{mode:'full'});expect(vi.mocked(demoCall).mock.calls.some(([method])=>method.startsWith('usb.')||method==='quarantine.request'||method==='scan.select')).toBe(false);expect(host.textContent).not.toContain('RESET CONSOLE');expect(host.textContent).not.toContain('SHIELD MODULES');}finally{await act(()=>root.unmount());host.remove();}
});
