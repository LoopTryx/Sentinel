using System;
using System.Collections.Generic;
using System.IO;
using System.Security.Principal;
using System.Threading;
using System.Threading.Tasks;

// Native operator only. No renderer-provided SID, path, instance ID or proof.
// Installation is not qualification: Change additionally requires the operator's
// explicit native configuration and the reviewed live provider build.
internal static class UsbExactBlockOperations {
 static readonly SemaphoreSlim Serial=new SemaphoreSlim(1,1);
 internal sealed class Result {
  internal readonly UsbExactBlockState.Snapshot State;
  internal readonly string PolicyStatus;
  readonly string[] outcomes;
  internal string[] RecoveryOutcomes{get{return (string[])outcomes.Clone();}}
  internal bool RestartRequired{get{return Array.IndexOf(outcomes,"restart_requires_windows_restart")>=0;}}
  internal Result(UsbExactBlockState.Snapshot state,string status,string[] recovery){State=state;PolicyStatus=status;outcomes=(string[])recovery.Clone();}
 }
 sealed class Clock:UsbExactBlockTransaction.IClock{public DateTime UtcNow{get{return DateTime.UtcNow;}}}
 sealed class RecoveryAuthority:UsbExactBlockTransaction.INativeAuthority {
  public void ConsumeOwnerProof(UsbExactBlockState.Request request){throw new InvalidOperationException("Recovery cannot authorize USB access changes");}
  public void VerifyFreshExternalScope(UsbExactBlockState.Request request){throw new InvalidOperationException("Recovery cannot authorize USB access changes");}
 }
 static void Require(bool value,string message){if(!value)throw new InvalidOperationException(message);}
 static string NativeOwner(){using(var identity=WindowsIdentity.GetCurrent()){Require(identity.User!=null&&new WindowsPrincipal(identity).IsInRole(WindowsBuiltInRole.Administrator),"The protected USB operator requires Windows elevation");return identity.User.Value;}}
 static void Qualified(bool nativeQualified){
#if SENTINEL_USB_EXACT_LIVE_REVIEWED
  Require(nativeQualified,"Persistent USB changes await native qualification");
#else
  throw new InvalidOperationException("Reviewed exact USB provider is not enabled in this build");
#endif
 }
 // Group Policy COM objects are constructed and disposed on one explicit STA.
 static Task<T> Sta<T>(Func<T> action){var completion=new TaskCompletionSource<T>();var thread=new Thread(()=>{try{completion.SetResult(action());}catch(Exception error){completion.SetException(error);}});thread.IsBackground=true;thread.SetApartmentState(ApartmentState.STA);thread.Start();return completion.Task;}
 sealed class Scope:IDisposable {
  internal readonly UsbExactBlockFileStore Store;
  internal readonly UsbExactBlockBackend Backend;
  readonly UsbAdmissionWorkerBackend legacy;
  internal Scope(){NativeOwner();try{
   string hash=UsbExactBlockCapability.ReadWorkerHash();
   Store=new UsbExactBlockFileStore(Path.Combine(UsbExactBlockCapability.Root,"State"));
   // The old empty-policy checker has a historical capture mode. Exact usage
   // requires its existing authenticated binding; it must never invoke capture.
   string binding=Path.Combine(UsbAdmissionWorkerBackend.DirectoryPath,"legacy-baseline.bin");
   Require(File.Exists(binding)&&(File.GetAttributes(binding)&FileAttributes.ReparsePoint)==0,"The authenticated original USB policy baseline is required");
   bool initial=Store.ReadCommitted()==null&&Store.ReadPending()==null;
   legacy=UsbAdmissionWorkerBackend.AcquireRetiredForExact(initial);
   Backend=new UsbExactBlockBackend(Store,hash);
  }catch{Dispose();throw;}}
  internal void CheckLegacy(){legacy.CheckRetiredForExact();}
  internal UsbExactBlockState.Snapshot Verified(){CheckLegacy();Require(Store.ReadPending()==null,"An interrupted USB transaction requires recovery");var state=Store.ReadCommitted();Backend.VerifyPolicy(state);Require(Store.ReadPending()==null&&UsbExactBlockState.Same(state,Store.ReadCommitted()),"USB state changed during verification");CheckLegacy();return state;}
  internal UsbExactBlockTransaction Transaction(UsbExactBlockTransaction.INativeAuthority authority){return new UsbExactBlockTransaction(Store,Backend,authority,new Clock());}
  public void Dispose(){if(Backend!=null)Backend.Dispose();if(legacy!=null)legacy.Dispose();if(Store!=null)Store.Dispose();}
 }
 internal static async Task<UsbExactBlockState.Snapshot> ReadVerified(){await Serial.WaitAsync();try{return await Sta(()=>{using(var scope=new Scope())return scope.Verified();});}finally{Serial.Release();}}
 internal static async Task<UsbExactBlockState.Snapshot> RecoverPending(){await Serial.WaitAsync();try{return await Sta(()=>{using(var scope=new Scope()){scope.CheckLegacy();var transaction=scope.Transaction(new RecoveryAuthority());transaction.Recover();Require(transaction.CurrentStatus==UsbExactBlockTransaction.Status.PolicyVerified,"USB recovery is not verified");return scope.Verified();}});}finally{Serial.Release();}}
 internal static async Task<Result> Change(IntPtr ownerWindow,string action,string reference,string sessionSalt,string topology,bool nativeQualified,bool restartSelected=false,Action<string> presentSelection=null){
  Qualified(nativeQualified);Require(action=="block"||action=="allow","Exact USB action refused");await Serial.WaitAsync();Scope scope=null;
  try{
   scope=await Sta(()=>new Scope());
   string selectionName="Disconnected blocked input";
   var request=await Sta(()=>{var before=scope.Verified();var inventory=UsbAdmissionInventory.Collect(topology);var prepared=UsbExactBlockSelection.Prepare(action,before,inventory,reference,sessionSalt,topology,NativeOwner(),DateTime.UtcNow);foreach(var subject in inventory.Subjects)if(subject!=null&&subject.Input!=null&&Array.Exists(prepared.Targets,id=>string.Equals(id,subject.Input.Instance,StringComparison.OrdinalIgnoreCase))){selectionName=UsbAdmissionInventory.Display(subject.DisplayName);break;}return prepared;});
   if(presentSelection!=null)presentSelection(selectionName);
   // Verify is invoked on the native UI synchronization context so Windows Hello
   // retains its foreground owner and per-session proof binding.
   var authority=await UsbExactBlockNativeAuthority.Verify(ownerWindow,request);
   Require(authority!=null,"Windows Hello verification was cancelled or unavailable");
   return await Sta(()=>{
    scope.CheckLegacy();var transaction=scope.Transaction(authority);
    try{transaction.Apply(request);}catch(Exception applyError){try{scope.Transaction(new RecoveryAuthority()).Recover();}catch(Exception recoveryError){throw new AggregateException("USB operation failed and authenticated recovery needs attention",applyError,recoveryError);}throw;}
    Require(transaction.CurrentStatus==UsbExactBlockTransaction.Status.PolicyVerified,"USB policy outcome is not verified");
    var state=scope.Verified();Require(UsbExactBlockState.Same(state,request.After),"USB committed result changed");
    string[] outcomes=new string[0];
    if(action=="allow"&&restartSelected){
     // Device restart is limited to this exact released target set. Failure to
     // reclassify it never widens the operation to other USB inputs.
     try{
      var inventory=UsbAdmissionInventory.Collect(request.TopologyHash);var safety=new List<string>();
      Require(inventory!=null&&inventory.Preflight!=null&&inventory.Preflight.Candidates!=null,"Fresh released-device inventory unavailable");
      foreach(var candidate in inventory.Preflight.Candidates)if(candidate!=null&&candidate.Category=="required_safety_candidate")safety.Add(candidate.Instance);
      var plan=UsbAdmissionDeviceRecovery.Prepare(inventory,safety.ToArray(),request.Targets);
      var recovery=UsbAdmissionDeviceRecovery.Execute(plan,()=>{scope.CheckLegacy();Require(scope.Store.ReadPending()==null&&UsbExactBlockState.Same(scope.Store.ReadCommitted(),request.After),"Released USB policy changed");scope.Backend.VerifyPolicy(request.After);foreach(string target in request.Targets)Require(Array.IndexOf(request.After.Blocked,target)<0,"Selected device remains blocked");return true;});
      outcomes=recovery.Outcomes;
     }catch{outcomes=new[]{"restart_not_verified_reconnect_or_windows_restart_may_be_required"};}
    }
    scope.Verified();return new Result(state,"policy_verified_input_unverified",outcomes);
   });
  }finally{if(scope!=null)scope.Dispose();Serial.Release();}
 }
}
