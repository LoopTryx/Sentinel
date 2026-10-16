// @vitest-environment jsdom
import {act} from 'react';import {createRoot} from 'react-dom/client';import {expect,it,vi} from 'vitest';
import Dashboard from './views/Dashboard';
const {resetConsole}=vi.hoisted(()=>({resetConsole:vi.fn()}));
vi.mock('./demo-bridge',()=>({useDemoState:()=>({state:null})}));
vi.mock('./state',()=>({useThreat:()=>({level:'preview',feed:[],setLevel:vi.fn(),push:vi.fn(),snapshot:null,resetConsole})}));
vi.mock('./components/ui/Grainient',()=>({default:()=>null}));
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
it('dashboard quick actions and capability cards navigate without starting privileged work',async()=>{
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host),navigate=vi.fn();
 try{await act(()=>root.render(<Dashboard onViewAll={()=>{}} onNavigate={navigate}/>));
  resetConsole.mockClear();const reset=Array.from(host.querySelectorAll('button')).find(button=>button.textContent?.includes('RESET CONSOLE'));await act(()=>reset!.click());expect(resetConsole).toHaveBeenCalledOnce();
  const buttons=Array.from(host.querySelectorAll<HTMLButtonElement>('.dashboard-actions button'));
  for(const b of buttons)await act(()=>b.click());expect(navigate.mock.calls).toEqual([['scan'],['password'],['watchtower']]);
  navigate.mockClear();const modules=Array.from(host.querySelectorAll<HTMLButtonElement>('.module-action'));
  for(const b of modules)await act(()=>b.click());expect(navigate.mock.calls).toEqual([['scan'],['password'],['usb'],['watchtower']]);expect(modules.slice(-2).every(b=>b.disabled)).toBe(true);
 }finally{await act(()=>root.unmount());host.remove();}
});
