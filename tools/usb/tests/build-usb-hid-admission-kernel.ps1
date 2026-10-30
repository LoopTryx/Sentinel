param([switch]$GenerateOnly)
$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$out=Join-Path $root 'artifacts/hid-admission-kernel'
[IO.Directory]::CreateDirectory($out)|Out-Null
function Replace-One([string]$text,[string]$old,[string]$new){
 if(([regex]::Matches($text,[regex]::Escape($old))).Count -ne 1){throw "Kernel source shape changed: $old"}
 return $text.Replace($old,$new)
}
$transaction=[IO.File]::ReadAllText((Join-Path $root 'tools/usb/UsbExactBlockTransaction.cs'))
$transaction=Replace-One $transaction 'public sealed class UsbExactBlockTransaction {' 'namespace SentinelHidAdmission { using UsbExactBlockState=global::UsbHidAdmissionPolicy; public sealed class UsbExactBlockTransaction {'
$transaction=$transaction+"`r`n}`r`n"
$store=[IO.File]::ReadAllText((Join-Path $root 'tools/usb/UsbExactBlockFileStore.cs'))
$store=Replace-One $store 'internal sealed class UsbExactBlockFileStore:' 'namespace SentinelHidAdmission { using UsbExactBlockState=global::UsbHidAdmissionPolicy; internal sealed class UsbExactBlockFileStore:'
$store=Replace-One $store '"exact-blocks.bin"' '"hid-admission-state.bin"'
$store=Replace-One $store '"exact-transition.bin"' '"hid-admission-transition.bin"'
$store=Replace-One $store '"exact-decision.lock"' '"hid-admission-decision.lock"'
$store=Replace-One $store '"exact-write-"' '"hid-admission-write-"'
$hook=@'
 // Native composition hook, executed under the existing Decision lease.
 // Its callbacks must use these captured values and never reopen Decision.
 internal Action<UsbExactBlockState.Request,UsbExactBlockState.Snapshot,UsbExactBlockState.Transition,Action> BeforeLinkedCommit;
 internal Action<UsbExactBlockState.Request,UsbExactBlockState.Snapshot,UsbExactBlockState.Transition,Action> BeforeLinkedRetirement;
 internal void WithLinkedReadFence(Action<UsbExactBlockState.Snapshot,UsbExactBlockState.Transition,Action> read){WithReadFence(read);}
 void PublishLinkedCommit(UsbExactBlockState.Transition current){
  Action check=()=>{if(DateTime.UtcNow<current.Request.IssuedUtc||DateTime.UtcNow>=current.Request.RollbackDeadlineUtc)throw Refused();Match(current.Request.Before);var value=Require(current.Request.Digest);if(value.Phase!=UsbExactBlockState.Stage.PolicyVerified)throw Refused();};
  check();var callback=BeforeLinkedCommit;
#if SENTINEL_USB_HID_PNP_LINKED
  if(callback==null)throw Refused();
#endif
  if(callback!=null)callback(current.Request,ReadState(),current,check);
  check();
 }
 void VerifyLinkedRetirement(UsbExactBlockState.Transition current){
  var decision=ReadState();Action check=()=>{Match(decision);var value=Require(current.Request.Digest);if(value.Phase!=current.Phase)throw Refused();};
  check();var callback=BeforeLinkedRetirement;
#if SENTINEL_USB_HID_PNP_LINKED
  if(callback==null)throw Refused();
#endif
  if(callback!=null)callback(current.Request,decision,current,check);
  check();
 }
'@
$store=Replace-One $store ' public void CommitCandidate(' ($hook+"`r`n public void CommitCandidate(")
$store=Replace-One $store 'Match(before);Put(committed,UsbExactBlockState.Encode(after)' 'Match(before);PublishLinkedCommit(current);Match(before);if(Require(digest).Phase!=UsbExactBlockState.Stage.PolicyVerified)throw Refused();Put(committed,UsbExactBlockState.Encode(after)'
$store=Replace-One $store 'NotReparse(pending);File.Delete(pending);' 'VerifyLinkedRetirement(current);NotReparse(pending);File.Delete(pending);'
$initialize=@'
 // Caller must independently authenticate the safety/recovery receipt first.
 // This only seeds an inactive generation under the existing protected lease.
 internal void InitializeInactive(UsbExactBlockState.Snapshot initial){using(var lease=Decision()){
  if(initial==null||initial.Generation!=1||initial.Active||initial.ExternalApprovals.Length!=0||ReadState()!=null||ReadTransition()!=null)throw Refused();
  Put(committed,UsbExactBlockState.Encode(initial),UsbExactBlockState.MaximumStateBytes);
  if(!UsbExactBlockState.Same(ReadState(),initial))throw Refused();
 }}
'@
$store=Replace-One $store ' public void Dispose(){' ($initialize+"`r`n public void Dispose(){")
$store=$store+"`r`n}`r`n"
$transactionPath=Join-Path $out 'UsbHidAdmissionTransaction.generated.cs'
$storePath=Join-Path $out 'UsbHidAdmissionFileStore.generated.cs'
[IO.File]::WriteAllText($transactionPath,$transaction)
[IO.File]::WriteAllText($storePath,$store)
if($GenerateOnly){Write-Output $transactionPath;Write-Output $storePath;return}
$test=@'
using System;
using System.Linq;
using P=UsbHidAdmissionPolicy;
using T=SentinelHidAdmission.UsbExactBlockTransaction;
internal static class HidKernelTest {
 const string Owner="S-1-5-21-1-2-3-1000",Safety=@"USB\VID_0001&PID_0001\INTERNAL",A=@"USB\VID_0002&PID_0001\A",B=@"USB\VID_0003&PID_0001\B";
 static readonly DateTime Now=new DateTime(2026,10,17,0,0,0,DateTimeKind.Utc);
 static int cases;
 static void Check(bool ok){if(!ok)throw new Exception("HID kernel regression");cases++;}
 sealed class Model:T.IDurableStore,T.INativeBackend,T.INativeAuthority,T.IClock {
  internal P.Snapshot State,Policy;internal P.Transition Pending;internal bool Armed,Proof=true,FailBeforeCommit,FailAfterCommit;internal int Restores;
  internal Model(P.Snapshot s){State=Policy=s;}
  public DateTime UtcNow{get{return Now;}}
  public P.Snapshot ReadCommitted(){return State;}
  public P.Transition ReadPending(){return Pending;}
  void Match(string digest){if(Pending==null||Pending.Request.Digest!=digest)throw new InvalidOperationException();}
  public void WritePrepared(P.Request q){if(Pending!=null||!P.Same(State,q.Before))throw new InvalidOperationException();Pending=P.DecodeTransition(P.Encode(new P.Transition(q,P.Stage.Prepared)));}
  public void AdvancePending(string digest,P.Stage expected,P.Stage next){Match(digest);if(Pending.Phase!=expected||(int)next!=(int)expected+1)throw new InvalidOperationException();Pending=new P.Transition(Pending.Request,next);}
  public void CommitCandidate(string digest,P.Snapshot before,P.Snapshot after){Match(digest);if(Pending.Phase!=P.Stage.PolicyVerified||!P.Same(State,before))throw new InvalidOperationException();if(FailBeforeCommit)throw new Exception("injected before commit");State=P.Decode(P.Encode(after));if(FailAfterCommit)throw new Exception("injected after commit");}
  public P.Snapshot ClaimRecovery(string digest){Match(digest);Pending=new P.Transition(Pending.Request,P.Stage.RecoveryClaimed);return State;}
  public void RetirePending(string digest){Match(digest);if(Armed)throw new InvalidOperationException();Pending=null;}
  public void VerifyPolicy(P.Snapshot expected){if(!P.Same(Policy,expected))throw new InvalidOperationException();}
  public void PrepareIndependentRecovery(P.Request q){Armed=true;}
  public void VerifyIndependentRecovery(P.Request q){if(!Armed)throw new InvalidOperationException();}
  public void ApplyCandidate(P.Request q){if(!Armed||Pending.Phase!=P.Stage.RecoveryArmed)throw new InvalidOperationException();Policy=P.Decode(P.Encode(q.After));}
  public void StopProducersAndVerifyQuiescent(P.Request q){}
  public void RestoreBefore(P.Request q){if(Pending.Phase!=P.Stage.RecoveryClaimed)throw new InvalidOperationException();Policy=q.Before;Restores++;}
  public void RetireIndependentRecovery(P.Request q){Armed=false;}
  public void ConsumeOwnerProof(P.Request q){if(!Proof)throw new InvalidOperationException();Proof=false;}
  public void VerifyFreshExternalScope(P.Request q){}
  internal T Engine(){return new T(this,this,this,this);}
 }
 static P.Snapshot State(ulong generation,bool active,string[] approvals){return new P.Snapshot(generation,Owner,active,new[]{Safety},approvals,new string('c',64));}
 static P.Request Request(P.Snapshot before,string action,string[] approvals,string[] targets){return new P.Request(action,before,State(before.Generation+1,action=="activate"||action!="deactivate"&&before.Active,approvals),targets,Guid.NewGuid().ToString("N"),new string('b',64),Now,Now.AddMinutes(5));}
 static void Apply(Model m,P.Request q){m.Proof=true;m.Engine().Apply(q);Check(P.Same(m.State,q.After)&&P.Same(m.Policy,q.After)&&m.Pending==null&&!m.Armed);}
 public static int Main(){
  var m=new Model(State(1,false,new string[0]));Apply(m,Request(m.State,"activate",new string[0],new string[0]));
  Apply(m,Request(m.State,"allow",new[]{A},new[]{A}));Apply(m,Request(m.State,"allow",new[]{A,B},new[]{B}));
  Apply(m,Request(m.State,"block",new[]{B},new[]{A}));Check(m.State.ExternalApprovals.SequenceEqual(new[]{B}));
  foreach(bool after in new[]{false,true}){
   var previous=m.State;var q=Request(previous,"allow",new[]{A,B},new[]{A});var fault=new Model(previous){FailBeforeCommit=!after,FailAfterCommit=after};
   bool failed=false;try{fault.Engine().Apply(q);}catch{failed=true;}Check(failed&&fault.Pending!=null);
   fault.FailBeforeCommit=fault.FailAfterCommit=false;fault.Engine().Recover();var expected=after?q.After:previous;
   Check(P.Same(fault.State,expected)&&P.Same(fault.Policy,expected)&&fault.Pending==null&&!fault.Armed);Check(after?fault.Restores==0:fault.Restores==1);
  }
  Console.WriteLine("PASS "+cases+" HID admission kernel assertions; activate, allow A/B, block A preserves B, precommit rollback and postcommit preservation; pure models only");return 0;
 }
}
'@
$testPath=Join-Path $out 'UsbHidAdmissionKernelTest.generated.cs'
[IO.File]::WriteAllText($testPath,$test)
$csc=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
$target=Join-Path $out 'Sentinel.UsbHidAdmissionKernelTest.exe'
& $csc /nologo /target:exe /platform:x64 /main:HidKernelTest ('/out:'+$target) $transactionPath $storePath (Join-Path $root 'tools/usb/UsbHidAdmissionPolicy.cs') (Join-Path $root 'tools/usb/UsbExactBlockState.cs') (Join-Path $root 'tools/usb/DuckyPolicyJournal.cs') $testPath
if($LASTEXITCODE -ne 0){throw 'HID admission kernel compilation failed'}
& $target
if($LASTEXITCODE -ne 0){throw 'HID admission kernel tests failed'}
