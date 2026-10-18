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
 internal static async Task<P.Snapshot> Change(IntPtr window,string action,string reference,string salt,string topology,Action<string> selectedName){
  await Serial.WaitAsync();Scope scope=null;
  try{
   scope=await Sta(()=>new Scope());
   var request=await Sta(()=>{var before=scope.Verified();var inventory=UsbAdmissionInventory.Collect(topology);var q=UsbHidAdmissionSelection.Prepare(action,before,inventory,reference,salt,topology,before.OwnerSid,DateTime.UtcNow);if(selectedName!=null){string name=action=="activate"?"Enable USB Guard":action=="deactivate"?"Release USB Guard":"USB input device";foreach(var subject in inventory.Subjects)if(Array.Exists(q.Targets,id=>string.Equals(id,subject.Input.Instance,StringComparison.OrdinalIgnoreCase))){name=subject.DisplayName;break;}return Tuple.Create(q,name);}return Tuple.Create(q,"");});
   if(selectedName!=null)selectedName(request.Item2);
   var qSelected=request.Item1;
   var authority=await UsbHidAdmissionNativeAuthority.Verify(window,qSelected,()=>{var pending=scope.Store.ReadPending();if(pending==null)return (P.Stage?)null;Require(pending.Request.Digest==qSelected.Digest,"Another USB decision is pending");return pending.Phase;});
   Require(authority!=null,"Windows Hello verification cancelled or unavailable");
   return await Sta(()=>{try{scope.Engine(authority).Apply(qSelected);}catch(Exception apply){try{scope.Engine(new RecoveryAuthority()).Recover();}catch(Exception recovery){throw new AggregateException("USB decision failed and recovery needs attention",apply,recovery);}throw;}var after=scope.Verified();Require(P.Same(after,qSelected.After),"USB commit changed");return after;});
  }finally{if(scope!=null)scope.Dispose();Serial.Release();}
 }
}
