import {useState} from 'react';
import {demoCall,useDemoState} from '../../demo-bridge';
import './usb-guard.css';
import {parseUsbInventory,type UsbInventory} from './inventory';
import {useAutoRefresh} from '../../use-auto-refresh';
export default function UsbGuardView(){
 const {state,error}=useDemoState();const [busy,setBusy]=useState(false);const [notice,setNotice]=useState('');
 const [inventory,setInventory]=useState<UsbInventory|null>(null);const [observing,setObserving]=useState(false);
 async function observe(){setObserving(true);setNotice('');try{const result=await demoCall('usb.observe');const parsed=parseUsbInventory(JSON.stringify(result));if(!parsed)throw Error('Device report unavailable.');setInventory(parsed);}catch{setInventory(null);setNotice('USB observations unavailable. Try again after the console connects.');}finally{setObserving(false);}}
 useAutoRefresh(observe,15000,!!state);
 const scan=state?.scan;const running=scan?.status==='running';
 async function choose(kind:'file'|'folder'){
  setBusy(true);setNotice('');
  try{const result=await demoCall('scan.select',{kind});if(result.cancelled)setNotice('Selection cancelled.');}
  catch(e){setNotice(e instanceof Error?e.message:'Checker unavailable.');}finally{setBusy(false);}
 }
 async function cancel(){try{await demoCall('cancel');}catch(e){setNotice(e instanceof Error?e.message:'Cancel unavailable.');}}
 return <section className="usb-guard usb-minimal" aria-labelledby="usb-heading">
  <div className="usb-page-heading"><h2 id="usb-heading">USB Guard</h2><span className="usb-mode">File checks only · HID blocking unavailable</span></div>
  <section className="panel usb-recent" aria-labelledby="usb-recent-heading"><div className="usb-toolbar"><h3 id="usb-recent-heading">Connected USB devices</h3><button className="btn ghost" disabled={observing||!state} onClick={()=>void observe()}>{observing?'Reading devices…':'Check devices'}</button></div>{inventory?<><p>{inventory.devices.length} device groups · {inventory.state} observation</p>{inventory.devices.map(device=><div key={device.ref} style={{padding:'12px 0',borderBottom:'1px solid var(--grid-line)'}}><strong>{device.ref}</strong><p>{device.interfaces.map(kind=>kind.replaceAll('_',' ')).join(' · ')}</p>{device.interfaces.includes('hid_keyboard')&&<p style={{color:'var(--warn)'}}>Keyboard input interface detected. Verify this device before trusting it.</p>}{device.interfaces.includes('hid_keyboard')&&device.interfaces.includes('storage')&&<p>Storage and keyboard interfaces share this device group.</p>}</div>)}{inventory.state==='partial'&&<p>Some devices could not be fully identified.</p>}</>:<p>Check the USB interfaces Windows currently reports.</p>}</section>
  <section className="panel usb-checker" aria-labelledby="usb-checker-heading"><div className="usb-toolbar"><h3 id="usb-checker-heading">USB file / folder checker</h3><span className="usb-chip">{state?'Connected':'Desktop disconnected'}</span></div>
   <p className="usb-check-note">Select a file or folder from your USB. Checks have partial coverage.</p>
   <div className="usb-check-actions"><button className="btn" disabled={!state||busy||running} onClick={()=>void choose('file')}>Choose file</button><button className="btn ghost" disabled={!state||busy||running} onClick={()=>void choose('folder')}>Choose folder</button>{running&&<button className="btn ghost" onClick={()=>void cancel()}>Cancel inspection</button>}</div>
   {(notice||error)&&<p role="status">{notice||error}</p>}
   {!state&&<p className="usb-check-note">Connect the desktop app to check files.</p>}
   {scan&&<div className="usb-check-result" aria-live="polite"><div className="usb-toolbar"><strong>{scan.status.replaceAll('_',' ')} · {scan.coverage} coverage</strong><span>{scan.checked} inspected · {scan.skipped} skipped · {scan.errors} errors</span></div>
    <p className="usb-check-note">Shared desktop scan · {scan.bytes.toLocaleString()} bytes read</p>
    {['failed','cancelled','timed_out','partial'].includes(scan.status)&&<p>Incomplete check. Uninspected files remain unknown.</p>}
    {scan.status==='completed'&&!scan.findings.length&&<p>No test marker found. Safety remains unknown.</p>}
    {scan.findings.length>0&&<ul>{scan.findings.map((finding,i)=><li key={i}><strong>{finding.kind==='synthetic_test'||finding.kind==='provider_synthetic_match'?'Test finding':'Finding'} · {finding.name}</strong><p>{finding.reason}</p></li>)}</ul>}
    <details><summary>Scan details</summary><p>{scan.engine}</p><p>Rust inspection checks local signatures and bounded byte clues with partial coverage. This scan does not approve USB input.</p>{scan.files.map((file,i)=><p key={i}>{file.name} · {file.bytes} bytes<br/><code>{file.sha256}</code></p>)}</details>
   </div>}
  </section>
 </section>;
}
