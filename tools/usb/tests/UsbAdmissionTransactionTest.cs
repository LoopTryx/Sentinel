using System;
using System.Collections.Generic;
using System.IO;
using System.Text;

// Fault-injected coordinator tests; these do not establish Windows enforcement.
internal static class UsbAdmissionTransactionTest {
 const string Owner="S-1-5-21-111-222-333-1001";
 static void Check(bool value){if(!value)throw new Exception("Transaction invariant failed.");}
 static void Refuses(Action action){bool failed=false;try{action();}catch{failed=true;}Check(failed);}
 sealed class Fixture : UsbAdmissionTransaction.IConfig,UsbAdmissionTransaction.IJournal,UsbAdmissionTransaction.INativeAuthority,UsbAdmissionTransaction.INativeBackend,UsbAdmissionTransaction.IClock {
  internal readonly List<string> Events=new List<string>();
  internal string Fail;internal bool After,Policy,RecoveryReady,ProofUsed;
  internal int FailOccurrence=1;readonly Dictionary<string,int> counts=new Dictionary<string,int>();
  internal UsbEnrollmentConfig.Snapshot Config;
  internal UsbAdmissionJournal.Record Record;
  internal DateTime Now=new DateTime(2026,10,16,0,0,0,DateTimeKind.Utc);
  internal DateTime? Outstanding;internal Action<string> OnCall;
  void Before(string name){Events.Add(name);int count;counts.TryGetValue(name,out count);counts[name]=count+1;if(OnCall!=null)OnCall(name);if(Fail==name&&counts[name]==FailOccurrence&&!After)throw new IOException("Injected boundary refusal.");}
  void Done(string name){if(Fail==name&&counts[name]==FailOccurrence&&After)throw new IOException("Injected lost completion.");}
  public DateTime UtcNow {get{Before("clock.read");Done("clock.read");return Now;}}
  public DateTime? OutstandingRecoveryDeadlineUtc {get{Before("deadline.read");Done("deadline.read");return Outstanding;}}
  public UsbEnrollmentConfig.Snapshot ReadCommitted(){Before("config.read");Done("config.read");return Config;}
  public void Commit(ulong expected,UsbEnrollmentConfig.Snapshot candidate){Before("config.commit");Check((Config==null?0:Config.Generation)==expected);Config=candidate;Done("config.commit");}
  public UsbAdmissionJournal.Record Read(){Before("journal.read");Done("journal.read");return Record;}
  public void Arm(UsbAdmissionJournal.Record record){Before("journal.arm");Check(Record==null);Record=record;Done("journal.arm");}
  public void ClearAfterVerifiedRestore(string nonce){Before("journal.clear");Check(!Policy&&!RecoveryReady&&Record.Nonce==nonce);Record=null;Done("journal.clear");}
  public void ConsumeOwnerProof(UsbAdmissionTransaction.Request request){Before("proof.consume");Check(!ProofUsed);ProofUsed=true;Done("proof.consume");}
  public void VerifyCurrentTopology(UsbAdmissionTransaction.Request request){Before("topology.verify");Done("topology.verify");}
  public void DemandEmptyPolicyAndNoUnownedOperations(){Before("policy.empty");Check(!Policy);Done("policy.empty");}
  public void PrepareIndependentRecovery(UsbAdmissionJournal.Record record){Before("recovery.prepare");Check(Record!=null);RecoveryReady=true;Done("recovery.prepare");}
  public void VerifyIndependentRecoveryPrepared(UsbAdmissionJournal.Record record){Before("recovery.verify");Check(RecoveryReady);Done("recovery.verify");}
  public void ApplyInitial(UsbAdmissionJournal.Record record){Before("policy.apply");Check(Record!=null&&RecoveryReady);Policy=true;Done("policy.apply");}
  public void VerifyApplied(UsbAdmissionJournal.Record record){Before("policy.verify");Check(Policy);Done("policy.verify");}
  public void StopProducersAndVerifyQuiescent(UsbAdmissionJournal.Record record){Before("producers.stop");Done("producers.stop");}
  public void RestoreOwnedPolicy(UsbAdmissionJournal.Record record){Before("policy.restore");Policy=false;Done("policy.restore");}
  public void VerifyRestored(UsbAdmissionJournal.Record record){Before("restore.verify");Check(!Policy);Done("restore.verify");}
  public void RetireRecoveryAndVerifyQuiescent(UsbAdmissionJournal.Record record){Before("recovery.retire");RecoveryReady=false;Done("recovery.retire");}
  internal UsbAdmissionTransaction Engine(){return new UsbAdmissionTransaction(this,this,this,this,this);}
  internal void ResetObservations(){Events.Clear();counts.Clear();}
  internal UsbAdmissionTransaction.Request Request(){
   var config=new UsbEnrollmentConfig.Snapshot(1,Owner,new string[0],new[]{"USB\\SYNTHETIC\\APPROVED"});
   byte[] id=Encoding.ASCII.GetBytes(config.ApprovedExternal[0]);var policy=new List<byte>(Encoding.ASCII.GetBytes("SNTINP03"));policy.Add(1);policy.Add((byte)id.Length);policy.AddRange(id);
   return new UsbAdmissionTransaction.Request(0,config,new string('a',64),new string('b',32),new DateTime(2026,10,16,0,0,0,DateTimeKind.Utc),new DateTime(2026,10,16,0,2,0,DateTimeKind.Utc),policy.ToArray());
  }
 }
 static void Ordering(){
  var f=new Fixture();var engine=f.Engine();var request=f.Request();engine.ApplyInitial(request);
  Check(engine.CurrentState==UsbAdmissionTransaction.State.PolicyActive&&f.Policy&&f.Config.Generation==1);
  Check(f.Events.IndexOf("journal.arm")<f.Events.IndexOf("recovery.prepare")&&f.Events.IndexOf("recovery.verify")<f.Events.IndexOf("policy.apply")&&f.Events.IndexOf("policy.verify")<f.Events.IndexOf("config.commit"));
  Refuses(()=>engine.ApplyInitial(request));engine.Recover();Check(!f.Policy&&f.Record==null&&f.Config.Generation==1);
  Check(f.Events.IndexOf("producers.stop")<f.Events.IndexOf("policy.restore")&&f.Events.IndexOf("restore.verify")<f.Events.IndexOf("recovery.retire")&&f.Events.IndexOf("recovery.retire")<f.Events.IndexOf("journal.clear"));
 }
 static void ApplyFailures(){
  var baseline=new Fixture();baseline.Engine().ApplyInitial(baseline.Request());var occurrences=new Dictionary<string,int>();
  foreach(string boundary in baseline.Events){int occurrence;occurrences.TryGetValue(boundary,out occurrence);occurrence++;occurrences[boundary]=occurrence;foreach(bool after in new[]{false,true}){
   var f=new Fixture{Fail=boundary,After=after,FailOccurrence=occurrence};var engine=f.Engine();Refuses(()=>engine.ApplyInitial(f.Request()));
   Check(engine.CurrentState==UsbAdmissionTransaction.State.RecoveryRequired);
   if(f.Events.Contains("policy.apply"))Check(f.Record!=null&&f.RecoveryReady);
   if(f.Config!=null)Check(f.Events.Contains("config.commit")&&f.Events.IndexOf("policy.verify")<f.Events.IndexOf("config.commit"));
   f.Fail=null;f.After=false;f.Engine().Recover();Check(!f.Policy&&f.Record==null);
  }}
 }
 static void RecoveryFailures(){
  var baseline=new Fixture();var successful=baseline.Engine();successful.ApplyInitial(baseline.Request());baseline.ResetObservations();successful.Recover();var occurrences=new Dictionary<string,int>();
  foreach(string boundary in baseline.Events){int occurrence;occurrences.TryGetValue(boundary,out occurrence);occurrence++;occurrences[boundary]=occurrence;foreach(bool after in new[]{false,true}){
   var f=new Fixture();var engine=f.Engine();engine.ApplyInitial(f.Request());f.ResetObservations();f.Fail=boundary;f.After=after;f.FailOccurrence=occurrence;Refuses(()=>engine.Recover());
   Check(engine.CurrentState==UsbAdmissionTransaction.State.RecoveryRequired);
   if(f.Record==null)Check(!f.Policy&&!f.RecoveryReady);
   Check(f.Config.Generation==1);f.Fail=null;f.After=false;f.Engine().Recover();Check(!f.Policy&&f.Record==null);
  }}
 }
 static void DriftAndDeadline(){
  var f=new Fixture{Policy=true};Refuses(()=>f.Engine().ApplyInitial(f.Request()));Check(!f.ProofUsed);
  f=new Fixture{Outstanding=new DateTime(2026,10,16,0,1,0,DateTimeKind.Utc)};Refuses(()=>f.Engine().ApplyInitial(f.Request()));Check(!f.ProofUsed&&f.Record==null);
  f=new Fixture();f.Now=f.Now.AddSeconds(-1);Refuses(()=>f.Engine().ApplyInitial(f.Request()));Check(!f.ProofUsed);
  f=new Fixture();f.OnCall=name=>{if(name=="recovery.verify")f.Now=f.Now.AddSeconds(121);};Refuses(()=>f.Engine().ApplyInitial(f.Request()));Check(!f.Policy&&f.Config==null&&f.Record!=null);
  f=new Fixture();int calls=0;f.OnCall=name=>{if(name=="topology.verify"){calls++;if(calls==2)throw new Exception("Native topology changed.");}};Refuses(()=>f.Engine().ApplyInitial(f.Request()));Check(!f.Policy&&f.Config==null&&f.Record!=null);
  f=new Fixture();f.OnCall=name=>{if(name=="policy.verify")f.Now=f.Now.AddSeconds(121);};Refuses(()=>f.Engine().ApplyInitial(f.Request()));Check(f.Policy&&f.Config==null&&f.Record!=null);
  f=new Fixture();int ticks=0;f.OnCall=name=>{if(name=="clock.read"){ticks++;if(ticks==1)f.Now=f.Now.AddSeconds(10);else if(ticks==2)f.Now=f.Now.AddSeconds(-1);}};Refuses(()=>f.Engine().ApplyInitial(f.Request()));Check(!f.Policy&&f.Config==null);
  f=new Fixture();f.OnCall=name=>{if(name=="recovery.verify")f.Config=new UsbEnrollmentConfig.Snapshot(1,Owner,new string[0],new string[0]);};Refuses(()=>f.Engine().ApplyInitial(f.Request()));Check(!f.Policy&&f.Record!=null);
 }
 static int Main(){try{Ordering();ApplyFailures();RecoveryFailures();DriftAndDeadline();Console.WriteLine("Initial-only admission transaction PASS: ordering, failure ambiguity, recovery retention, topology drift, deadline and generation guards; synthetic native seams only");return 0;}catch{return 1;}}
}
