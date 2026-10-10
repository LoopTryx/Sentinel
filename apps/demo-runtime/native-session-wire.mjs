import {validSnapshot} from './native-inspection.mjs';

const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&Object.keys(v).every(k=>keys.includes(k));
const ref=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(v);
const report=v=>typeof v==='string'&&/^report_(0|[1-9][0-9]?)$/.test(v)&&Number(v.slice(7))<=64;
const receipt=q=>exact(q,['actionRef','selectionRef','jobRef','reportRef','vaultFile','state'])&&ref(q.actionRef)&&ref(q.selectionRef)&&ref(q.jobRef)&&report(q.reportRef)&&typeof q.vaultFile==='string'&&/^[a-f0-9]{32}\.qtn$/.test(q.vaultFile)&&['quarantined','original_retained'].includes(q.state);

// Validate every private-pipe envelope before a native parent consumes it.
// This is correlation validation, not caller authentication or OS consent.
export function validSessionMessage(m){
 if(!exact(m,['type','data']))return false;
 const d=m.data;
 switch(m.type){
  case 'scan':return validSnapshot(d);
  case 'error':return exact(d,['code'])&&['unavailable','busy','invalid_request','job_unavailable','report_unavailable','action_unavailable','declined','action_failed'].includes(d.code);
  case 'quarantine_receipt':return receipt(d);
  case 'quarantine_preview':return exact(d,['actionRef','selectionRef','jobRef','reportRef','expiresAfterSeconds','inspection'])&&ref(d.actionRef)&&ref(d.selectionRef)&&ref(d.jobRef)&&report(d.reportRef)&&d.expiresAfterSeconds===30&&d.inspection?.reportRef===d.reportRef&&d.inspection.state==='completed'&&validSnapshot({selectionRef:d.selectionRef,jobRef:d.jobRef,state:'finished',cancellationRequested:false,currentFileBytes:'0',reports:[d.inspection]});
  case 'restore_preview':return exact(d,['restoreRef','quarantine','expiresAfterSeconds'])&&ref(d.restoreRef)&&receipt(d.quarantine)&&d.quarantine.state==='quarantined'&&d.expiresAfterSeconds===30;
  case 'restore_receipt':return exact(d,['restoreRef','quarantine','state'])&&ref(d.restoreRef)&&receipt(d.quarantine)&&d.quarantine.state==='quarantined'&&d.state==='restored';
  default:return false;
 }
}
