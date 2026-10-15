// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import DuckyControlPanel from './DuckyControlPanel';
import {demoCall} from '../../demo-bridge';
vi.mock('../../demo-bridge',()=>({demoCall:vi.fn()}));
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
it('only opens native controls, never submits a device identity or a hold command',async()=>{
 vi.mocked(demoCall).mockResolvedValue({ok:true});
 const host=document.createElement('div'),root=createRoot(host);
 try{await act(()=>root.render(<DuckyControlPanel enabled={false}/>));expect(host.querySelector('button')!.disabled).toBe(true);
 await act(()=>root.render(<DuckyControlPanel enabled/>));await act(async()=>host.querySelector('button')!.click());
 expect(demoCall).toHaveBeenCalledWith('usb.ducky.open');expect(host.textContent).not.toContain('Blocked');
 vi.mocked(demoCall).mockRejectedValue(Error('disconnected'));await act(async()=>host.querySelector('button')!.click());expect(host.querySelector('[role=alert]')).not.toBeNull();
 }finally{await act(()=>root.unmount());}
});
