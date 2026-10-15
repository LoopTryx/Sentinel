import {useState} from 'react';
import {demoCall} from '../../demo-bridge';

export default function DuckyControlPanel({enabled}:{enabled:boolean}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function open(){setBusy(true);setError('');try{await demoCall('usb.ducky.open');}catch{setError('The device control could not open. Try again from the Sentinel tray menu.');}finally{setBusy(false);}}
 return <section className="panel" aria-labelledby="profiled-usb-heading">
  <div className="usb-toolbar"><div><h3 id="profiled-usb-heading">Profiled Ducky</h3><p>RP2040-Zero · five-minute hold and release</p></div><button className="btn" disabled={!enabled||busy} onClick={()=>void open()}>{busy?'Opening…':'Manage device'}</button></div>
  <p>Windows approval is required. This control applies to the enrolled device on this computer.</p>
  {error&&<p role="alert">{error}</p>}
 </section>;
}
