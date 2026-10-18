using System;using System.Collections.Generic;
// Native card references select fresh HID functions, never renderer-supplied IDs.
internal static class UsbHidAdmissionSelection {
 internal static UsbHidAdmissionPolicy.Request Prepare(string action,UsbHidAdmissionPolicy.Snapshot before,UsbAdmissionInventory.Result inventory,string reference,string salt,string topology,string ownerSid,DateTime now){
  if(before==null||before.OwnerSid!=ownerSid||now.Kind!=DateTimeKind.Utc||before.Generation==ulong.MaxValue)throw new InvalidOperationException("HID authenticated before decision required");UsbHidAdmissionNativeAuthority.CheckBefore(before,inventory,topology);
  var approvals=new HashSet<string>(before.ExternalApprovals,StringComparer.Ordinal);var targets=new List<string>();
  if(action=="block"||action=="allow"){
   if(string.IsNullOrEmpty(reference)||reference.Length!=64)throw new InvalidOperationException("HID card reference required");List<string> selected=null;foreach(var group in UsbAdmissionTabModel.Groups(inventory))if(UsbAdmissionTabModel.Reference(salt,group.Key)==reference){if(selected!=null)throw new InvalidOperationException("Ambiguous HID card");selected=group.Value;}
   if(selected==null||selected.Count==0||selected.Count>8)throw new InvalidOperationException("HID card unavailable");foreach(string raw in selected){string id=raw.ToUpperInvariant();UsbExactBlockState.ValidateId(id);int matches=0;foreach(var subject in inventory.Subjects)if(string.Equals(subject.Input.Instance,id,StringComparison.OrdinalIgnoreCase))matches++;if(matches!=1)throw new InvalidOperationException("HID source ambiguous");bool changed=action=="allow"?approvals.Add(id):approvals.Remove(id);if(changed)targets.Add(id);}if(targets.Count==0)throw new InvalidOperationException("HID card unchanged");
  }else if(action!="activate"&&action!="deactivate")throw new InvalidOperationException("HID action refused");
  var next=new List<string>(approvals);next.Sort(StringComparer.Ordinal);targets.Sort(StringComparer.Ordinal);bool active=action=="activate"?true:action=="deactivate"?false:before.Active;var after=new UsbHidAdmissionPolicy.Snapshot(checked(before.Generation+1),ownerSid,active,before.InternalSafety,next.ToArray(),before.ReceiptDigest);
  var request=new UsbHidAdmissionPolicy.Request(action,before,after,targets.ToArray(),Guid.NewGuid().ToString("N"),topology,now,now.AddMinutes(5));UsbHidAdmissionNativeAuthority.CheckBefore(request.Before,inventory,request.TopologyHash);return request;
 }
}
