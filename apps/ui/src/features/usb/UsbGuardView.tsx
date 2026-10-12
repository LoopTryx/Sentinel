import {useState} from 'react';
import {demoCall,useDemoState} from '../../demo-bridge';
import {useAutoRefresh} from '../../use-auto-refresh';
import {parseUsbInventory,interfaceLabels,type UsbInventory} from './inventory';
import './usb-guard.css';
export default function UsbGuardView(){
 const {state,error}=useDemoState();
 const [inventory,setInventory]=useState<UsbInventory|null>(null);
 const [observing,setObserving]=useState(false),[notice,setNotice]=useState('');
 async function observe(){setObserving(true);setNotice('');try{const parsed=parseUsbInventory(JSON.stringify(await demoCall('usb.observe')));if(!parsed)throw Error();setInventory(parsed);}catch{setInventory(null);setNotice('USB observations unavailable.');}finally{setObserving(false);}}
 useAutoRefresh(observe,15000,!!state);
 const useful=inventory?.devices.filter(d=>d.usbEvidence==='os_reported'&&d.interfaces.some(i=>i==='storage'||i.startsWith('hid_')))??[];
 const other=inventory?.devices.filter(d=>!useful.includes(d))??[];
 return <section className="usb-guard usb-minimal" aria-labelledby="usb-heading">
  <div className="usb-page-heading"><h2 id="usb-heading">USB Guard</h2><span className="usb-mode">Automatic observations</span></div>
  <section className="panel"><div className="usb-toolbar"><h3>Input and storage</h3><button className="btn ghost" disabled={observing||!state} onClick={()=>void observe()}>{observing?'Updating…':'Refresh'}</button></div>
   {(notice||error)&&<p role="status">{notice||error}</p>}
   {inventory?<><p>{useful.length} input/storage groups reported by Windows</p>{useful.map(device=>{
    const hid=device.interfaces.some(i=>i.startsWith('hid_')),storage=device.interfaces.includes('storage');
    return <article key={device.ref} className="usb-device-row"><strong>{hid?(storage?'Input + storage group':'Input group'):'Storage group'}</strong><p>{device.interfaces.map(i=>interfaceLabels[i]).join(' · ')}</p>
     {hid&&storage?<><p className="usb-exposure">HID input and storage share this Windows device group.</p><p>Storage inspection is unavailable until its mounted volume is verified.</p></>:hid?<p>Input interface detected.</p>:<p>Storage interface detected.</p>}
    </article>;
   })}{!useful.length&&<p>No input/storage group was identified in this snapshot.</p>}
   <details><summary>Other Windows USB entries ({other.length})</summary><p>Hubs, other interfaces and entries with unresolved USB ancestry. These are not a count of physical devices.</p>{other.map(d=><p key={d.ref}>{d.ref} · {d.usbEvidence==='unresolved'?'USB ancestry unverified':d.interfaces.map(i=>interfaceLabels[i]).join(' · ')}</p>)}</details>
   <details><summary>Coverage</summary><p>{inventory.state} observation. Windows groups interfaces; external versus internal placement is not verified. Reading storage cannot establish HID safety. Quarantine and HID blocking are not enabled.</p></details>
   </>:<p>{state?'Reading USB interfaces…':'Open the desktop connection to receive observations.'}</p>}
  </section>
 </section>;
}
