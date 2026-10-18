// @vitest-environment jsdom
import {act} from 'react';import {createRoot} from 'react-dom/client';import {expect,it,vi} from 'vitest';
import SentinelAiView from './SentinelAiView';import {demoCall} from '../demo-bridge';
vi.mock('../demo-bridge',()=>({demoCall:vi.fn()}));
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
it('does not submit finding on mount; explicit send carries only a reference and question',async()=>{
 const call=vi.mocked(demoCall);call.mockReset();call.mockImplementation(async method=>method==='ai.status'?{provider:'NVIDIA NIM',model:'meta/llama-3.1-8b-instruct',configured:true}:{provider:'NVIDIA NIM',model:'meta/llama-3.1-8b-instruct',kind:'provider_interpretation',answer:{evidenceRefs:['reward_payment'],explanation:'Verify independently.',uncertainty:'This is a clue.',recommendations:[]}});
 const host=document.createElement('div'),root=createRoot(host);
 const finding={ref:'a'.repeat(32),source:'local_url_assessment',detectedAt:'2026-10-18T00:00:00Z',url:'https://example.test/winner-payment',assessment:'suspicious',signals:[{code:'reward_payment',text:'Paired wording'}],limitation:'No website fetch.'};
 try{await act(async()=>{root.render(<SentinelAiView context={{finding,question:'Why?'}}/>);});expect(call).not.toHaveBeenCalledWith('ai.send',expect.anything());expect(host.textContent).toContain('Paired wording');await act(async()=>{host.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});expect(call).toHaveBeenCalledWith('ai.send',{question:'Why?',findingRef:finding.ref});expect(host.textContent).toContain('provider interpretation');expect(host.textContent).toContain('Verify independently.');}finally{await act(()=>root.unmount());}
});
it('does not attach an outstanding answer to a replacement finding',async()=>{
 let complete!:(value:any)=>void;
 vi.mocked(demoCall).mockReset();vi.mocked(demoCall).mockImplementation(method=>method==='ai.status'?Promise.resolve({provider:'NVIDIA NIM',model:'test/model',configured:true}):new Promise(resolve=>{complete=resolve;}));
 const host=document.createElement('div'),root=createRoot(host);
 const finding={ref:'a'.repeat(32),source:'local_url_assessment',detectedAt:'2026-10-18T00:00:00Z',url:'https://first.test/',assessment:'suspicious',signals:[],limitation:'Local only.'};
 try{await act(async()=>root.render(<SentinelAiView context={{finding,question:'First question'}}/>));await act(async()=>{host.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});await act(async()=>root.render(<SentinelAiView context={{finding:{...finding,ref:'b'.repeat(32),url:'https://second.test/'},question:'Second question'}}/>));await act(async()=>{complete({answer:{explanation:'Answer for first finding',uncertainty:'x',recommendations:[],evidenceRefs:[]}});});expect(host.textContent).not.toContain('Answer for first finding');expect(host.querySelector('textarea')!.value).toBe('Second question');}finally{await act(()=>root.unmount());}
});
