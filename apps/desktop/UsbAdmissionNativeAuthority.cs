using System;
using System.Collections.Generic;
using System.Threading.Tasks;

// Same-process native operator adapter. Never register these methods as IPC.
// Request and candidate configuration must originate from the protected store
// and native selection, not a renderer's IDs or claimed owner identity.
internal sealed class UsbAdmissionNativeAuthority : UsbAdmissionTransaction.INativeAuthority {
 readonly UsbAdmissionAuthorization.Proof proof;
 readonly UsbAdmissionTransaction.Request request;
 UsbAdmissionNativeAuthority(UsbAdmissionTransaction.Request selected,UsbAdmissionAuthorization.Proof verified){request=selected;proof=verified;}
 static UsbAdmissionAuthorization.Request Binding(UsbAdmissionTransaction.Request selected){return new UsbAdmissionAuthorization.Request(selected.CandidateConfig.OwnerSid,selected.CurrentGeneration,selected.TopologyHash,selected.Action,selected.Digest);}
 internal static async Task<UsbAdmissionNativeAuthority> Verify(IntPtr ownedWindow,UsbAdmissionTransaction.Request selected){
  if(selected==null)return null;
  // Validate the actual physical selection before requesting owner approval.
  CheckInventory(selected,UsbAdmissionInventory.Collect(selected.TopologyHash));
  var verified=await UsbAdmissionAuthorization.Verify(ownedWindow,Binding(selected));
  return verified==null?null:new UsbAdmissionNativeAuthority(selected,verified);
 }
 void SameRequest(UsbAdmissionTransaction.Request current){if(current==null||!object.ReferenceEquals(current,request))throw new InvalidOperationException("USB operation selection changed.");}
 public void ConsumeOwnerProof(UsbAdmissionTransaction.Request current){SameRequest(current);proof.Consume(Binding(current));}
 public void VerifyCurrentTopology(UsbAdmissionTransaction.Request current){SameRequest(current);CheckInventory(current,UsbAdmissionInventory.Collect(current.TopologyHash));}
 internal static void CheckInventory(UsbAdmissionTransaction.Request selected,UsbAdmissionInventory.Result inventory){
  if(selected==null||inventory==null||!inventory.Complete||inventory.Preflight==null||inventory.Preflight.State!="review_required"||inventory.Preflight.TopologyToken!=selected.TopologyHash||inventory.Preflight.Unresolved!=0)throw new InvalidOperationException("USB topology requires fresh review.");
  var safety=new HashSet<string>(selected.CandidateConfig.InternalSafety,StringComparer.OrdinalIgnoreCase);
  var external=new HashSet<string>(selected.CandidateConfig.ApprovedExternal,StringComparer.OrdinalIgnoreCase);
  if(inventory.Preflight.Candidates==null)throw new InvalidOperationException("USB input selection unavailable.");
  foreach(var item in inventory.Preflight.Candidates){
   if(item==null)throw new InvalidOperationException("USB input selection unavailable.");
   if(item.Category=="required_safety_candidate"){
    if(!safety.Remove(item.Instance)||external.Contains(item.Instance))throw new InvalidOperationException("Internal input safety baseline changed.");
   }else if(item.Category=="external_approval_required"){
    if(safety.Contains(item.Instance))throw new InvalidOperationException("External input cannot become a safety exception.");
    external.Remove(item.Instance); // Unapproved external input stays pending.
   }else throw new InvalidOperationException("USB input classification unavailable.");
  }
  if(safety.Count!=0||external.Count!=0)throw new InvalidOperationException("USB approved selection is not currently present.");
 }
}
