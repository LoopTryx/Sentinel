const ref=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(v);
const decimal=v=>typeof v==='string'&&/^(0|[1-9][0-9]{0,19})$/.test(v)&&BigInt(v)<=18446744073709551615n;
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&Object.keys(v).every(k=>keys.includes(k));
const states=new Set(['completed','partial','cancelled','timed_out','busy','unsupported','access_error','changed','engine_failed','limit_reached','depth_limit']);
const findings=new Set(['hash_signature','synthetic_marker','script_indicators','ransom_note_indicators','autorun_indicators','disguised_filename','high_entropy_executable','large_zero_filled_range','disguised_executable_header','other_local_indicator']);

// Closed redacted output validator. Rust DTOs remain authoritative.
export function validSnapshot(s) {
 if(!exact(s,['selectionRef','jobRef','state','cancellationRequested','currentFileBytes','reports'])||!ref(s.selectionRef)||!ref(s.jobRef)||!['running','finished','failed'].includes(s.state)||typeof s.cancellationRequested!=='boolean'||!decimal(s.currentFileBytes)||BigInt(s.currentFileBytes)>8388608n||!Array.isArray(s.reports)||s.reports.length>65)return false;
 const ids=new Set();
 for(const r of s.reports){
  if(!exact(r,['reportRef','state','verdict','coverage','logicalBytes','inspectedBytes','sha256','evidence','findings'])||!/^report_(0|[1-9][0-9]?)$/.test(r.reportRef)||Number(r.reportRef.slice(7))>64||ids.has(r.reportRef)||!states.has(r.state)||!['none_observed','suspicious','signature_match','synthetic_test','unknown'].includes(r.verdict)||!['partial','unsupported'].includes(r.coverage)||!decimal(r.logicalBytes)||!decimal(r.inspectedBytes)||BigInt(r.inspectedBytes)>BigInt(r.logicalBytes)||BigInt(r.inspectedBytes)>8388608n||!Array.isArray(r.findings)||r.findings.length>10||new Set(r.findings).size!==r.findings.length||r.findings.some(f=>!findings.has(f)))return false;
  ids.add(r.reportRef);
  if(r.sha256!==null&&(typeof r.sha256!=='string'||! /^[a-f0-9]{64}$/.test(r.sha256)))return false;
  if(r.state==='completed'&&(r.inspectedBytes!==r.logicalBytes||r.sha256===null))return false;
  if(r.state!=='completed'&&r.sha256!==null)return false;
  if(r.evidence!==null){
   const e=r.evidence;
   if(!exact(e,['zeroBytes','zeroPermille','rangeComplete','peHeaderPresent'])||!decimal(e.zeroBytes)||BigInt(e.zeroBytes)>BigInt(r.inspectedBytes)||!Number.isInteger(e.zeroPermille)||e.zeroPermille<0||e.zeroPermille>1000||typeof e.rangeComplete!=='boolean'||e.rangeComplete!==(r.logicalBytes===r.inspectedBytes)||typeof e.peHeaderPresent!=='boolean')return false;
   const count=BigInt(r.inspectedBytes), expected=count===0n?0:Number(BigInt(e.zeroBytes)*1000n/count);
   if(e.zeroPermille!==expected)return false;
  }
 }
 return true;
}

