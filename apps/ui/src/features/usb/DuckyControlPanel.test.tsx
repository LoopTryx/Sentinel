// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import DuckyControlPanel from './DuckyControlPanel';
import {demoCall} from '../../demo-bridge';
vi.mock('../../demo-bridge',()=>({demoCall:vi.fn()}));
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
it('keeps the enrolled card visible and sends fixed Block/Allow actions without device identifiers',async()=>{
 vi.mocked(demoCall).mockResolvedValue({state:'off',title:'Allowed',detail:'Reconnect to run.',input:'ready'});
 const host=document.createElement('div'),root=createRoot(host);
 try{await act(async()=>root.render(<DuckyControlPanel enabled/>));expect(host.textContent).toContain('RP2040-Zero');
 const button=(name:string)=>Array.from(host.querySelectorAll('button')).find(b=>b.textContent===name)!;
 expect(button('Block')).toBeDefined();await act(async()=>button('Block').click());expect(demoCall).toHaveBeenCalledWith('usb.ducky.block');
 await act(async()=>button('Allow').click());expect(demoCall).toHaveBeenCalledWith('usb.ducky.allow');
 vi.mocked(demoCall).mockRejectedValue(Error('Windows approval cancelled.'));await act(async()=>button('Allow').click());expect(host.querySelector('[role=alert]')?.textContent).toContain('cancelled');
 await act(()=>root.render(<DuckyControlPanel enabled={false}/>));expect(button('Allow').disabled).toBe(true);
 }finally{await act(()=>root.unmount());}
});
it('recovers its buttons after disconnect during a native action',async()=>{
 const status={state:'off',title:'Allowed',detail:'Reconnect.',input:'ready'};let finish!:(value:unknown)=>void;
 vi.mocked(demoCall).mockImplementation(method=>method==='usb.ducky.allow'?new Promise(resolve=>{finish=resolve;}):Promise.resolve(status));
 const host=document.createElement('div'),root=createRoot(host);const allow=()=>Array.from(host.querySelectorAll('button')).find(b=>b.textContent==='Allow')!;
 try{await act(async()=>root.render(<DuckyControlPanel enabled/>));await act(()=>allow().click());await act(()=>root.render(<DuckyControlPanel enabled={false}/>));await act(async()=>finish(status));await act(async()=>root.render(<DuckyControlPanel enabled/>));expect(allow().disabled).toBe(false);}finally{await act(()=>root.unmount());}
});
