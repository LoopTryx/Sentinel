using System;
using System.IO;
using System.Text;
using System.Security.Cryptography;

// Initial EMPTY-policy application only. Active-policy approval updates and
// renewal require a versioned baseline/generation recovery record and are refused.
// Interfaces below are trusted native seams, never browser/IPC assertions.
public sealed class UsbAdmissionTransaction {
 public enum State { Unchecked, PolicyActive, RecoveryRequired }
 public sealed class Request {
  public readonly ulong CurrentGeneration;
  public readonly UsbEnrollmentConfig.Snapshot CandidateConfig;
  public readonly string TopologyHash,Nonce,Digest;
  public readonly DateTime IssuedUtc,DeadlineUtc;
  readonly byte[] policy;
  public string Action {get{return "initial-arm";}}
  public byte[] Policy {get{return (byte[])policy.Clone();}}
  public Request(ulong currentGeneration,UsbEnrollmentConfig.Snapshot candidateConfig,string topologyHash,string nonce,DateTime issuedUtc,DateTime deadlineUtc,byte[] compiledCanonicalPolicy){
   if(candidateConfig==null||currentGeneration==ulong.MaxValue||candidateConfig.Generation!=currentGeneration+1)throw Refused();
   // Journal validates nonce, topology, bounded scope3 grammar and UTC lease.
   var record=new UsbAdmissionJournal.Record(nonce,issuedUtc,deadlineUtc,topologyHash,compiledCanonicalPolicy);
   byte[] expected;
   using(var memory=new MemoryStream())using(var writer=new BinaryWriter(memory,Encoding.ASCII)){
    string[] internals=candidateConfig.InternalSafety,externals=candidateConfig.ApprovedExternal;
    if(internals.Length+externals.Length==0)throw Refused();
    writer.Write(Encoding.ASCII.GetBytes("SNTINP03"));writer.Write((byte)(internals.Length+externals.Length));
    foreach(var group in new[]{internals,externals})foreach(string id in group){byte[] bytes=Encoding.ASCII.GetBytes(id);writer.Write((byte)bytes.Length);writer.Write(bytes);}writer.Flush();expected=memory.ToArray();
   }
   if(!Same(expected,record.Policy))throw Refused();
   CurrentGeneration=currentGeneration;CandidateConfig=candidateConfig;TopologyHash=topologyHash;Nonce=nonce;IssuedUtc=issuedUtc;DeadlineUtc=deadlineUtc;policy=record.Policy;
   using(var memory=new MemoryStream())using(var writer=new BinaryWriter(memory,Encoding.UTF8)){
    writer.Write("SNT-USB-INITIAL-ARM-v1");writer.Write(Action);writer.Write(currentGeneration);writer.Write(topologyHash);writer.Write(nonce);writer.Write(issuedUtc.Ticks);writer.Write(deadlineUtc.Ticks);
    byte[] config=UsbEnrollmentConfig.Encode(candidateConfig);writer.Write(config.Length);writer.Write(config);writer.Write(policy.Length);writer.Write(policy);writer.Flush();
    using(var sha=SHA256.Create())Digest=BitConverter.ToString(sha.ComputeHash(memory.ToArray())).Replace("-","").ToLowerInvariant();
   }
  }
  internal UsbAdmissionJournal.Record JournalRecord(){return new UsbAdmissionJournal.Record(Nonce,IssuedUtc,DeadlineUtc,TopologyHash,policy);}
 }
 public interface INativeAuthority {
  // Consume an actual single-use Hello proof bound to Request.Digest, configured
  // owner identity, action, generation and topology. Throw on failure/replay.
  void ConsumeOwnerProof(Request request);
  void VerifyCurrentTopology(Request request);
 }
 public interface IClock { DateTime UtcNow {get;} }
 public interface IConfig {
  UsbEnrollmentConfig.Snapshot ReadCommitted();
  void Commit(ulong expectedGeneration,UsbEnrollmentConfig.Snapshot candidate);
 }
 public interface IJournal {
  UsbAdmissionJournal.Record Read();
  void Arm(UsbAdmissionJournal.Record record);
  void ClearAfterVerifiedRestore(string expectedNonce);
 }
 public interface INativeBackend {
  DateTime? OutstandingRecoveryDeadlineUtc {get;}
  void DemandEmptyPolicyAndNoUnownedOperations();
  void PrepareIndependentRecovery(UsbAdmissionJournal.Record record);
  void VerifyIndependentRecoveryPrepared(UsbAdmissionJournal.Record record);
  void ApplyInitial(UsbAdmissionJournal.Record record);
  void VerifyApplied(UsbAdmissionJournal.Record record);
  // Quiesce all owned producers BEFORE restoration; a late writer must not
  // overwrite recovery. These calls must have native bounded execution.
  void StopProducersAndVerifyQuiescent(UsbAdmissionJournal.Record record);
  void RestoreOwnedPolicy(UsbAdmissionJournal.Record record);
  void VerifyRestored(UsbAdmissionJournal.Record record);
  void RetireRecoveryAndVerifyQuiescent(UsbAdmissionJournal.Record record);
 }
 readonly object sync=new object();readonly IConfig config;readonly IJournal journal;readonly INativeBackend backend;readonly INativeAuthority authority;readonly IClock clock;
 State state=State.Unchecked;
 DateTime lastClock=DateTime.MinValue;
 public State CurrentState {get{lock(sync){return state;}}}
 public UsbAdmissionTransaction(IConfig nativeConfig,IJournal nativeJournal,INativeBackend nativeBackend,INativeAuthority nativeAuthority,IClock nativeClock){if(nativeConfig==null||nativeJournal==null||nativeBackend==null||nativeAuthority==null||nativeClock==null)throw Refused();config=nativeConfig;journal=nativeJournal;backend=nativeBackend;authority=nativeAuthority;clock=nativeClock;}
 static InvalidOperationException Refused(){return new InvalidOperationException("USB admission transaction refused.");}
 static bool Same(byte[] a,byte[] b){if(a==null||b==null||a.Length!=b.Length)return false;int mismatch=0;for(int i=0;i<a.Length;i++)mismatch|=a[i]^b[i];return mismatch==0;}
 void Live(Request request){DateTime now=clock.UtcNow;if(now.Kind!=DateTimeKind.Utc||now<lastClock||now<request.IssuedUtc||now>=request.DeadlineUtc)throw Refused();lastClock=now;DateTime? outstanding=backend.OutstandingRecoveryDeadlineUtc;if(outstanding.HasValue&&(outstanding.Value.Kind!=DateTimeKind.Utc||request.DeadlineUtc>outstanding.Value))throw Refused();}
 void ConfigUnchanged(byte[] before){var current=config.ReadCommitted();if(before==null?current!=null:current==null||!Same(before,UsbEnrollmentConfig.Encode(current)))throw Refused();}
 void JournalUnchanged(UsbAdmissionJournal.Record expected){var actual=journal.Read();if(actual==null||actual.Nonce!=expected.Nonce||actual.TopologyHash!=expected.TopologyHash||actual.IssuedUtc!=expected.IssuedUtc||actual.DeadlineUtc!=expected.DeadlineUtc||!Same(actual.Policy,expected.Policy))throw Refused();}
 public void ApplyInitial(Request request){lock(sync){
  state=State.RecoveryRequired;if(request==null)throw Refused();
  // Never accept an existing operation as a request to renew or modify it.
  if(journal.Read()!=null)throw Refused();backend.DemandEmptyPolicyAndNoUnownedOperations();Live(request);
  var baseline=config.ReadCommitted();if((baseline==null?0:baseline.Generation)!=request.CurrentGeneration||baseline!=null&&baseline.OwnerSid!=request.CandidateConfig.OwnerSid)throw Refused();
  byte[] before=baseline==null?null:UsbEnrollmentConfig.Encode(baseline);
  authority.ConsumeOwnerProof(request);authority.VerifyCurrentTopology(request);Live(request);ConfigUnchanged(before);
  var record=request.JournalRecord();journal.Arm(record);
  backend.PrepareIndependentRecovery(record);backend.VerifyIndependentRecoveryPrepared(record);
  Live(request);JournalUnchanged(record);ConfigUnchanged(before);authority.VerifyCurrentTopology(request);
  backend.DemandEmptyPolicyAndNoUnownedOperations();backend.VerifyIndependentRecoveryPrepared(record);Live(request);backend.ApplyInitial(record);
  backend.VerifyApplied(record);Live(request);JournalUnchanged(record);ConfigUnchanged(before);authority.VerifyCurrentTopology(request);
  // Persistent approvals are committed only after effective-policy readback.
  // A lost commit reply remains RecoveryRequired; never replay consumed proof.
  Live(request);config.Commit(request.CurrentGeneration,request.CandidateConfig);
  var committed=config.ReadCommitted();if(committed==null||!Same(UsbEnrollmentConfig.Encode(committed),UsbEnrollmentConfig.Encode(request.CandidateConfig)))throw Refused();
  Live(request);JournalUnchanged(record);state=State.PolicyActive;
 }}
 // Startup, timeout or owner-requested restore never grants approvals, consumes
 // no owner proof, and never adopts staged configuration. It only removes the
 // exact recorded newly-owned policy after producer quiescence and readback.
 public void Recover(){lock(sync){
  state=State.RecoveryRequired;var record=journal.Read();if(record==null){backend.DemandEmptyPolicyAndNoUnownedOperations();state=State.Unchecked;return;}
  backend.StopProducersAndVerifyQuiescent(record);JournalUnchanged(record);
  backend.RestoreOwnedPolicy(record);backend.VerifyRestored(record);JournalUnchanged(record);
  backend.RetireRecoveryAndVerifyQuiescent(record);JournalUnchanged(record);
  journal.ClearAfterVerifiedRestore(record.Nonce);
  if(journal.Read()!=null)throw Refused();state=State.Unchecked;
 }}
}
