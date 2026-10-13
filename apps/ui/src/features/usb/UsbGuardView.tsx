import {useState} from 'react';
import {demoCall,useDemoState} from '../../demo-bridge';
import ScanTargetPanel from '../../components/ScanTargetPanel';
import './usb-guard.css';
export default function UsbGuardView(){
 const {state,error}=useDemoState();const [busy,setBusy]=useState(false);const [notice,setNotice]=useState('');
 const scan=state?.scan;const running=scan?.status==='running';
 async function choose(kind:'file'|'folder'){
  setBusy(true);setNotice('');
  try{const result=await demoCall('scan.select',{kind});if(result.cancelled)setNotice('Selection cancelled.');}
  catch(e){setNotice(e instanceof Error?e.message:'Checker unavailable.');}finally{setBusy(false);}
 }
 async function cancel(){try{await demoCall('cancel');}catch(e){setNotice(e instanceof Error?e.message:'Cancel unavailable.');}}
 return <section className="usb-guard usb-minimal" aria-labelledby="usb-heading">
  <div className="usb-page-heading"><h2 id="usb-heading">USB Guard</h2><span className="usb-mode">File checks only · HID blocking unavailable</span></div>
  <section className="panel usb-checker" aria-labelledby="usb-checker-heading"><div className="usb-toolbar"><h3 id="usb-checker-heading">USB file / folder checker</h3><span className="usb-chip">{state?'Connected':'Desktop disconnected'}</span></div>
   <ScanTargetPanel title="Check USB files & folders" description="Select a file or folder from your USB. Checks have partial coverage." running={running} disabled={!state||busy||running} onChoose={kind=>void choose(kind)}/>
   {running&&<div className="usb-check-actions"><button className="btn ghost" onClick={()=>void cancel()}>Cancel inspection</button></div>}
   {(notice||error)&&<p role="status">{notice||error}</p>}
   {!state&&<p className="usb-check-note">Connect the desktop app to check files.</p>}
   {scan&&<div className="usb-check-result" aria-live="polite"><div className="usb-toolbar"><strong>{scan.status.replaceAll('_',' ')} · {scan.coverage} coverage</strong><span>{scan.checked} inspected · {scan.skipped} skipped · {scan.errors} errors</span></div>
    <p className="usb-check-note">Shared desktop scan · {scan.bytes.toLocaleString()} bytes read</p>
    {['failed','cancelled','timed_out','partial'].includes(scan.status)&&<p>Incomplete check. Uninspected files remain unknown.</p>}
    {scan.status==='completed'&&!scan.findings.length&&<p>No test marker found. Safety remains unknown.</p>}
    {scan.findings.length>0&&<ul>{scan.findings.map((finding,i)=><li key={i}><strong>{finding.kind==='synthetic_test'||finding.kind==='provider_synthetic_match'?'Test finding':'Finding'} · {finding.name}</strong><p>{finding.reason}</p></li>)}</ul>}
    <details className="usb-scan-details"><summary>Scan details</summary><dl className="usb-evidence-grid"><div><dt>Inspection engine</dt><dd>{scan.engine}</dd></div><div><dt>Coverage</dt><dd>{scan.coverage} · bounded local indicators</dd></div></dl><p className="usb-scan-warning"><strong>USB input is not approved.</strong> File inspection does not block HID commands or prove a device safe.</p><div className="usb-evidence-files">{scan.files.map((file,i)=><article key={i}><div className="usb-evidence-heading"><strong>{file.name}</strong><span>{file.bytes.toLocaleString()} bytes inspected</span></div><span className="usb-evidence-label">SHA-256</span><code>{file.sha256||'Full-file hash unavailable'}</code></article>)}</div></details>
   </div>}
  </section>
  <section className="panel usb-recent" aria-labelledby="usb-recent-heading"><div className="usb-toolbar"><h3 id="usb-recent-heading">Recent attacks</h3><span className="usb-chip">Feed unavailable</span></div><div className="usb-empty"><span aria-hidden="true">—</span><p>No USB attack history available.</p></div></section>
 </section>;
}
