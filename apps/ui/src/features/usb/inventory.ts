/** Report-only boundary. These observations cannot authorize an OS action. */
export const MAX_REPORT_BYTES=32768;
const kinds=['storage','hid_keyboard','hid_mouse','hid_other','network','other'] as const;
export type UsbInterface=typeof kinds[number];
export interface UsbDeviceObservation {ref:string;usbEvidence:'os_reported'|'unresolved';interfaces:UsbInterface[]}
export interface UsbInventory {schemaVersion:1;mode:'observation_only';state:'observed'|'partial'|'unavailable';observedAt:string;omitted:number;devices:UsbDeviceObservation[]}
function object(value:unknown):value is Record<string,unknown>{return typeof value==='object'&&value!==null&&!Array.isArray(value);}
function keys(value:Record<string,unknown>,expected:string[]){return Object.keys(value).sort().join('|')===expected.sort().join('|');}
export function parseUsbInventory(text:string,now=Date.now()):UsbInventory|null{
  // All schema values are ASCII; bound encoded bytes before JSON allocation.
  if(text.length>MAX_REPORT_BYTES||/[^\x00-\x7f]/.test(text)||!Number.isFinite(now))return null;
  let raw:unknown;try{raw=JSON.parse(text);}catch{return null;}
  if(!object(raw)||!keys(raw,['schemaVersion','mode','state','observedAt','omitted','devices']))return null;
  if(raw.schemaVersion!==1||raw.mode!=='observation_only'||!['observed','partial','unavailable'].includes(raw.state as string))return null;
  if(typeof raw.observedAt!=='string')return null;
  const observed=Date.parse(raw.observedAt);
  if(!Number.isFinite(observed)||new Date(observed).toISOString()!==raw.observedAt||observed>now+5000)return null;
  if(!Number.isInteger(raw.omitted)||(raw.omitted as number)<0||(raw.omitted as number)>512||!Array.isArray(raw.devices)||raw.devices.length>64)return null;
  if(raw.state==='unavailable'&&raw.devices.length!==0||raw.state==='observed'&&raw.omitted!==0)return null;
  const seen=new Set<string>();
  for(const device of raw.devices){
    if(!object(device)||!keys(device,['ref','usbEvidence','interfaces'])||typeof device.ref!=='string'||!/^device-([1-9]|[1-5][0-9]|6[0-4])$/.test(device.ref)||seen.has(device.ref))return null;
    seen.add(device.ref);
    if(!['os_reported','unresolved'].includes(device.usbEvidence as string)||raw.state==='observed'&&device.usbEvidence==='unresolved')return null;
    if(!Array.isArray(device.interfaces)||device.interfaces.length<1||device.interfaces.length>kinds.length||new Set(device.interfaces).size!==device.interfaces.length||device.interfaces.some(kind=>!kinds.includes(kind)))return null;
  }
  return raw as unknown as UsbInventory;
}
export function usbFreshness(report:UsbInventory,now:number):'recent snapshot'|'stale snapshot'{const age=now-Date.parse(report.observedAt);return Number.isFinite(age)&&age>=0&&age<60000?'recent snapshot':'stale snapshot';}
export const interfaceLabels:Record<UsbInterface,string>={storage:'Storage',hid_keyboard:'Keyboard input',hid_mouse:'Pointer input',hid_other:'Other HID input',network:'Network interface',other:'Other / unsupported interface'};
