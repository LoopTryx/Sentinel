import {useEffect,useRef,useState} from 'react';
import {demoCall,useDemoState} from '../../demo-bridge';
import {parseUsbTab,type UsbTabSnapshot,type UsbTabDevice} from './tab-contract';
import './usb-guard.css';
const labels={allowed:'Allowed',restricted:'Windows reports device stopped',policy_only:'Rule saved · input blocking not confirmed',off:'Not restricted',unverified:'Access not verified'};
type Choice={action:'block'|'allow'|'scan';device:UsbTabDevice;topology:string|null};
function friendly(error:unknown){const code=error instanceof Error?error.message:'';return code==='device_scope_repair_required'?'Blocking is paused while device isolation is repaired.':code==='shared_rule_release_required'?'Release the protection session before reconnecting this device.':code==='approval_cancelled'?'Windows approval was cancelled. No change is confirmed.':code==='device_list_changed'?'The connected devices changed. Refresh and try again.':code==='action_busy'?'Another device action is finishing. Please wait.':code==='action_unavailable'?'Bring Sentinel to the front, then try the action again.':'Device access could not be verified. Refresh to reconnect.';}
export default function UsbGuardView(){
 const {state}=useDemoState();const [snapshot,setSnapshot]=useState<UsbTabSnapshot|null>(null),[busy,setBusy]=useState(''),[notice,setNotice]=useState(''),[stale,setStale]=useState(false),[choice,setChoice]=useState<Choice|null>(null),[refresh,setRefresh]=useState(0);
 const generation=useRef(0),pending=useRef(false),closeButton=useRef<HTMLButtonElement>(null),restoreFocus=useRef<HTMLElement|null>(null);
 useEffect(()=>{if(choice){restoreFocus.current=document.activeElement as HTMLElement;closeButton.current?.focus();return()=>restoreFocus.current?.focus();}},[choice]);
 useEffect(()=>{const epoch=++generation.current;setChoice(null);setBusy('');pending.current=false;if(!state){setSnapshot(null);setNotice('');setStale(false);return;}
  let stopped=false;async function read(){if(stopped||pending.current)return;pending.current=true;try{const value=parseUsbTab(await demoCall('usb.admission.snapshot'));if(!value)throw Error('Invalid device state.');if(!stopped&&generation.current===epoch){setSnapshot(value);setStale(false);setNotice('');}}catch(error){if(!stopped&&generation.current===epoch){setStale(true);setNotice(friendly(error));}}finally{if(generation.current===epoch)pending.current=false;}}
  void read();const timer=setInterval(()=>void read(),10000);return()=>{stopped=true;clearInterval(timer);};
 },[!!state,refresh]);
 async function confirm(){if(!choice||choice.action==='scan'||!choice.topology||pending.current)return;const selected=choice;const epoch=generation.current;pending.current=true;setBusy(selected.device.ref);setNotice('Waiting for Windows authorization…');
  try{const value=parseUsbTab(await demoCall('usb.admission.action',{action:selected.action,ref:selected.device.ref,topology:selected.topology}));if(!value)throw Error('Windows access could not be verified.');if(generation.current===epoch){setSnapshot(value);setStale(false);setNotice(value.message);setChoice(null);}}
  catch(error){if(generation.current===epoch){setStale(true);setNotice(friendly(error));setChoice(null);}}
  finally{if(generation.current===epoch){pending.current=false;setBusy('');}}
 }
 const connected=!!state;const status=!connected?'Desktop disconnected':stale?'Update needed':!snapshot?.verified?'Access not verified':snapshot.active?snapshot.persistent?'Persistent rules saved':`Active until ${new Date(snapshot.deadline!).toLocaleTimeString()}`:'Protection session inactive';
 return <section className="usb-guard usb-minimal" aria-labelledby="usb-heading">
  <div className="usb-page-heading"><h2 id="usb-heading">USB Guard</h2><span className="usb-mode">{status}</span></div>
  {notice&&<p role="status" className="usb-action-status">{notice}</p>}
  <section className="panel usb-inline-devices"><div className="usb-toolbar"><h3>Connected devices</h3><button className="btn ghost" disabled={!connected||!!busy} onClick={()=>setRefresh(n=>n+1)}>Refresh</button></div>
   {connected&&snapshot?<div className="usb-device-list">{snapshot.devices.map(device=><article key={device.ref} data-usb-device className="usb-device-card usb-inline-row">
    <div className="usb-device-title"><span className="usb-device-glyph" aria-hidden="true">⌨</span><div><strong>{device.name}</strong><span className="usb-device-reference">{busy===device.ref?'Working…':stale?'Update needed':labels[device.access]}</span></div></div>
    <div className="usb-row-actions">{(['block','allow','scan'] as const).map(action=><button key={action} className={`btn ${action==='allow'?'':'ghost'}`} disabled={!!busy||stale||!device.canChange||action==='block'&&!device.canBlock} title={action==='block'&&!device.canBlock?'Blocking is unavailable until native qualification passes':undefined} onClick={()=>setChoice({action,device,topology:snapshot.topology})}>{action[0].toUpperCase()+action.slice(1)}</button>)}</div>
   </article>)}{!snapshot.devices.length&&<p>{snapshot.topology?'No external USB input devices connected.':'Device inventory is incomplete. Refresh to try again.'}</p>}</div>:<p>{!connected?'Desktop disconnected.':stale?'Could not update devices. Use Refresh to try again.':'Loading devices…'}</p>}
  </section>
  {choice&&<div className="usb-dialog-shade"><div role="dialog" aria-modal="true" aria-labelledby="usb-dialog-title" className="usb-action-dialog" onKeyDown={e=>{if(e.key==='Escape'&&!busy)setChoice(null);if(e.key==='Tab'){const buttons=Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));if(buttons.length){const first=buttons[0],last=buttons[buttons.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}}}>
   <span className="usb-dialog-eyebrow">USB Guard</span><h3 id="usb-dialog-title">{choice.action==='scan'?'Scan device':choice.action==='allow'?'Allow device?':'Block device?'}</h3><strong className="usb-dialog-device">{choice.device.name}</strong>
   <p>{choice.action==='scan'?'No accessible storage has been verified for this device. HID input and firmware cannot be scanned as files.':choice.action==='allow'?'Windows Hello verifies your identity before this device is allowed.':'Windows Hello verifies your identity before input from this device is restricted.'}</p>
   {choice.action!=='scan'&&<p className="usb-dialog-detail">{choice.action==='block'?'The selected device remains restricted across Windows restarts until you allow it. Other device rules are preserved.':snapshot?.persistent?'Only this device’s restriction is removed. Reconnect it afterward; Windows may require a restart.':'This recovery action reconnects only the selected device. It does not start a new blocking rule.'}</p>}
   {busy&&<p role="status" className="usb-dialog-progress">Applying your change. Keep the device connected…</p>}
   <div className="usb-dialog-buttons"><button ref={closeButton} className="btn ghost" disabled={!!busy} onClick={()=>setChoice(null)}>{choice.action==='scan'?'Close':'Cancel'}</button>{choice.action!=='scan'&&<button className="btn" disabled={!!busy||stale} onClick={()=>void confirm()}>{busy?'Working…':choice.action==='allow'?'Confirm Allow':'Confirm Block'}</button>}</div>
  </div></div>}
 </section>;
}
