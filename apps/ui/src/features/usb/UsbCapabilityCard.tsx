import './usb-guard.css';
export default function UsbCapabilityCard({connected,onOpen}:{connected:boolean;onOpen?:()=>void}){
 return <section className="panel usb-summary" aria-labelledby="usb-summary-heading">
  <div className="usb-toolbar"><h3 id="usb-summary-heading">USB Guard</h3>{onOpen&&<button className="btn" onClick={onOpen}>Open USB Guard</button>}</div>
  <dl className="usb-summary-grid">
   <div><dt>Storage inspection</dt><dd>{connected?'Selected folders · partial coverage':'Desktop disconnected'}</dd></div>
   <div><dt>BadUSB / HID prevention</dt><dd>Unavailable · no verified input gate</dd></div>
   <div><dt>Virtual payload analysis</dt><dd>Unavailable · no isolated execution service</dd></div>
   <div><dt>Device monitoring</dt><dd>Manual snapshot · not live</dd></div>
  </dl>
  <p>File inspection never approves keyboard input. A quiet virtual test cannot establish that a device is safe.</p>
 </section>;
}
