// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import ScanTargetPanel from './components/ScanTargetPanel';
import ThreatLogView from './views/ThreatLogView';
vi.mock('./state',()=>({useThreat:()=>({feed:[]})}));
vi.mock('./demo-bridge',()=>({useDemoState:()=>({state:null})}));
vi.mock('./views/DemoConnection',()=>({default:()=>null}));
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;

it('shows indeterminate feedback only while running and prevents competing selections',async()=>{
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const choose=vi.fn();
 try{
  await act(()=>root.render(<ScanTargetPanel running disabled onChoose={choose}/>));
  const progress=host.querySelector('[role=progressbar]');
  expect(progress).not.toBeNull();expect(progress?.hasAttribute('aria-valuenow')).toBe(false);
  for(const button of host.querySelectorAll('button'))await act(()=>button.click());
  expect(choose).not.toHaveBeenCalled();
  await act(()=>root.render(<ScanTargetPanel running={false} disabled={false} onChoose={choose}/>));
  expect(host.querySelector('[role=progressbar]')).toBeNull();expect(host.querySelector('.scan-target-ring')).toBeNull();
  const buttons=host.querySelectorAll('button');await act(()=>buttons[0].click());await act(()=>buttons[1].click());
  expect(choose.mock.calls).toEqual([['file'],['folder']]);
 }finally{await act(()=>root.unmount());host.remove();}
});

it('uses an accessible scenario button that opens and closes the labeled example region',async()=>{
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{
  await act(()=>root.render(<ThreatLogView/>));const button=host.querySelector('button')!;const region=host.querySelector<HTMLElement>('#presentation-scenarios')!;
  expect(button.getAttribute('aria-expanded')).toBe('false');expect(region.hidden).toBe(true);
  await act(()=>button.click());expect(button.getAttribute('aria-expanded')).toBe('true');expect(region.hidden).toBe(false);expect(region.textContent).toContain('Labeled presentation scenarios');
  await act(()=>button.click());expect(region.hidden).toBe(true);
 }finally{await act(()=>root.unmount());host.remove();}
});
