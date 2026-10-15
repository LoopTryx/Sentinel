import {useEffect,useRef,useState} from 'react';
import {demoCall,useDemoState} from '../../demo-bridge';
import {useAutoRefresh} from '../../use-auto-refresh';
import {parseUsbInventory,type UsbInventory,type UsbInterface} from './inventory';
import './usb-guard.css';
import UsbActivityPanel from './UsbActivityPanel';
import DuckyControlPanel from './DuckyControlPanel';
const labels:Record<UsbInterface,string>={hid_keyboard:'HID keyboard',hid_mouse:'HID mouse',hid_other:'Other HID',storage:'Storage',network:'Network',other:'Other interface'};
function fallbackName(interfaces:UsbInterface[]){
 const input=interfaces.includes('hid_keyboard')&&interfaces.includes('hid_mouse')?'Keyboard + mouse':interfaces.includes('hid_keyboard')?'Keyboard':interfaces.includes('hid_mouse')?'Mouse':interfaces.includes('hid_other')?'HID device':'';
 return input?(interfaces.includes('storage')?input+' with storage':input):interfaces.includes('storage')?'USB storage':'USB interface';
}
export default function UsbGuardView(){
 const {state}=useDemoState();
 const [inventory,setInventory]=useState<UsbInventory|null>(null);
 const [observing,setObserving]=useState(false),[notice,setNotice]=useState('');
 const epoch=useRef(0),sequence=useRef(0),active=useRef(!!state);active.current=!!state;
 useEffect(()=>{epoch.current++;setInventory(null);setObserving(false);return()=>{epoch.current++;};},[!!state]);
 async function observe(){const generation=epoch.current,request=++sequence.current;setObserving(true);setNotice('');try{const parsed=parseUsbInventory(JSON.stringify(await demoCall('usb.observe')));if(!parsed)throw Error();if(active.current&&generation===epoch.current&&request===sequence.current)setInventory(parsed);}catch{if(active.current&&generation===epoch.current&&request===sequence.current){setInventory(null);setNotice('Device inventory unavailable.');}}finally{if(generation===epoch.current&&request===sequence.current)setObserving(false);}}
 useAutoRefresh(observe,5000,!!state);
 const snapshot=state?inventory:null;
 const useful=snapshot?.devices.filter(d=>d.usbEvidence==='os_reported'&&d.interfaces.some(i=>i==='storage'||i==='hid_keyboard'||i==='hid_mouse'))??[];
 const other=snapshot?.devices.filter(d=>!useful.includes(d))??[];
 return <section className="usb-guard usb-minimal" aria-labelledby="usb-heading">
  <div className="usb-page-heading"><h2 id="usb-heading">USB Guard</h2><span className="usb-mode">{state?'Monitoring connected devices':'Desktop disconnected'}</span></div>
  <dl className="usb-status-strip"><div><dt>Unknown devices</dt><dd className="usb-status-warning">Not blocked</dd></div><div><dt>Profiled Ducky</dt><dd>Windows policy control</dd></div><div><dt>Storage scan</dt><dd>Not running</dd></div></dl>
  <DuckyControlPanel enabled={!!state}/>
  <section className="panel"><div className="usb-toolbar"><h3>Connected input and storage</h3><button className="btn ghost" disabled={observing||!state} onClick={()=>void observe()}>{observing?'Updating…':'Refresh'}</button></div>
   {notice&&<p role="status">{notice}</p>}
   {snapshot&&snapshot.state!=='unavailable'?<><p className="usb-inventory-count">{useful.length} Windows device groups · Updated {new Date(snapshot.observedAt).toLocaleTimeString()}{snapshot.state==='partial'?' · Incomplete inventory':''}</p>
    <div className="usb-device-list">{useful.map(device=><article key={device.ref} data-usb-device className="usb-device-card">
     <div className="usb-device-title"><span className="usb-device-glyph" aria-hidden="true">{device.interfaces.includes('storage')?'▣':device.interfaces.includes('hid_mouse')?'◉':'⌨'}</span><div><strong>{device.name||fallbackName(device.interfaces)}</strong><span className="usb-device-reference">{device.ref.replace('device-','Group ')} · Windows description</span></div><span className="usb-chip">{device.usbEvidence==='unresolved'?'USB ancestry unknown':'USB reported'}</span></div>
     <div className="usb-interface-tags">{device.interfaces.filter(i=>i!=='other').map(i=><span key={i}>{labels[i]}</span>)}</div>
     <dl className="usb-device-facts"><div><dt>Input access</dt><dd>{device.interfaces.some(i=>i.startsWith('hid_'))?'Not blocked':'No HID reported'}</dd></div><div><dt>Storage inspection</dt><dd>{device.interfaces.includes('storage')?'Not scanned':'No storage reported'}</dd></div><div><dt>Trust</dt><dd>Not enrolled</dd></div></dl>
    </article>)}</div>{!useful.length&&<p>No input or storage groups reported.</p>}
    <details><summary>Auxiliary and unresolved interfaces ({other.length})</summary>{other.map(d=><p key={d.ref}>{d.name||fallbackName(d.interfaces)} · {d.interfaces.map(i=>labels[i]).join(', ')} · {d.usbEvidence==='unresolved'?'USB ancestry unknown':'USB reported'}</p>)}</details>
    <details><summary>Device information</summary><p>Windows groups interfaces by reported identity. USB-connected built-in devices may appear here. Names do not establish trust. Missing records: {snapshot.omitted}.</p></details>
   </>:<p>{!state?'Desktop disconnected.':notice||snapshot?.state==='unavailable'?'Device inventory unavailable.':'Reading connected devices…'}</p>}
  </section>
  <UsbActivityPanel enabled={!!state}/>
 </section>;
}
