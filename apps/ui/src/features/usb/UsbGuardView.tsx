import {useState} from 'react';
import {demoCall,useDemoState} from '../../demo-bridge';
import {useAutoRefresh} from '../../use-auto-refresh';
import {parseUsbInventory,type UsbInventory} from './inventory';
import './usb-guard.css';
function deviceName(interfaces:string[]){
 const keyboard=interfaces.includes('hid_keyboard'),mouse=interfaces.includes('hid_mouse'),storage=interfaces.includes('storage');
 const input=keyboard&&mouse?'Keyboard + mouse':keyboard?'Keyboard':mouse?'Mouse':interfaces.includes('hid_other')?'Input device':'';
 return input?(storage?input+' + storage':input):storage?'Storage':'Other USB interface';
}
export default function UsbGuardView(){
 const {state,error}=useDemoState();
 const [inventory,setInventory]=useState<UsbInventory|null>(null);
 const [observing,setObserving]=useState(false),[notice,setNotice]=useState('');
 async function observe(){setObserving(true);setNotice('');try{const parsed=parseUsbInventory(JSON.stringify(await demoCall('usb.observe')));if(!parsed)throw Error();setInventory(parsed);}catch{setInventory(null);setNotice('USB observations unavailable.');}finally{setObserving(false);}}
 useAutoRefresh(observe,15000,!!state);
 const useful=inventory?.devices.filter(d=>d.usbEvidence==='os_reported'&&d.interfaces.some(i=>i==='storage'||i.startsWith('hid_')))??[];
 const other=inventory?.devices.filter(d=>!useful.includes(d))??[];
 const named=useful.filter(d=>!!d.name),unnamed=useful.length-named.length;
 return <section className="usb-guard usb-minimal" aria-labelledby="usb-heading">
  <div className="usb-page-heading"><h2 id="usb-heading">USB Guard</h2><span className="usb-mode">Automatic observations</span></div>
  <section className="panel"><div className="usb-toolbar"><h3>Input and storage</h3><button className="btn ghost" disabled={observing||!state} onClick={()=>void observe()}>{observing?'Updating…':'Refresh'}</button></div>
   {(notice||error)&&<p role="status">{notice||error}</p>}
   {inventory?<><p className="usb-inventory-count">{useful.length} input/storage {useful.length===1?'entry':'entries'}</p>{named.map(device=>{
    const hid=device.interfaces.some(i=>i.startsWith('hid_')),storage=device.interfaces.includes('storage');
    return <article key={device.ref} className="usb-device-row"><div><strong>{device.name}</strong><div className="small">{deviceName(device.interfaces)}</div></div><span className="usb-chip">{storage?'Not scanned':hid?'Input':'Detected'}</span>
    </article>;
   })}{unnamed>0&&<div className="usb-device-row"><strong>Unnamed input/storage interfaces</strong><span className="usb-chip">{unnamed}</span></div>}{!useful.length&&<p>No input/storage group was identified in this snapshot.</p>}
   <details><summary>Other interfaces ({other.length})</summary><p>Hubs, other interfaces and unidentified entries. These are not a count of physical devices.</p>{other.map(d=><p key={d.ref}>{d.usbEvidence==='unresolved'?'Unidentified interface':deviceName(d.interfaces)}</p>)}</details>
   <details><summary>Detection details</summary><p>{inventory.state} observation. Names are Windows-reported descriptions, not authenticated identity. Unnamed interfaces are combined into a count, not presented as separate physical devices. HID input and storage share a group only when Windows reports both together. Storage inspection is unavailable until its mounted volume is verified. External versus internal placement is not verified. Reading storage cannot establish HID safety. Quarantine and HID blocking are not enabled.</p></details>
   </>:<p>{state?'Reading USB interfaces…':'Open the desktop connection to receive observations.'}</p>}
  </section>
 </section>;
}
