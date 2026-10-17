using System;
using System.Collections.Generic;
using System.Threading.Tasks;

// Native-only adapter: the exact transaction digest binds targets and both
// generations. Reuses the existing foreground, session-bound Hello proof.
internal sealed class UsbExactBlockNativeAuthority:UsbExactBlockTransaction.INativeAuthority {
 readonly UsbExactBlockState.Request selected;
 readonly UsbAdmissionAuthorization.Proof proof;
 UsbExactBlockNativeAuthority(UsbExactBlockState.Request request,UsbAdmissionAuthorization.Proof verified){selected=request;proof=verified;}
 internal static UsbAdmissionAuthorization.Request Binding(UsbExactBlockState.Request request){
  if(request==null)throw new ArgumentNullException("request");
  // Reuse the authorization vocabulary without weakening its action binding.
  return new UsbAdmissionAuthorization.Request(request.After.OwnerSid,request.Before==null?0:request.Before.Generation,request.TopologyHash,request.Action=="block"?"revoke":"approve",request.Digest);
 }
 internal static async Task<UsbExactBlockNativeAuthority> Verify(IntPtr nativeWindow,UsbExactBlockState.Request request){
  CheckInventory(request,UsbAdmissionInventory.Collect(request==null?null:request.TopologyHash));
  var verified=await UsbAdmissionAuthorization.Verify(nativeWindow,Binding(request));
  return verified==null?null:new UsbExactBlockNativeAuthority(request,verified);
 }
 void Same(UsbExactBlockState.Request request){if(!object.ReferenceEquals(request,selected))throw new InvalidOperationException("Exact USB selection changed");}
 public void ConsumeOwnerProof(UsbExactBlockState.Request request){Same(request);proof.Consume(Binding(request));}
 public void VerifyFreshExternalScope(UsbExactBlockState.Request request){Same(request);CheckInventory(request,UsbAdmissionInventory.Collect(request.TopologyHash));}
 internal static void CheckInventory(UsbExactBlockState.Request request,UsbAdmissionInventory.Result inventory){
  if(request==null||inventory==null||!inventory.Complete||inventory.Preflight==null||inventory.Preflight.State!="review_required"||inventory.Preflight.TopologyToken!=request.TopologyHash||inventory.Preflight.Unresolved!=0||inventory.Preflight.Candidates==null)throw new InvalidOperationException("Fresh USB classification required");
  var selected=new HashSet<string>(request.Targets,StringComparer.OrdinalIgnoreCase);
  var releaseOnly=new HashSet<string>(StringComparer.OrdinalIgnoreCase);
  if(request.Action=="allow"&&request.Before!=null){var previous=new HashSet<string>(request.Before.Blocked,StringComparer.OrdinalIgnoreCase);var next=new HashSet<string>(request.After.Blocked,StringComparer.OrdinalIgnoreCase);foreach(string target in request.Targets)if(previous.Contains(target)&&!next.Contains(target))releaseOnly.Add(target);}
  var seen=new HashSet<string>(StringComparer.OrdinalIgnoreCase);
  foreach(var candidate in inventory.Preflight.Candidates){
   if(candidate==null||string.IsNullOrEmpty(candidate.Instance)||!seen.Add(candidate.Instance))throw new InvalidOperationException("Ambiguous USB classification");
   if(candidate.Category=="required_safety_candidate"){
    if(selected.Contains(candidate.Instance)&&!releaseOnly.Contains(candidate.Instance))throw new InvalidOperationException("Built-in input cannot be restricted");
    selected.Remove(candidate.Instance);
   }else if(candidate.Category=="external_approval_required")selected.Remove(candidate.Instance);
   else throw new InvalidOperationException("Unresolved USB classification");
  }
  foreach(string missing in selected)if(!releaseOnly.Contains(missing))throw new InvalidOperationException("Selected external USB function is not present");
 }
}
