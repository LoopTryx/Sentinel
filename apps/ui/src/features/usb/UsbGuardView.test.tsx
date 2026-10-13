// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import UsbGuardView from './UsbGuardView';
import {demoCall,useDemoState} from '../../demo-bridge';
vi.mock('../../demo-bridge',()=>({demoCall:vi.fn(),useDemoState:vi.fn()}));
vi.mock('./UsbActivityPanel',()=>({default:()=>null}));
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
it('shows every HID group including unnamed and unresolved groups without inventing a hold',async()=>{
 vi.mocked(useDemoState).mockReturnValue({state:{} as any,error:''});
 vi.mocked(demoCall).mockResolvedValue({schemaVersion:1,mode:'observation_only',state:'partial',observedAt:new Date().toISOString(),omitted:0,devices:[
  {ref:'device-1',usbEvidence:'os_reported',interfaces:['hid_keyboard','storage'],name:'Example board'},
  {ref:'device-2',usbEvidence:'os_reported',interfaces:['hid_mouse']},
  {ref:'device-3',usbEvidence:'unresolved',interfaces:['hid_keyboard']}
 ]});
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{await act(async()=>{root.render(<UsbGuardView/>);await Promise.resolve();});expect(host.querySelectorAll('[data-usb-device]')).toHaveLength(2);expect(host.textContent).toContain('HID keyboard');expect(host.textContent).toContain('HID mouse');expect(host.textContent).toContain('USB ancestry unknown');expect(host.querySelector('details')?.textContent).toContain('HID keyboard');expect(host.textContent).toContain('Input quarantine');expect(host.textContent).toContain('Unavailable');expect(host.textContent).not.toContain('Unnamed input/storage interfaces');expect(host.textContent).not.toContain('Held');
 await act(()=>{vi.mocked(useDemoState).mockReturnValue({state:null,error:''});root.render(<UsbGuardView/>);});expect(host.querySelectorAll('[data-usb-device]')).toHaveLength(0);
 }finally{await act(()=>root.unmount());host.remove();}
});
it('keeps the latest inventory when manual and automatic refreshes finish out of order',async()=>{
 vi.useFakeTimers();vi.mocked(useDemoState).mockReturnValue({state:{} as any,error:''});
 const snapshot=(name:string)=>({schemaVersion:1,mode:'observation_only',state:'observed',observedAt:new Date().toISOString(),omitted:0,devices:[{ref:'device-1',usbEvidence:'os_reported',interfaces:['hid_keyboard'],name}]});
 let old!:(v:unknown)=>void,newer!:(v:unknown)=>void;
 vi.mocked(demoCall).mockResolvedValueOnce(snapshot('First')).mockImplementationOnce(()=>new Promise(resolve=>{old=resolve;})).mockImplementationOnce(()=>new Promise(resolve=>{newer=resolve;}));
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{await act(async()=>{root.render(<UsbGuardView/>);await Promise.resolve();});await act(()=>host.querySelector('button')!.click());await act(async()=>{vi.advanceTimersByTime(5000);await Promise.resolve();});await act(async()=>newer(snapshot('Newest')));await act(async()=>old(snapshot('Outdated')));expect(host.textContent).toContain('Newest');expect(host.textContent).not.toContain('Outdated');}finally{await act(()=>root.unmount());host.remove();vi.useRealTimers();}
});
