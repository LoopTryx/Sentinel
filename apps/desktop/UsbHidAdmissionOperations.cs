using System;
using System.IO;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Threading;
using System.Threading.Tasks;
using P=UsbHidAdmissionPolicy;
using Store=SentinelHidAdmission.UsbExactBlockFileStore;
using Backend=SentinelHidAdmission.UsbExactBlockBackend;
using Transaction=SentinelHidAdmission.UsbExactBlockTransaction;

// Native controller only. Renderer references select fresh native groups; they
// cannot provide identities, proofs, generations, receipts or policy bytes.
internal static class UsbHidAdmissionOperations {
 internal sealed class OperationFailure:Exception {
  internal readonly string Stage;internal readonly int NativeHResult;internal readonly bool RecoveryRequired;
  internal OperationFailure(string stage,Exception cause):base("USB action failed at "+stage,cause){Stage=stage;NativeHResult=cause.HResult;RecoveryRequired=cause is InvalidOperationException&&cause.Message=="An interrupted USB decision requires recovery";}
 }
 static readonly SemaphoreSlim Serial=new SemaphoreSlim(1,1);
 sealed class Clock:Transaction.IClock {public DateTime UtcNow{get{return DateTime.UtcNow;}}}
 sealed class RecoveryAuthority:Transaction.INativeAuthority {
  public void ConsumeOwnerProof(P.Request q){throw new InvalidOperationException("Recovery cannot authorize a USB decision");}
  public void VerifyFreshExternalScope(P.Request q){throw new InvalidOperationException("Recovery cannot authorize a USB decision");}
 }
 static void Require(bool value,string message){if(!value)throw new InvalidOperationException(message);}
 static Task<T> Sta<T>(Func<T> action){var result=new TaskCompletionSource<T>();var thread=new Thread(()=>{try{result.SetResult(action());}catch(Exception error){result.SetException(error);}});thread.IsBackground=true;thread.SetApartmentState(ApartmentState.STA);thread.Start();return result.Task;}
 sealed class Scope:IDisposable {
  internal readonly Store Store;internal readonly Backend Backend;readonly UsbAdmissionWorkerBackend retired;
  internal Scope(){
#if !SENTINEL_USB_HID_ADMISSION_LIVE_REVIEWED || !SENTINEL_USB_HID_PNP_LINKED
   throw new InvalidOperationException("Reviewed linked HID backend is unavailable");
#else
   try{
    using(var owner=WindowsIdentity.GetCurrent())Require(new WindowsPrincipal(owner).IsInRole(WindowsBuiltInRole.Administrator),"USB operator elevation required");
    retired=UsbAdmissionWorkerBackend.AcquireRetiredForExact(false);
    Store=new Store(Path.Combine(UsbHidAdmissionCapability.Root,"State"));
    Backend=new Backend(Store,UsbHidAdmissionCapability.ReadWorkerHash());
    if(Store.ReadCommitted()==null&&Store.ReadPending()==null){
     // Reuse authenticated built-in enrollment only. Previously seen external
     // devices are deliberately not carried into the new approval set.
     var enrolled=retired.ReadRetiredEnrollment();Require(enrolled!=null&&enrolled.InternalSafety.Length>0,"Built-in input enrollment is required before setup");
     using(var owner=WindowsIdentity.GetCurrent())Require(enrolled.OwnerSid==owner.User.Value,"USB enrollment belongs to another owner");
     string receipt;using(var sha=SHA256.Create())receipt=BitConverter.ToString(sha.ComputeHash(UsbEnrollmentConfig.Encode(enrolled))).Replace("-","").ToLowerInvariant();
     var initial=new P.Snapshot(1,enrolled.OwnerSid,false,enrolled.InternalSafety,new string[0],receipt);
     var inventory=UsbAdmissionInventory.Collect(null);UsbHidAdmissionNativeAuthority.CheckBefore(initial,inventory,inventory.Preflight.TopologyToken);
     Backend.VerifyPolicy(null);retired.CheckRetiredForExact();Store.InitializeInactive(initial);
    }
   }catch{Dispose();throw;}
#endif
  }
  internal P.Snapshot Verified(){retired.CheckRetiredForExact();Require(Store.ReadPending()==null,"An interrupted USB decision requires recovery");var state=Store.ReadCommitted();Require(state!=null,"USB initialization required");Backend.VerifyPolicy(state);Require(Store.ReadPending()==null&&P.Same(state,Store.ReadCommitted()),"USB decision changed");retired.CheckRetiredForExact();return state;}
  internal Transaction Engine(Transaction.INativeAuthority authority){return new Transaction(Store,Backend,authority,new Clock());}
  public void Dispose(){if(Backend!=null)Backend.Dispose();if(Store!=null)Store.Dispose();if(retired!=null)retired.Dispose();}
 }
 internal static async Task<P.Snapshot> ReadVerified(){await Serial.WaitAsync();try{return await Sta(()=>{using(var scope=new Scope())return scope.Verified();});}finally{Serial.Release();}}
 internal static async Task<P.Snapshot> RecoverPending(){await Serial.WaitAsync();try{return await Sta(()=>{using(var scope=new Scope()){scope.Engine(new RecoveryAuthority()).Recover();return scope.Verified();}});}finally{Serial.Release();}}
 static bool Released(Scope scope,P.Snapshot expected,string[] targets){var current=scope.Verified();if(!P.Same(current,expected))return false;foreach(string id in targets)if(Array.FindIndex(current.ExternalApprovals,x=>string.Equals(x,id,StringComparison.OrdinalIgnoreCase))<0)return false;return true;}
 static UsbAdmissionDeviceRecovery.Result Reconnect(Scope scope,P.Snapshot expected,string topology,string[] targets){
  // Policy success survives a failed restart. No recovery operation can add a
  // grant or widen the original Hello-bound target set.
  try{Require(Released(scope,expected,targets),"Selected HID approval changed");var inventory=UsbAdmissionInventory.Collect(topology);UsbHidAdmissionNativeAuthority.CheckBefore(expected,inventory,topology);var plan=UsbAdmissionDeviceRecovery.Prepare(inventory,expected.InternalSafety,targets);return UsbAdmissionDeviceRecovery.Execute(plan,()=>Released(scope,expected,targets));}
  catch{return new UsbAdmissionDeviceRecovery.Result{State="recovery_partial",Outcomes=new[]{"restart_not_verified_reconnect_or_windows_restart_may_be_required"}};}
 }
 // Keep the six-argument recovery entry point used by installed recovery tools.
 internal static Task<P.Snapshot> Change(IntPtr window,string action,string reference,string salt,string topology,Action<string> selectedName){return ChangeAndReconnect(window,action,reference,salt,topology,selectedName,null);}
 internal static async Task<P.Snapshot> ChangeAndReconnect(IntPtr window,string action,string reference,string salt,string topology,Action<string> selectedName,Action<UsbAdmissionDeviceRecovery.Result> recoveryResult){
  await Serial.WaitAsync();Scope scope=null;string failureStage="initialize";
  try{
   scope=await Sta(()=>new Scope());
   if(action=="allow"&&recoveryResult!=null){
    failureStage="selection";var retry=await Sta(()=>{var before=scope.Verified();var inventory=UsbAdmissionInventory.Collect(topology);UsbHidAdmissionNativeAuthority.CheckBefore(before,inventory,topology);var ids=UsbHidAdmissionSelection.SelectExternal(inventory,reference,salt);bool all=true;foreach(string id in ids)all&=Array.FindIndex(before.ExternalApprovals,x=>string.Equals(x,id,StringComparison.OrdinalIgnoreCase))>=0;return all?Tuple.Create(before,inventory,UsbHidAdmissionSelection.ApprovedReconnect(before,inventory,reference,salt,topology)):null;});
    if(retry!=null){
     if(selectedName!=null)foreach(var subject in retry.Item2.Subjects)if(Array.Exists(retry.Item3,id=>string.Equals(id,subject.Input.Instance,StringComparison.OrdinalIgnoreCase))){selectedName(subject.DisplayName);break;}
     failureStage="owner_verification";var binding=UsbHidAdmissionSelection.ReconnectBinding(retry.Item1,topology,retry.Item3);var proof=await UsbAdmissionAuthorization.Verify(window,binding);Require(proof!=null,"Windows Hello verification cancelled or unavailable");proof.Consume(binding);
     failureStage="reconnect";var recovery=await Sta(()=>Reconnect(scope,retry.Item1,topology,retry.Item3));
     failureStage="readback";var current=await Sta(()=>scope.Verified());Require(P.Same(current,retry.Item1),"USB approval changed during reconnect");recoveryResult(recovery);return current;
    }
   }
   failureStage="selection";var request=await Sta(()=>{var before=scope.Verified();var inventory=UsbAdmissionInventory.Collect(topology);var q=UsbHidAdmissionSelection.Prepare(action,before,inventory,reference,salt,topology,before.OwnerSid,DateTime.UtcNow);if(selectedName!=null){string name=action=="activate"?"Enable USB Guard":action=="deactivate"?"Release USB Guard":"USB input device";foreach(var subject in inventory.Subjects)if(Array.Exists(q.Targets,id=>string.Equals(id,subject.Input.Instance,StringComparison.OrdinalIgnoreCase))){name=subject.DisplayName;break;}return Tuple.Create(q,name);}return Tuple.Create(q,"");});
   if(selectedName!=null)selectedName(request.Item2);
   var qSelected=request.Item1;
   failureStage="owner_verification";var authority=await UsbHidAdmissionNativeAuthority.Verify(window,qSelected,()=>{var pending=scope.Store.ReadPending();if(pending==null)return (P.Stage?)null;Require(pending.Request.Digest==qSelected.Digest,"Another USB decision is pending");return pending.Phase;});
   Require(authority!=null,"Windows Hello verification cancelled or unavailable");
   failureStage="enforcement";var committed=await Sta(()=>{try{scope.Engine(authority).Apply(qSelected);}catch(Exception apply){try{scope.Engine(new RecoveryAuthority()).Recover();}catch(Exception recovery){throw new AggregateException("USB decision failed and recovery needs attention",apply,recovery);}throw;}failureStage="readback";var after=scope.Verified();Require(P.Same(after,qSelected.After),"USB commit changed");return after;});
   if(action=="allow"&&recoveryResult!=null){failureStage="reconnect";var recovery=await Sta(()=>Reconnect(scope,committed,qSelected.TopologyHash,qSelected.Targets));failureStage="readback";var current=await Sta(()=>scope.Verified());Require(P.Same(current,committed),"USB approval changed during reconnect");recoveryResult(recovery);}
   return committed;
  }catch(Exception error){throw new OperationFailure(failureStage,error);}finally{if(scope!=null)scope.Dispose();Serial.Release();}
 }
}
