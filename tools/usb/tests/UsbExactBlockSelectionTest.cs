using System;
using System.Collections.Generic;
using System.IO;

internal static class UsbExactBlockSelectionTest {
 const string Owner="S-1-5-21-111-222-333-1001",Salt="native-session-one";
 const string A=@"USB\VID_0001&PID_0001&MI_00\DEVICE_A",B=@"USB\VID_0002&PID_0002&MI_00\DEVICE_B";
 const string ParentA=@"USB\VID_0001&PID_0001\DEVICE_A",ParentB=@"USB\VID_0002&PID_0002\DEVICE_B";
 static readonly string Topology=new string('a',64);
 static readonly DateTime Now=new DateTime(2026,10,17,12,0,0,DateTimeKind.Utc);
 static int assertions;
 static void Check(bool value,string label){assertions++;if(!value)throw new Exception(label);}
 static void Refuses(Action action,string label){assertions++;try{action();}catch(InvalidOperationException){return;}catch(InvalidDataException){return;}catch(ArgumentException){return;}throw new Exception("Accepted "+label);}
 static UsbAdmissionInventory.Subject Subject(string id,string parent){return new UsbAdmissionInventory.Subject{Input=new UsbAdmissionPreflight.Input{Instance=id,ParentChain=new[]{id,parent,@"HTREE\ROOT\0"}},DisplayName="Synthetic external input"};}
 static UsbAdmissionInventory.Result Inventory(){return new UsbAdmissionInventory.Result{Complete=true,Subjects=new[]{Subject(A,ParentA),Subject(B,ParentB)},Preflight=new UsbAdmissionPreflight.Result{State="review_required",TopologyToken=Topology,Candidates=new[]{new UsbAdmissionPreflight.Candidate{Instance=A,Category="external_approval_required"},new UsbAdmissionPreflight.Candidate{Instance=B,Category="external_approval_required"}}}};}
 static string Reference(string parent){return UsbAdmissionTabModel.Reference(Salt,parent);}
 static UsbExactBlockState.Request Prepare(string action,UsbExactBlockState.Snapshot before,UsbAdmissionInventory.Result inventory,string reference){return UsbExactBlockSelection.Prepare(action,before,inventory,reference,Salt,Topology,Owner,Now);}
 static int Main(){
  var first=Prepare("block",null,Inventory(),Reference(ParentA));
  Check(first.Before==null&&first.After.Generation==1&&first.After.Blocked.Length==1&&first.After.Blocked[0]==A,"initial exact block");
  var second=Prepare("block",first.After,Inventory(),Reference(ParentB));
  Check(second.After.Generation==2&&second.After.Blocked.Length==2,"second independent block");
  var released=Prepare("allow",second.After,Inventory(),Reference(ParentA));
  Check(released.After.Generation==3&&released.After.Blocked.Length==1&&released.After.Blocked[0]==B,"allow-one preserves other block");
  Check(second.After.Blocked.Length==2&&released.Targets.Length==1&&released.Targets[0]==A,"before and targets immutable");
  var copiedTargets=released.Targets;copiedTargets[0]=B;var copiedBlocked=released.After.Blocked;copiedBlocked[0]=A;Check(released.Targets[0]==A&&released.After.Blocked[0]==B,"request arrays cannot be mutated by caller");
  Check(first.Nonce.Length==32&&first.Nonce!=second.Nonce&&first.IssuedUtc==Now&&first.RollbackDeadlineUtc==Now.AddMinutes(5),"nonce and bounded UTC deadline");
  Refuses(()=>Prepare("allow",null,Inventory(),Reference(ParentA)),"no-op allow");
  Refuses(()=>Prepare("block",first.After,Inventory(),Reference(ParentA)),"no-op block");
  Refuses(()=>Prepare("approve",null,Inventory(),Reference(ParentA)),"unknown action");
  Refuses(()=>Prepare("block",null,Inventory(),new string('f',64)),"absent group");
  Refuses(()=>Prepare("block",null,Inventory(),UsbAdmissionTabModel.Reference("other-session",ParentA)),"other session reference");
  Refuses(()=>UsbExactBlockSelection.Prepare("block",null,Inventory(),Reference(ParentA),Salt,new string('b',64),Owner,Now),"stale topology");
  Refuses(()=>UsbExactBlockSelection.Prepare("block",first.After,Inventory(),Reference(ParentB),Salt,Topology,"S-1-5-21-111-222-333-1002",Now),"different owner");
  Refuses(()=>Prepare("block",new UsbExactBlockState.Snapshot(ulong.MaxValue,Owner,new string[0]),Inventory(),Reference(ParentA)),"generation overflow");
  Refuses(()=>UsbExactBlockSelection.Prepare("block",null,Inventory(),Reference(ParentA),Salt,Topology,"not-an-owner-sid",Now),"invalid owner SID");
  var full=new string[32];for(int i=0;i<full.Length;i++)full[i]=@"USB\VID_0003&PID_0003\EXISTING_"+i.ToString("D2");
  Refuses(()=>Prepare("block",new UsbExactBlockState.Snapshot(1,Owner,full),Inventory(),Reference(ParentA)),"state capacity overflow");
  Refuses(()=>UsbExactBlockSelection.Prepare("block",null,Inventory(),Reference(ParentA),Salt,Topology,Owner,DateTime.SpecifyKind(Now,DateTimeKind.Local)),"non UTC time");
  var inventory=Inventory();inventory.Complete=false;Refuses(()=>Prepare("block",null,inventory,Reference(ParentA)),"incomplete native inventory");
  inventory=Inventory();inventory.Preflight.Unresolved=1;Refuses(()=>Prepare("block",null,inventory,Reference(ParentA)),"unresolved classification");
  inventory=Inventory();inventory.Preflight.State="refused_incomplete";Refuses(()=>Prepare("block",null,inventory,Reference(ParentA)),"preflight refusal");
  inventory=Inventory();inventory.Preflight.Candidates[0].Category="required_safety_candidate";Refuses(()=>Prepare("block",null,inventory,Reference(ParentA)),"internal group");
  inventory=Inventory();inventory.Preflight.Candidates=new[]{inventory.Preflight.Candidates[0],inventory.Preflight.Candidates[0]};Refuses(()=>Prepare("block",null,inventory,Reference(ParentA)),"ambiguous candidates");
  inventory=Inventory();inventory.Subjects=new[]{inventory.Subjects[0],inventory.Subjects[0],inventory.Subjects[1]};Refuses(()=>Prepare("block",null,inventory,Reference(ParentA)),"duplicate subject evidence");
  inventory=Inventory();inventory.Subjects=new UsbAdmissionInventory.Subject[0];Refuses(()=>Prepare("block",null,inventory,Reference(A)),"missing subject evidence");
  inventory=Inventory();inventory.Preflight.Candidates[1].Category="unresolved";Refuses(()=>Prepare("block",null,inventory,Reference(ParentA)),"unresolved peer classification");
  inventory=Inventory();inventory.Subjects=new[]{inventory.Subjects[1]};inventory.Preflight.Candidates=new[]{inventory.Preflight.Candidates[1]};
  var absent=inventory;var disconnected=Prepare("allow",second.After,absent,Reference(A));
  Check(disconnected.Targets.Length==1&&disconnected.Targets[0]==A&&disconnected.After.Blocked.Length==1&&disconnected.After.Blocked[0]==B,"disconnected allow-one preserves peer block");
  UsbExactBlockNativeAuthority.CheckInventory(disconnected,absent);
  Refuses(()=>Prepare("block",second.After,absent,Reference(A)),"disconnected Block");
  Refuses(()=>Prepare("allow",null,absent,Reference(A)),"disconnected uncommitted ID");
  Refuses(()=>Prepare("allow",released.After,absent,Reference(A)),"already released disconnected ID");
  Refuses(()=>Prepare("allow",second.After,absent,UsbAdmissionTabModel.Reference("another-session",A)),"disconnected cross-session ref");
  Refuses(()=>UsbExactBlockSelection.Prepare("allow",second.After,absent,Reference(A),Salt,new string('b',64),Owner,Now),"disconnected stale topology");
  Refuses(()=>UsbExactBlockSelection.Prepare("allow",second.After,absent,Reference(A),Salt,Topology,"S-1-5-21-111-222-333-1002",Now),"disconnected changed owner");
  var extraTarget=new UsbExactBlockState.Request("allow",released.After,new UsbExactBlockState.Snapshot(4,Owner,new string[0]),new[]{A,B},new string('c',32),Topology,Now,Now.AddMinutes(5));
  Refuses(()=>UsbExactBlockNativeAuthority.CheckInventory(extraTarget,absent),"arbitrary absent allow target not in committed state");
  inventory=Inventory();inventory.Preflight.Candidates[0].Category="required_safety_candidate";
  UsbExactBlockNativeAuthority.CheckInventory(disconnected,inventory);Check(true,"release-only never re-restricts newly internal classified target");
  // One composite device may select several HID functions, but never beyond
  // the immutable request format's eight-target limit.
  var subjects=new List<UsbAdmissionInventory.Subject>();var candidates=new List<UsbAdmissionPreflight.Candidate>();
  for(int i=0;i<9;i++){string id=@"USB\VID_0001&PID_0001&MI_"+i.ToString("D2")+@"\DEVICE_A";subjects.Add(Subject(id,ParentA));candidates.Add(new UsbAdmissionPreflight.Candidate{Instance=id,Category="external_approval_required"});}
  inventory=Inventory();inventory.Subjects=subjects.ToArray();inventory.Preflight.Candidates=candidates.ToArray();Refuses(()=>Prepare("block",null,inventory,Reference(ParentA)),"nine-target composite");
  subjects.RemoveAt(8);candidates.RemoveAt(8);inventory.Subjects=subjects.ToArray();inventory.Preflight.Candidates=candidates.ToArray();var composite=Prepare("block",null,inventory,Reference(ParentA));Check(composite.Targets.Length==8&&composite.After.Blocked.Length==8,"eight-target composite accepted");
  Console.WriteLine("PASS "+assertions+" exact selection assertions; synthetic data only; no native collection, authorization or policy mutation");return 0;
 }
}
