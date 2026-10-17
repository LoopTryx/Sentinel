using System;
using System.Collections.Generic;

// Builds an immutable native selection. This does not authorize or apply policy.
internal static class UsbExactBlockSelection {
 internal static UsbExactBlockState.Request Prepare(string action,UsbExactBlockState.Snapshot before,UsbAdmissionInventory.Result inventory,string reference,string sessionSalt,string topology,string ownerSid,DateTime now){
  if(action!="block"&&action!="allow")throw new InvalidOperationException("Exact USB action refused");
  if(now.Kind!=DateTimeKind.Utc||inventory==null||!inventory.Complete||inventory.Preflight==null||inventory.Preflight.State!="review_required"||inventory.Preflight.Unresolved!=0||inventory.Preflight.TopologyToken!=topology||inventory.Subjects==null||inventory.Preflight.Candidates==null)throw new InvalidOperationException("Fresh USB classification required");
  if(before!=null&&before.OwnerSid!=ownerSid)throw new InvalidOperationException("Exact USB owner changed");
  if(before!=null&&before.Generation==ulong.MaxValue)throw new InvalidOperationException("Exact USB generation exhausted");
  if(string.IsNullOrEmpty(reference)||reference.Length!=64)throw new InvalidOperationException("Exact USB selection refused");
  List<string> selected=null;bool disconnectedRelease=false;
  foreach(var group in UsbAdmissionTabModel.Groups(inventory)){
   if(!string.Equals(UsbAdmissionTabModel.Reference(sessionSalt,group.Key),reference,StringComparison.Ordinal))continue;
   if(selected!=null)throw new InvalidOperationException("Ambiguous USB selection");
   selected=group.Value;
  }
  // A policy-refused or unplugged function may no longer enumerate. Release
  // can still select exactly one authenticated committed ID by its session ref;
  // this exception can never introduce a restriction or target an arbitrary ID.
  if(selected==null&&action=="allow"&&before!=null)foreach(string id in before.Blocked){
   if(!string.Equals(UsbAdmissionTabModel.Reference(sessionSalt,id),reference,StringComparison.Ordinal))continue;
   if(selected!=null)throw new InvalidOperationException("Ambiguous saved USB selection");
   bool present=false;foreach(var candidate in inventory.Preflight.Candidates)if(candidate!=null&&string.Equals(candidate.Instance,id,StringComparison.OrdinalIgnoreCase))present=true;
   foreach(var subject in inventory.Subjects)if(subject!=null&&subject.Input!=null&&string.Equals(subject.Input.Instance,id,StringComparison.OrdinalIgnoreCase))present=true;
   if(present)throw new InvalidOperationException("Saved USB selection is not disconnected");
   selected=new List<string>{id};disconnectedRelease=true;
  }
  if(selected==null||selected.Count==0||selected.Count>8)throw new InvalidOperationException("Selected external USB group is not present");
  // Each selected function must have exactly one source subject. Duplicate or
  // missing native evidence must not silently choose a different parent group.
  foreach(string id in selected){
   int count=0;
   foreach(var subject in inventory.Subjects)if(subject!=null&&subject.Input!=null&&string.Equals(subject.Input.Instance,id,StringComparison.OrdinalIgnoreCase))count++;
   if(count!=(disconnectedRelease?0:1))throw new InvalidOperationException("Ambiguous USB subject evidence");
  }
  var blocked=new HashSet<string>(before==null?new string[0]:before.Blocked,StringComparer.Ordinal);
  var targets=new List<string>();bool changed=false;
  foreach(string raw in selected){string id=raw.ToUpperInvariant();UsbExactBlockState.ValidateId(id);if(action=="allow"&&!blocked.Contains(id))continue;targets.Add(id);changed|=action=="block"?blocked.Add(id):blocked.Remove(id);}
  if(!changed)throw new InvalidOperationException("Exact USB action changes no devices");
  var next=new List<string>(blocked);next.Sort(StringComparer.Ordinal);targets.Sort(StringComparer.Ordinal);
  var after=new UsbExactBlockState.Snapshot(before==null?1:checked(before.Generation+1),ownerSid,next.ToArray());
  var request=new UsbExactBlockState.Request(action,before,after,targets.ToArray(),Guid.NewGuid().ToString("N"),topology,now,now.AddMinutes(5));
  UsbExactBlockNativeAuthority.CheckInventory(request,inventory);
  return request;
 }
}
