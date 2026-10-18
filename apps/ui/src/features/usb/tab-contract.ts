export type UsbAccess='allowed'|'restricted'|'policy_only'|'off'|'unverified';
export interface UsbTabDevice {ref:string;name:string;access:UsbAccess;canChange:boolean;canBlock:boolean;canScan:false}
export interface UsbTabSnapshot {schemaVersion:1;verified:boolean;topology:string|null;active:boolean;persistent?:boolean;canActivate?:boolean;deadline:string|null;devices:UsbTabDevice[];message:string}
export function parseUsbTab(value:unknown):UsbTabSnapshot|null {
 if(typeof value!=='object'||value===null)return null;const x=value as Record<string,unknown>;
 if(x.schemaVersion!==1||typeof x.verified!=='boolean'||typeof x.active!=='boolean'||!(x.topology===null||typeof x.topology==='string'&&/^[a-f0-9]{64}$/.test(x.topology))||!(x.deadline===null||typeof x.deadline==='string'&&Number.isFinite(Date.parse(x.deadline)))||typeof x.message!=='string'||x.message.length>2048||!Array.isArray(x.devices)||x.devices.length>256)return null;
 if(x.canActivate!==undefined&&typeof x.canActivate!=='boolean')return null;
 if(x.canActivate===true&&(!x.verified||x.active||x.topology===null))return null;
 if(x.persistent!==undefined&&typeof x.persistent!=='boolean')return null;
 if(x.persistent===true&&x.deadline!==null)return null;
 if(x.active&&(!x.verified||x.topology===null||x.deadline===null&&x.persistent!==true))return null;
 const refs=new Set<string>();for(const raw of x.devices){if(typeof raw!=='object'||raw===null)return null;const d=raw as Record<string,unknown>;if(typeof d.ref!=='string'||!/^[a-f0-9]{64}$/.test(d.ref)||refs.has(d.ref)||typeof d.name!=='string'||d.name.length<1||d.name.length>80||!['allowed','restricted','policy_only','off','unverified'].includes(d.access as string)||typeof d.canChange!=='boolean'||typeof d.canBlock!=='boolean'||d.canScan!==false)return null;refs.add(d.ref);}
 return x as unknown as UsbTabSnapshot;
}
