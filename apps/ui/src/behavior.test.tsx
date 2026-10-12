// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach, expect, it, vi} from 'vitest';
import Dither from './components/ui/Dither';
import Grainient from './components/ui/Grainient';
import WatchtowerView from './views/WatchtowerView';
vi.mock('./demo-bridge',()=>({demoCall:vi.fn(async()=>{throw new Error('unavailable');})}));
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let root: ReturnType<typeof createRoot> | undefined;
afterEach(async () => {if(root) await act(() => root!.unmount()); root=undefined; document.body.innerHTML=''; vi.restoreAllMocks();});
for(const [name, Effect] of [['dither', Dither], ['grainient', Grainient]] as const) {
 it(`keeps console content when ${name} cannot create WebGL`, async () => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  window.matchMedia = vi.fn().mockReturnValue({matches: false});
  const host=document.createElement('div'); document.body.append(host); root=createRoot(host);
  await act(() => root!.render(<><Effect/><span>Console remains available</span></>));
  expect(host.textContent).toContain('Console remains available');
 });
}
it('shows network collection failure without synthetic alerts or message inputs', async () => {
 const host=document.createElement('div'); document.body.append(host); root=createRoot(host);
 await act(() => root!.render(<WatchtowerView/>));
 expect(host.querySelector('textarea')).toBeNull();
 expect(host.textContent).not.toContain('Synthetic alert');
 const check=Array.from(host.querySelectorAll('button')).find(button=>button.textContent?.includes('Check network'))!;
 await act(() => check.click());
 expect(host.textContent).toContain('Network observations are unavailable');
 expect(host.textContent).not.toContain('Open Wi-Fi');
});
