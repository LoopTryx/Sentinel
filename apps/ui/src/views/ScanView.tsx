import {useState} from 'react';
import {demoCall,useDemoState} from '../demo-bridge';
import {useThreat} from '../state';
import ScanTargetPanel from '../components/ScanTargetPanel';
import './glm-pages.css';
const retainedReceipts=new Set<string>();
const quarantineAvailable=false; // Recovery must survive native worker expiry.
let acceptedSelection:{id:string;kind:string}|null=null;
export default function ScanView(){
 const {state,error}=useDemoState();
 const {snapshot,inspectionError,resetScan}=useThreat();
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const [receipts,setReceipts]=useState(()=>[...retainedReceipts]);
 const [selection,setSelection]=useState(acceptedSelection);
 const hasFindings=snapshot?.reports.some(report=>report.verdict==='suspicious'||report.verdict==='signature_match')===true;
 const signatureFound=snapshot?.reports.some(report=>report.verdict==='signature_match')===true;
 const running=state?.scan?.status==='running';
 async function select(kind:string){setNotice('');setBusy(true);try{const r=await demoCall('scan.select',{kind});if(r.cancelled)setNotice('Selection cancelled; no scan started.');else if(typeof r.id==='string'){acceptedSelection={id:r.id,kind};setSelection(acceptedSelection);resetScan();}}catch(e){acceptedSelection=null;setSelection(null);setNotice(e instanceof Error?e.message:'Scan unavailable');}finally{setBusy(false);}}
 async function disposition(restore:boolean,reference:string){setBusy(true);setNotice('Confirm or decline in the native desktop dialog.');try{
  const r=await demoCall(restore?'restore.request':'quarantine.request',restore?{actionRef:reference}:{reportRef:reference});
  if(r.type==='quarantine_receipt'&&r.data?.state==='quarantined'&&typeof r.data.actionRef==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(r.data.actionRef)){
   retainedReceipts.add(r.data.actionRef);setReceipts([...retainedReceipts]);setNotice('File quarantined. Restore is available in this session.');
  }else if(r.type==='restore_receipt'&&r.data?.state==='restored'){
   retainedReceipts.delete(reference);setReceipts([...retainedReceipts]);setNotice('Original bytes restored.');
  }else setNotice('Operation not completed: '+(r.data?.code||r.type||'unavailable'));
 }catch(e){setNotice(e instanceof Error?e.message:'Native operation unavailable');}finally{setBusy(false);}}
 return <section className="panel glm-page"><div className="glm-page-heading"><div><span className="pm-eyebrow">SENTINEL / SCAN & DETECT</span><h3 className="panel-title">File & folder scan</h3></div><span className="badge">{state?'Connected · partial coverage':'Scanner disconnected'}</span></div>
 {hasFindings&&<div className="scan-finding-summary" role="alert"><strong>{signatureFound?'Threat signature detected':'Suspicious file detected'}</strong><p>{inspectionError?"Last available finding; scanner unavailable.":"Review findings below. Partial scan · no files quarantined."}</p></div>}
 <ScanTargetPanel running={running} disabled={!state||busy||running||receipts.length>0} onChoose={kind=>void select(kind)}/>
 <div className="glm-toolbar"><span role="status">{busy?'Choosing a target…':running?'Inspection running':state?.scan?.status==='failed'?'Scan failed · choose another file to retry':state?'Ready to inspect':'Scanner unavailable · open the desktop app'}</span><button className="btn ghost" disabled={busy||!running} onClick={()=>void demoCall('cancel').catch(e=>setNotice(e.message))}>Cancel inspection</button></div>
 <details className="glm-details"><summary>Coverage & limits</summary><p>Read-only Rust byte inspection checks local signatures and structural clues. Indicators need review; they do not prove malware. No automatic remediation or USB release.</p><p>8 MiB per file · 64 files · 256 entries · four directory levels. Larger files receive partial reports with no full-file hash. Links are refused. Quarantine is unavailable until recovery survives the five-minute native worker expiry.</p></details>
 {(notice||error||inspectionError)&&<p role="status">{notice||error||inspectionError}</p>}
 {snapshot&&<section aria-live="polite">
 {inspectionError&&<p role="status">Last available report · current inspection unavailable.</p>}<h3>{snapshot.cancellationRequested?'Cancellation requested':snapshot.state} · partial coverage</h3>
 <p>{snapshot.reports.length} reports · {snapshot.currentFileBytes} current bytes</p>
 {snapshot.reports.map(report=><div className="pm-advice" key={snapshot.jobRef+report.reportRef}>
 <strong>{report.reportRef} · {report.state.replaceAll('_',' ')} · {report.verdict.replaceAll('_',' ')}</strong>
 <p>Inspected {report.inspectedBytes} of {report.logicalBytes} bytes.</p>
 <details className="glm-details"><summary>Report details</summary><p>{report.sha256?<code style={{overflowWrap:'anywhere'}}>SHA-256: {report.sha256}</code>:'Full-file SHA-256 unavailable; inspection is incomplete.'}</p>
 {report.evidence&&<p>Zero bytes in inspected range: {report.evidence.zeroBytes} ({report.evidence.zeroPermille/10}%). Executable header: {report.evidence.peHeaderPresent?'observed':'not observed'}.</p>}
 </details><p>{report.findings.length?report.findings.map(f=>f.replaceAll('_',' ')).join(', '):'No local indicator observed. This does not guarantee safety.'}</p>
 <button className="btn ghost" disabled={!quarantineAvailable||busy||running||selection?.kind!=='file'||selection.id!==state?.scan?.id||snapshot.cancellationRequested||report.state!=='completed'||snapshot.reports.length!==1} onClick={()=>void disposition(false,report.reportRef)}>Quarantine unavailable · recovery pending</button>
 </div>)}</section>}
 {receipts.length>0&&<p role="status">Restore quarantined files before selecting another file or closing. Restore authority lasts only for this running session.</p>}
 {receipts.map(actionRef=><button className="btn ghost" key={actionRef} disabled={busy||running} onClick={()=>void disposition(true,actionRef)}>Restore quarantined file…</button>)}
 </section>;
}
