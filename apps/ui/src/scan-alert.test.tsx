// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {ThreatProvider,useThreat} from './state';
import {demoCall} from './demo-bridge';
vi.mock('./demo-bridge',()=>({demoCall:vi.fn()}));
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
const snapshot=(verdict:string,jobRef='first')=>({selectionRef:'selected',jobRef,state:'finished',cancellationRequested:false,currentFileBytes:'0',reports:[{reportRef:'report_0',state:'partial',verdict,coverage:'partial',logicalBytes:'16',inspectedBytes:'16',sha256:null,evidence:null,findings:[]}]});
it('keeps native findings red outside scan view, through preview resets, failures and expired reports; resets only for an accepted new scan',async()=>{
 vi.useFakeTimers();let response:any={snapshot:snapshot('suspicious')};let fail=false;
 vi.mocked(demoCall).mockImplementation(async()=>{if(fail)throw new Error('Disconnected');return response;});
 function Probe(){const t=useThreat();return <><output>{t.level}|{t.inspectionError}|{t.snapshot?.jobRef}</output><button onClick={()=>t.setLevel('preview')}>Preview reset</button><button onClick={t.resetScan}>New scan</button></>;}
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const tick=()=>act(async()=>{await vi.advanceTimersByTimeAsync(900);});
 try{
  await act(()=>root.render(<ThreatProvider><Probe/></ThreatProvider>));expect(document.body.dataset.threat).toBe('danger');
  await act(()=>host.querySelectorAll('button')[0].click());expect(document.body.dataset.threat).toBe('danger');
  fail=true;await tick();expect(host.textContent).toContain('Disconnected');expect(document.body.dataset.threat).toBe('danger');
  fail=false;response={snapshot:null};await tick();expect(document.body.dataset.threat).toBe('danger');
  response={snapshot:snapshot('suspicious')};await act(()=>host.querySelectorAll('button')[1].click());await tick();expect(document.body.dataset.threat).toBe('preview');
  response={snapshot:snapshot('unknown','second')};await tick();expect(document.body.dataset.threat).toBe('preview');
  response={snapshot:snapshot('signature_match','second')};await tick();expect(document.body.dataset.threat).toBe('danger');
  response={snapshot:{...snapshot('suspicious','third'),reports:[{verdict:'suspicious'}]}};await tick();expect(host.textContent).toContain('Invalid inspection evidence');expect(host.textContent).not.toContain('third');
 }finally{await act(()=>root.unmount());host.remove();vi.useRealTimers();}
});
