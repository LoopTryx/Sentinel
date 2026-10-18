import type {QuarantineInventory} from '@sentinel/contracts/generated/QuarantineInventory';
export function parseQuarantineInventory(value:unknown):QuarantineInventory|null{
 if(!value||typeof value!=='object'||Object.keys(value).length!==1||!Array.isArray((value as any).items)||(value as any).items.length>64)return null;
 const seen=new Set<string>();
 for(const item of (value as any).items){if(!item||typeof item!=='object'||Object.keys(item).length!==8||typeof item.reference!=='string'||item.reference.length!==36||!/^[a-f0-9]{32}\.qtn$/.test(item.reference)||seen.has(item.reference)||typeof item.fileName!=='string'||!item.fileName||item.fileName.length>320||/[\x00-\x1f\x7f]/.test(item.fileName)||typeof item.bytes!=='string'||!/^\d{1,8}$/.test(item.bytes)||Number(item.bytes)>8388608||typeof item.sha256!=='string'||item.sha256.length!==64||!/^[a-f0-9]{64}$/.test(item.sha256)||typeof item.addedAt!=='string'||!/^(|\d{1,12})$/.test(item.addedAt)||!['quarantined','original_retained','recovery_required'].includes(item.state)||typeof item.canRestore!=='boolean'||typeof item.canDestroy!=='boolean'||(item.state!=='quarantined'&&item.canDestroy))return null;seen.add(item.reference);}
 return value as QuarantineInventory;
}
