import {useState} from 'react';
import {demoCall,useDemoState} from '../demo-bridge';
export default function ScanView(){
 const {state,error}=useDemoState();const [busy,setBusy]=useState(false);const [notice,setNotice]=useState('');
 const scan=state?.scan;const running=scan?.status==='running';
 async function select(kind:string){setNotice('');setBusy(true);try{const r=await demoCall('scan.select',{kind});if(r.cancelled)setNotice('Selection cancelled; no scan started.');}catch(e){setNotice(e instanceof Error?e.message:'Scan unavailable');}finally{setBusy(false);}}
 return <section className="panel"><span className="pm-eyebrow">SENTINEL / FILE INSPECTION</span><h3 className="panel-title">Scan & inspect</h3>
 <p>Inspect selected local files read-only. Real byte counts and SHA-256 evidence; harmless demo signatures are labeled. ClamAV scans verified harmless sample bytes with the demo signature database. Other files receive bounded byte inspection only; real-malware/parser review is pending. No automatic remediation or USB release.</p>
 <div className="badge">{state?'Desktop runtime connected · partial coverage':'Desktop scan adapter unavailable'}</div>
 <p>Limit: 8 MiB per file, 64 files, 256 entries, four directory levels, 90-second cooperative budget. Links and oversized files are skipped.</p>
 <div className="pm-actions"><button className="btn" disabled={!state||busy||running} onClick={()=>void select('file')}>Choose file</button><button className="btn ghost" disabled={!state||busy||running} onClick={()=>void select('folder')}>Choose folder</button><button className="btn ghost" disabled={!running} onClick={()=>void demoCall('cancel').catch(e=>setNotice(e.message))}>Cancel inspection</button></div>
 {(notice||error)&&<p role="status">{notice||error}</p>}
 {scan&&<section aria-live="polite"><h3>{scan.status.replaceAll('_',' ')} · {scan.coverage} coverage</h3><p>{scan.engine}</p><div className="pm-summary"><div><strong>{scan.checked}</strong><span>Files inspected</span></div><div><strong>{scan.skipped}</strong><span>Skipped</span></div><div><strong>{scan.errors}</strong><span>Errors</span></div><div><strong>{scan.bytes.toLocaleString()}</strong><span>Actual bytes read</span></div></div>
 {running&&<p>Visiting entries and reading files… {scan.visited} entries observed. No estimated percentage.</p>}
 {scan.findings.map((finding,i)=><div className="pm-advice" key={i}><strong>{finding.kind==='synthetic_test'?'Harmless synthetic test':'ClamAV result'} · {finding.name}</strong><p>{finding.reason}</p></div>)}
 {scan.status==='completed'&&!scan.findings.length&&<p>No synthetic test marker found. This is not a guarantee that the file is safe.</p>}
 {['failed','cancelled','timed_out','partial'].includes(scan.status)&&<p>Inspection incomplete. Previously inspected files do not make skipped or uninspected files safe.</p>}
 <details><summary>File evidence ({scan.files.length})</summary>{scan.files.map((file,i)=><p key={i}><strong>{file.name}</strong> · {file.bytes} bytes<br/><code style={{overflowWrap:'anywhere'}}>{file.sha256}</code></p>)}</details></section>}
 </section>;
}
