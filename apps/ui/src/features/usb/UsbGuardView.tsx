import PageMascot from '../../components/PageMascot';
import {useEffect,useRef,useState} from 'react';
import {demoCall,useDemoState} from '../../demo-bridge';
import {parseUsbTab,type UsbTabSnapshot,type UsbTabDevice} from './tab-contract';
import './usb-guard.css';
import Icon from '../../components/Icon';
const labels={allowed:'Allowed',restricted:'Device stopped',policy_only:'Restriction saved · reconnect to check',off:'Not restricted',unverified:'Access not verified'};
type Choice={action:'block'|'allow'|'scan';device:UsbTabDevice;topology:string|null};
function friendly(error:unknown){const code=error instanceof Error?error.message:'';if(code==='usb_recovery_required')return 'An interrupted USB change must be recovered. Reconnect USB Guard before trying again.';const stages:Record<string,string>={usb_failed_initialize:'Could not verify the protected USB state.',usb_failed_selection:'The connected device list could not be verified.',usb_failed_owner_verification:'Device evidence or Windows Hello verification did not complete.',usb_failed_enforcement:'Windows could not apply the USB rule. Recovery was attempted.',usb_failed_readback:'Windows policy readback did not match the requested change.'};const detail=/^(usb_failed_(?:initialize|selection|owner_verification|enforcement|readback))_([A-F0-9]{8})$/.exec(code);if(detail)return `${stages[detail[1]]} (${detail[2]})`;if(stages[code])return stages[code];return code==='device_scope_repair_required'?'Blocking is paused while device isolation is repaired.':code==='shared_rule_release_required'?'Release the protection session before reconnecting this device.':code==='approval_cancelled'?'Windows approval was cancelled. No change is confirmed.':code==='device_list_changed'?'The connected devices changed. Refresh and try again.':code==='action_busy'?'Another device action is finishing. Please wait.':code==='action_unavailable'?'Bring Sentinel to the front, then try the action again.':'Device access could not be verified. Refresh to reconnect.';}
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
 async function activateGuard(){
  if(!snapshot?.canActivate||!snapshot.topology||pending.current)return;
  const epoch=generation.current;pending.current=true;setBusy('activation');setNotice('Waiting for Windows Hello…');
  try{const value=parseUsbTab(await demoCall('usb.admission.action',{action:'activate',topology:snapshot.topology}));if(!value)throw Error('Windows access could not be verified.');if(generation.current===epoch){setSnapshot(value);setStale(false);setNotice(value.message);}}
  catch(error){if(generation.current===epoch){setStale(true);setNotice(friendly(error));}}
  finally{if(generation.current===epoch){pending.current=false;setBusy('');}}
 }
 async function connectGuard(){
  if(!snapshot?.canConnect||pending.current)return;const epoch=generation.current;pending.current=true;setBusy('connection');setNotice('Waiting for Windows authorization…');
  try{const value=parseUsbTab(await demoCall('usb.admission.action',{action:'connect'}));if(!value)throw Error('Connection could not be verified.');if(generation.current===epoch){setSnapshot(value);setStale(false);setNotice(value.message);}}
  catch(error){if(generation.current===epoch){setStale(true);setNotice(friendly(error));}}
  finally{if(generation.current===epoch){pending.current=false;setBusy('');}}
 }
 async function restoreInputs(){
  if(!snapshot?.canDeactivate||pending.current)return;const epoch=generation.current;pending.current=true;setBusy('recovery');setNotice('Waiting for Windows Hello…');
  try{const value=parseUsbTab(await demoCall('usb.admission.action',{action:'deactivate'}));if(!value)throw Error('Recovery could not be verified.');if(generation.current===epoch){setSnapshot(value);setStale(false);setNotice(value.message);}}
  catch(error){if(generation.current===epoch){setStale(true);setNotice(friendly(error));}}
  finally{if(generation.current===epoch){pending.current=false;setBusy('');}}
 }
 const connected=!!state;const status=!connected?'Desktop disconnected':stale?'Update needed':!snapshot?.verified?'Access not verified':snapshot.active?snapshot.persistent?'Device rules active':`Active until ${new Date(snapshot.deadline!).toLocaleTimeString()}`:'USB Guard is off';
 return <section className="usb-guard usb-minimal" aria-labelledby="usb-heading">
  <div className="usb-page-heading"><div><span className="usb-eyebrow">DEVICE ACCESS</span><h2 id="usb-heading">USB Guard</h2><p>Control access to external input devices.</p></div><span className={'usb-mode'+(snapshot?.active&&!stale?' is-active':'')}><i aria-hidden="true"/>{status}</span><PageMascot page="usb"/></div>
  {notice&&<p role="status" className="usb-action-status">{notice}</p>}
  <section className="panel usb-inline-devices"><div className="usb-toolbar"><h3>Connected devices <span className="usb-device-count">{snapshot?.devices.length??'—'}</span></h3><div className="usb-toolbar-actions">{snapshot?.canConnect&&<button className="btn" disabled={!!busy||stale} onClick={()=>void connectGuard()}>Connect USB Guard</button>}{snapshot?.canDeactivate&&<button className="btn ghost" disabled={!!busy} onClick={()=>void restoreInputs()}>Restore inputs</button>}{snapshot?.canActivate&&<button className="btn" disabled={!!busy||stale} onClick={()=>void activateGuard()}>Enable USB Guard</button>}<button className="btn ghost" disabled={!connected||!!busy} onClick={()=>setRefresh(n=>n+1)}><Icon name="refresh" size={14}/>Refresh</button></div></div>
   {connected&&snapshot?<div className="usb-device-list">{snapshot.devices.map(device=><article key={device.ref} data-usb-device className="usb-device-card usb-inline-row">
    <div className="usb-device-title"><span className="usb-device-glyph" aria-hidden="true"><Icon name="usb" size={22}/></span><div><strong>{device.name}</strong><span className="usb-device-reference" data-access={device.access}><i aria-hidden="true"/>{busy===device.ref?'Working…':stale?'Update needed':labels[device.access]}</span></div></div>
    <div className="usb-row-actions"><span className="usb-access-caption">{device.access==='allowed'?'Allowed':device.access==='off'?'Guard off':device.access==='unverified'?'Unverified':device.access==='policy_only'?'Rule saved':'Restricted'}</span><button type="button" role="switch" aria-checked={device.access==='allowed'} aria-label={'Allow access to '+device.name} className="usb-access-switch" disabled={!!busy||stale||!device.canChange||(device.access==='allowed'&&!device.canBlock)||device.access==='unverified'||device.access==='off'} onClick={()=>setChoice({action:device.access==='allowed'?'block':'allow',device,topology:snapshot.topology})}><span/></button><button className="btn ghost" disabled={!!busy||stale||!device.canChange} onClick={()=>setChoice({action:'scan',device,topology:snapshot.topology})}>Scan</button></div>
   </article>)}{!snapshot.devices.length&&<div className="usb-empty"><Icon name="usb" size={28}/><p>{snapshot.topology?'No external USB input devices connected.':'Device inventory is incomplete. Refresh to try again.'}</p></div>}</div>:<p>{!connected?'Desktop disconnected.':stale?'Could not update devices. Use Refresh to try again.':'Loading devices…'}</p>}
   <footer className="usb-panel-footer"><Icon name="shield" size={14}/><span>Built-in keyboard and trackpad are excluded.</span></footer>
  </section>
  {choice&&<div className="usb-dialog-shade"><div role="dialog" aria-modal="true" aria-labelledby="usb-dialog-title" className="usb-action-dialog" onKeyDown={e=>{if(e.key==='Escape'&&!busy)setChoice(null);if(e.key==='Tab'){const buttons=Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));if(buttons.length){const first=buttons[0],last=buttons[buttons.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}}}>
   <span className="usb-dialog-eyebrow">USB Guard</span><h3 id="usb-dialog-title">{choice.action==='scan'?'Scan device':choice.action==='allow'?'Allow device?':'Block device?'}</h3><strong className="usb-dialog-device">{choice.device.name}</strong>
   <p>{choice.action==='scan'?'No accessible storage has been verified for this device. HID input and firmware cannot be scanned as files.':choice.action==='allow'?'Windows Hello verifies your identity before this device is allowed.':'Windows Hello verifies your identity before input from this device is restricted.'}</p>
   {choice.action!=='scan'&&<p className="usb-dialog-detail">{choice.action==='block'?'The selected device has a saved restriction across Windows restarts until you allow it. Reconnect and check that input stops.':snapshot?.persistent?'Only the selected restriction is removed. Reconnect the device and test input; Windows may require a restart.':'This recovery action reconnects only the selected device. It does not start a new blocking rule.'}</p>}
   {busy&&<p role="status" className="usb-dialog-progress">Applying your change. Keep the device connected…</p>}
   <div className="usb-dialog-buttons"><button ref={closeButton} className="btn ghost" disabled={!!busy} onClick={()=>setChoice(null)}>{choice.action==='scan'?'Close':'Cancel'}</button>{choice.action!=='scan'&&<button className="btn" disabled={!!busy||stale} onClick={()=>void confirm()}>{busy?'Working…':choice.action==='allow'?'Confirm Allow':'Confirm Block'}</button>}</div>
  </div></div>}
 </section>;
}
