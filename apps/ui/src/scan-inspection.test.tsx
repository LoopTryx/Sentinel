// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {ThreatProvider,useThreat} from './state';
import ScanView from './views/ScanView';
import {demoCall} from './demo-bridge';
const model=vi.hoisted(()=>({state:{scan:{id:'a'.repeat(24),status:'partial'}},snapshot:null as unknown}));
vi.mock('./demo-bridge',()=>({useDemoState:()=>({state:model.state,error:''}),demoCall:vi.fn()}));
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
function ResetDisplay(){const {resetConsole}=useThreat();return <button onClick={resetConsole}>Reset display</button>;}
it('shows partial large-file evidence without full hash and gates quarantine even for completed files until recovery is ready',async()=>{
 const report={reportRef:'report_0',state:'partial',verdict:'suspicious',coverage:'partial',logicalBytes:'67108864',inspectedBytes:'8388608',sha256:null,evidence:{zeroBytes:'8388608',zeroPermille:1000,rangeComplete:false,peHeaderPresent:false},findings:['large_zero_filled_range']};
 model.snapshot={selectionRef:'selected',jobRef:'job',state:'finished',cancellationRequested:false,currentFileBytes:'0',reports:[report]};
 vi.mocked(demoCall).mockImplementation(async(method)=>method==='inspection.read'?{snapshot:model.snapshot}:method==='scan.select'?{id:model.state.scan.id}:method==='quarantine.request'?{type:'quarantine_receipt',data:{state:'quarantined',actionRef:'retained'}}:{type:'restore_receipt',data:{state:'restored'}});
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const button=(text:string)=>Array.from(host.querySelectorAll('button')).find(b=>b.textContent?.includes(text))!;
 try{
  await act(()=>root.render(<ThreatProvider><ResetDisplay/><ScanView/></ThreatProvider>));
  expect(host.querySelector('.scan-finding-summary')?.textContent).toContain('Suspicious file detected');
  await act(()=>button('Reset display').click());expect(document.body.dataset.threat).toBe('preview');
  expect(host.querySelector('.scan-finding-summary')?.textContent).toContain('Suspicious file detected');
  expect(host.querySelector('.scan-global-alert')).toBeNull();
  expect(host.textContent).toContain('Inspected 8388608 of 67108864 bytes');
  expect(host.textContent).toContain('Full-file SHA-256 unavailable');
  expect(button('Quarantine').disabled).toBe(true);
  expect(host.textContent).not.toContain('ClamAV');
  model.snapshot={...(model.snapshot as object),jobRef:'next-job',reports:[{...report,state:'completed',verdict:'none_observed',logicalBytes:'3',inspectedBytes:'3',sha256:'a'.repeat(64),evidence:null,findings:[]}]};
  await act(async()=>button('Choose file').click());
  await act(async()=>{await new Promise(r=>setTimeout(r,950));});
  expect(button('Quarantine').disabled).toBe(true);
  await act(async()=>button('Quarantine').click());
  expect(demoCall).not.toHaveBeenCalledWith('quarantine.request',{reportRef:'report_0'});
  expect(host.textContent).toContain('five-minute native worker expiry');
  model.state.scan.status='failed';await act(()=>root.render(<ThreatProvider><ResetDisplay/><ScanView/></ThreatProvider>));
  expect(host.textContent).toContain('Scan failed · choose another file to retry');expect(button('Choose file').disabled).toBe(false);
 }finally{await act(()=>root.unmount());host.remove();}
});
