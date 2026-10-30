using System;using System.Collections.Generic;
// Native card references select fresh HID functions, never renderer-supplied IDs.
internal static class UsbHidAdmissionSelection {
 internal static string[] SelectExternal(UsbAdmissionInventory.Result inventory,string reference,string salt){
  if(string.IsNullOrEmpty(reference)||reference.Length!=64)throw new InvalidOperationException("HID card reference required");List<string> selected=null;foreach(var group in UsbAdmissionTabModel.Groups(inventory))if(UsbAdmissionTabModel.Reference(salt,group.Key)==reference){if(selected!=null)throw new InvalidOperationException("Ambiguous HID card");selected=group.Value;}
  if(selected==null||selected.Count==0||selected.Count>8)throw new InvalidOperationException("HID card unavailable");var ids=new List<string>();foreach(string raw in selected){string id=raw.ToUpperInvariant();UsbExactBlockState.ValidateId(id);int matches=0;foreach(var subject in inventory.Subjects)if(string.Equals(subject.Input.Instance,id,StringComparison.OrdinalIgnoreCase))matches++;if(matches!=1||ids.Contains(id))throw new InvalidOperationException("HID source ambiguous");ids.Add(id);}ids.Sort(StringComparer.Ordinal);return ids.ToArray();
 }
 internal static string[] ApprovedReconnect(UsbHidAdmissionPolicy.Snapshot before,UsbAdmissionInventory.Result inventory,string reference,string salt,string topology){
  UsbHidAdmissionNativeAuthority.CheckBefore(before,inventory,topology);var ids=SelectExternal(inventory,reference,salt);ReconnectBinding(before,topology,ids);return ids;
 }
 // A separate one-use native authorization for an already-allowed device. This
 // cannot mint a policy transition or reuse an earlier Allow proof.
 internal static UsbAdmissionAuthorization.Request ReconnectBinding(UsbHidAdmissionPolicy.Snapshot before,string topology,string[] ids){
  if(before==null||!before.Active||ids==null||ids.Length<1||ids.Length>8)throw new InvalidOperationException("Approved HID recovery required");var selected=new HashSet<string>(StringComparer.Ordinal);var approved=new HashSet<string>(before.ExternalApprovals,StringComparer.Ordinal);foreach(string id in ids){UsbExactBlockState.ValidateId(id);if(!approved.Contains(id)||!selected.Add(id))throw new InvalidOperationException("Approved HID recovery required");}var ordered=new List<string>(selected);ordered.Sort(StringComparer.Ordinal);
  string text="hid-allow-reconnect-v1\n"+before.Digest+"\n"+topology+"\n"+string.Join("\n",ordered.ToArray())+"\n"+Guid.NewGuid().ToString("N");string digest;using(var sha=System.Security.Cryptography.SHA256.Create())digest=BitConverter.ToString(sha.ComputeHash(System.Text.Encoding.UTF8.GetBytes(text))).Replace("-","").ToLowerInvariant();return new UsbAdmissionAuthorization.Request(before.OwnerSid,before.Generation,topology,"approve",digest);
 }
 internal static UsbHidAdmissionPolicy.Request Prepare(string action,UsbHidAdmissionPolicy.Snapshot before,UsbAdmissionInventory.Result inventory,string reference,string salt,string topology,string ownerSid,DateTime now){
  if(before==null||before.OwnerSid!=ownerSid||now.Kind!=DateTimeKind.Utc||before.Generation==ulong.MaxValue)throw new InvalidOperationException("HID authenticated before decision required");if(action!="deactivate")UsbHidAdmissionNativeAuthority.CheckBefore(before,inventory,topology);else topology=before.Digest;
  var approvals=new HashSet<string>(before.ExternalApprovals,StringComparer.Ordinal);var targets=new List<string>();
  if(action=="block"||action=="allow"){
   foreach(string id in SelectExternal(inventory,reference,salt)){bool changed=action=="allow"?approvals.Add(id):approvals.Remove(id);if(changed)targets.Add(id);}if(targets.Count==0)throw new InvalidOperationException("HID card unchanged");
  }else if(action!="activate"&&action!="deactivate")throw new InvalidOperationException("HID action refused");
  var next=new List<string>(approvals);next.Sort(StringComparer.Ordinal);targets.Sort(StringComparer.Ordinal);bool active=action=="activate"?true:action=="deactivate"?false:before.Active;var after=new UsbHidAdmissionPolicy.Snapshot(checked(before.Generation+1),ownerSid,active,before.InternalSafety,next.ToArray(),before.ReceiptDigest);
  var request=new UsbHidAdmissionPolicy.Request(action,before,after,targets.ToArray(),Guid.NewGuid().ToString("N"),topology,now,now.AddMinutes(5));if(action!="deactivate")UsbHidAdmissionNativeAuthority.CheckBefore(request.Before,inventory,request.TopologyHash);else UsbHidAdmissionNativeAuthority.CheckRelease(request);return request;
 }
}
