using System;
internal static class UsbExactBlockNativeAuthorityTest {
 const string Target=@"USB\VID_0001&PID_0001&MI_00\SYNTHETIC";
 static void Check(bool value){if(!value)throw new Exception("Exact authority regression");}
 static void Refuses(Action action){try{action();}catch(InvalidOperationException){return;}throw new Exception("Unsafe scope accepted");}
 static int Main(){var now=DateTime.UtcNow;var after=new UsbExactBlockState.Snapshot(1,"S-1-5-21-111-222-333-1001",new[]{Target});var request=new UsbExactBlockState.Request("block",null,after,new[]{Target},new string('b',32),new string('a',64),now,now.AddMinutes(2));
  var candidate=new UsbAdmissionPreflight.Candidate{Instance=Target,Category="external_approval_required"};var inventory=new UsbAdmissionInventory.Result{Complete=true,Preflight=new UsbAdmissionPreflight.Result{State="review_required",TopologyToken=request.TopologyHash,Candidates=new[]{candidate}}};
  UsbExactBlockNativeAuthority.CheckInventory(request,inventory);candidate.Category="required_safety_candidate";Refuses(()=>UsbExactBlockNativeAuthority.CheckInventory(request,inventory));candidate.Category="external_approval_required";inventory.Preflight.TopologyToken=new string('c',64);Refuses(()=>UsbExactBlockNativeAuthority.CheckInventory(request,inventory));inventory.Preflight.TopologyToken=request.TopologyHash;inventory.Preflight.Candidates=new[]{candidate,candidate};Refuses(()=>UsbExactBlockNativeAuthority.CheckInventory(request,inventory));inventory.Preflight.Candidates=new UsbAdmissionPreflight.Candidate[0];Refuses(()=>UsbExactBlockNativeAuthority.CheckInventory(request,inventory));
  var bound=UsbExactBlockNativeAuthority.Binding(request);Check(bound.Digest==request.Digest&&bound.Action=="revoke"&&bound.Generation==0&&bound.OwnerSid==after.OwnerSid);bool consumed=false;Check(UsbAdmissionAuthorization.ConsumeGate(ref consumed,bound,bound,10,true));Check(!UsbAdmissionAuthorization.ConsumeGate(ref consumed,bound,bound,10,true));consumed=false;var changed=new UsbAdmissionAuthorization.Request(bound.OwnerSid,1,bound.Topology,bound.Action,bound.Digest);Check(!UsbAdmissionAuthorization.ConsumeGate(ref consumed,bound,changed,10,true));
  Console.WriteLine("PASS exact native selection refuses internal, stale, ambiguous and absent targets; full-digest generation binding and replay refusal; no Hello or device action");return 0;
 }
}
