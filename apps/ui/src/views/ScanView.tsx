import {useEffect,useState} from 'react';
import {demoCall,useDemoState} from '../demo-bridge';
import {useThreat} from '../state';
import {parseQuarantineInventory} from '../quarantine-inventory';
import ScanTargetPanel from '../components/ScanTargetPanel';
import './glm-pages.css';
const completedQuarantines=new Set<string>();
let acceptedSelection:{id:string;kind:string}|null=null;
export default function ScanView({onOpenVault}:{onOpenVault?:()=>void}={}){
 const {state,error}=useDemoState();
 const {snapshot,inspectionError,resetScan,resetConsole}=useThreat();
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const [quarantineAvailable,setQuarantineAvailable]=useState(false);
 useEffect(()=>{let live=true;setQuarantineAvailable(false);if(state)void demoCall('quarantine.list').then(value=>{if(live)setQuarantineAvailable(parseQuarantineInventory(value)!==null);}).catch(()=>{});return()=>{live=false;};},[!!state]);
 const [selection,setSelection]=useState(acceptedSelection);
 const [quarantined,setQuarantined]=useState(()=>new Set(completedQuarantines));
 const hasFindings=snapshot?.reports.some(report=>!quarantined.has(snapshot.jobRef+':'+report.reportRef)&&(report.verdict==='suspicious'||report.verdict==='signature_match'))===true;
 const signatureFound=snapshot?.reports.some(report=>report.verdict==='signature_match')===true;
 const running=state?.scan?.status==='running';
 async function select(kind:string){setNotice('');setBusy(true);try{const r=await demoCall('scan.select',{kind});if(r.cancelled)setNotice('Selection cancelled; no scan started.');else if(typeof r.id==='string'){acceptedSelection={id:r.id,kind};setSelection(acceptedSelection);completedQuarantines.clear();setQuarantined(new Set());resetScan();}}catch(e){acceptedSelection=null;setSelection(null);setNotice(e instanceof Error?e.message:'Scan unavailable');}finally{setBusy(false);}}
 async function disposition(restore:boolean,reference:string){setBusy(true);setNotice('Confirm or decline in the native desktop dialog.');try{
  const r=await demoCall(restore?'restore.request':'quarantine.request',restore?{actionRef:reference}:{reportRef:reference});
  if(r.type==='quarantine_receipt'&&r.data?.state==='quarantined'&&typeof r.data.actionRef==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(r.data.actionRef)){
   if(snapshot){const key=snapshot.jobRef+':'+reference;completedQuarantines.add(key);setQuarantined(new Set(completedQuarantines));}
   resetConsole();resetScan();
   setNotice('File quarantined. It is now in the Quarantine Vault and remains available after restarting.');
  }else if(r.type==='quarantine_receipt'&&r.data?.state==='original_retained'){acceptedSelection=null;setSelection(null);setNotice('Encrypted copy saved, but the original remains. Review the Vault; the file is not contained.');
  }else if(r.type==='restore_receipt'&&r.data?.state==='restored'){
   setNotice('Original bytes restored.');
  }else setNotice('Operation not completed: '+(r.data?.code||r.type||'unavailable'));
 }catch(e){setNotice(e instanceof Error?e.message:'Native operation unavailable');}finally{setBusy(false);}}
 return <section className="panel glm-page scan-page"><div className="glm-page-heading"><div><h1 className="page-title">Scan & Detect</h1></div><span className="badge">{state?'Connected · partial coverage':'Scanner disconnected'}</span></div>
 {hasFindings&&<div className="scan-finding-summary" role="alert"><strong>{signatureFound?'Threat signature detected':'Suspicious file detected'}</strong><p>{inspectionError?"Last available finding; scanner unavailable.":"Review the file below before taking action."}</p></div>}
 {quarantined.size>0&&onOpenVault&&<button className="btn" onClick={onOpenVault}>Open Quarantine Vault</button>}
 <ScanTargetPanel running={running} disabled={!state||busy||running} onChoose={kind=>void select(kind)}/>
 <div className="glm-toolbar"><span role="status">{busy?'Working…':running?'Inspection running':state?.scan?.status==='failed'?'Scan failed · choose another file to retry':snapshot?'Choose another file to scan':state?'Ready to inspect':'Scanner unavailable · open the desktop app'}</span><button className="btn ghost" disabled={busy||!running} onClick={()=>void demoCall('cancel').catch(e=>setNotice(e.message))}>Cancel inspection</button></div>
 <details className="glm-details"><summary>Coverage & limits</summary><p>Local byte inspection finds signatures and suspicious patterns. Findings need review; quarantine is manual.</p><p>8 MiB per file · 64 files · 256 entries · four directory levels. Larger files receive partial reports with no full-file hash. Links are refused. Quarantine requires a complete selected-file report and native confirmation. Stored recovery remains available after app restart.</p></details>
 {(notice||error||inspectionError)&&<p role="status">{notice||error||inspectionError}</p>}
 {snapshot&&<section aria-live="polite">
 {inspectionError&&<p role="status">Last available report · current inspection unavailable.</p>}<div className="scan-results-heading"><h2>Scan results</h2><span>{snapshot.cancellationRequested?'Cancellation requested':snapshot.state==='finished'?'Inspection complete':snapshot.state} / {snapshot.reports.length} {snapshot.reports.length===1?'file':'files'}</span></div>
 {snapshot.reports.map(report=><div className="scan-result-card" data-contained={quarantined.has(snapshot.jobRef+':'+report.reportRef)} key={snapshot.jobRef+report.reportRef}>
 <strong>{quarantined.has(snapshot.jobRef+':'+report.reportRef)?'Quarantined':report.verdict==='none_observed'?'No indicators found':report.verdict==='signature_match'?'Threat signature detected':report.verdict==='suspicious'?'Suspicious file':report.verdict.replaceAll('_',' ')}</strong>
 <p>Inspected {report.inspectedBytes} of {report.logicalBytes} bytes.</p>
 <details className="glm-details"><summary>Report details</summary><p>{report.sha256?<code style={{overflowWrap:'anywhere'}}>SHA-256: {report.sha256}</code>:'Full-file SHA-256 unavailable; inspection is incomplete.'}</p>
 {report.evidence&&<p>Zero bytes in inspected range: {report.evidence.zeroBytes} ({report.evidence.zeroPermille/10}%). Executable header: {report.evidence.peHeaderPresent?'observed':'not observed'}.</p>}
 </details><p>{report.findings.length?report.findings.map(f=>f.replaceAll('_',' ')).join(', '):'No local indicator observed. This does not guarantee safety.'}</p>
 <button className="btn ghost" disabled={quarantined.has(snapshot.jobRef+':'+report.reportRef)||!quarantineAvailable||busy||running||selection?.kind!=='file'||selection.id!==state?.scan?.id||snapshot.cancellationRequested||report.state!=='completed'||!report.sha256||report.logicalBytes!==report.inspectedBytes||!['suspicious','signature_match'].includes(report.verdict)||snapshot.reports.length!==1} onClick={()=>void disposition(false,report.reportRef)}>{quarantined.has(snapshot.jobRef+':'+report.reportRef)?'Quarantined':quarantineAvailable?'Quarantine…':'Quarantine unavailable'}</button>
 </div>)}</section>}
 </section>;
}
