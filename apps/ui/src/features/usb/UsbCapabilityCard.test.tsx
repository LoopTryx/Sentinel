// @vitest-environment jsdom
import {act} from 'react';import {createRoot} from 'react-dom/client';import {expect,it,vi} from 'vitest';import UsbCapabilityCard from './UsbCapabilityCard';
(globalThis as Record<string,unknown>).IS_REACT_ACT_ENVIRONMENT=true;
it('connection exposes only folder inspection and never implies input or sandbox protection',async()=>{
 const host=document.createElement('div');const root=createRoot(host);const open=vi.fn();
 try{await act(()=>root.render(<UsbCapabilityCard connected={false} onOpen={open}/>));expect(host.textContent).toContain('Desktop disconnected');await act(()=>host.querySelector('button')!.click());expect(open).toHaveBeenCalledOnce();
 await act(()=>root.render(<UsbCapabilityCard connected onOpen={open}/>));expect(host.textContent).toContain('Selected folders · partial coverage');expect(host.textContent).toContain('Unavailable · no verified input gate');expect(host.textContent).toContain('Unavailable · no isolated execution service');expect(host.textContent).toContain('Manual snapshot · not live');
 }finally{await act(()=>root.unmount());}
});
