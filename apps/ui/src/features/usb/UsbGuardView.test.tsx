// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach, expect, it, vi} from 'vitest';
import UsbGuardView from './UsbGuardView';
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT=true;
let root: ReturnType<typeof createRoot>;
afterEach(async()=>{if(root) await act(()=>root.unmount()); document.body.innerHTML=''; vi.restoreAllMocks();});
async function mount(){const host=document.createElement('div');document.body.append(host);root=createRoot(host);await act(()=>root.render(<UsbGuardView/>));return host;}
const snapshot=()=>JSON.stringify({schemaVersion:1,mode:'observation_only',state:'observed',observedAt:new Date().toISOString(),omitted:0,devices:[{ref:'device-1',usbEvidence:'os_reported',interfaces:['storage','hid_keyboard']}]});
async function load(host:HTMLElement,text:()=>Promise<string>,size=200){const input=host.querySelector('input')!;Object.defineProperty(input,'files',{configurable:true,value:[{size,text}]});await act(async()=>input.dispatchEvent(new Event('change',{bubbles:true})));}
it('does not claim USB prevention or scans without an adapter',async()=>{const host=await mount();expect(host.textContent).toContain('HID input blocking unavailable');expect(host.textContent).toContain('USB folder scanning unavailable');expect(host.textContent).toContain('No inventory loaded');expect(host.querySelector('[role="status"]')).not.toBeNull();});
it('shows a composite device as separate storage/input exposure, then clears it',async()=>{const host=await mount();await load(host,async()=>snapshot());expect(host.textContent).toContain('Composite device');expect(host.textContent).toContain('Keyboard input');expect(host.textContent).toContain('Storage approval cannot approve HID');await act(()=>Array.from(host.querySelectorAll('button')).find(b=>b.textContent==='Clear snapshot')!.click());expect(host.textContent).not.toContain('Composite device');});
it('rejects oversized files without reading their contents',async()=>{const host=await mount();const read=vi.fn();await load(host,read,32769);expect(read).not.toHaveBeenCalled();expect(host.textContent).toContain('Invalid or oversized inventory');});
it('suppresses a late import after clear',async()=>{const host=await mount();let finish!:(text:string)=>void;await load(host,()=>new Promise(resolve=>{finish=resolve;}));await act(()=>Array.from(host.querySelectorAll('button')).find(b=>b.textContent==='Clear snapshot')!.click());await act(async()=>finish(snapshot()));expect(host.textContent).toContain('No inventory loaded');expect(host.textContent).not.toContain('Composite device');});
