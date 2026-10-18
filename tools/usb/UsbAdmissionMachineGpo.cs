using System;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.Win32;

// No public mutation API. Live entry remains compile-gated until native worker review.
internal static class UsbAdmissionMachineGpo {
 const string Live=@"SOFTWARE\Policies\Microsoft\Windows\DeviceInstall\Restrictions";
 // Implementation must authenticate protected journal, compiler and worker lease.
 // An implementation of this interface alone is NOT authentication.
 internal interface IWorkerAuthority {
  string Nonce {get;}
  byte[] CanonicalPlan {get;}
  void CheckCurrent(bool recovery);
 }
 internal interface ILegacyWorkerAuthority:IWorkerAuthority { UsbLegacyReleasedBaseline.Lease LegacyBaseline {get;} }
 static string Baseline(IWorkerAuthority authority,string path){var legacy=authority as ILegacyWorkerAuthority;if(legacy==null||legacy.LegacyBaseline==null)return null;if(path!=Live)throw new InvalidOperationException("Legacy baseline allowed only for machine policy");legacy.LegacyBaseline.Check();return legacy.LegacyBaseline.Nonce;}
 static bool LegacyValue(string name){return name=="SentinelOperation"||name=="DenyInstanceIDs"||name=="DenyInstanceIDsRetroactive";}
 static void Bind(IWorkerAuthority authority,UsbAdmissionJournal.Record operation){Identity(authority);if(operation==null||operation.Nonce!=authority.Nonce)throw new InvalidOperationException("Cleanup operation mismatch");}
 static bool EmptyPolicy(RegistryKey root,string path){using(var key=root.OpenSubKey(path)){if(key==null)return true;if(key.ValueCount!=0||key.SubKeyCount>2)return false;foreach(string sub in key.GetSubKeyNames()){if(sub!="AllowInstanceIDs"&&sub!="DenyDeviceIDs")return false;using(var child=key.OpenSubKey(sub))if(child==null||child.ValueCount!=0||child.SubKeyCount!=0)return false;}return true;}}
 static void EffectiveReleased(RegistryKey root,string path,string nonce,bool markerAllowed,string baselineNonce=null){using(var key=root.OpenSubKey(path)){
  if(key==null){if(baselineNonce!=null)throw new InvalidOperationException("Legacy baseline missing");return;}
  if(baselineNonce!=null)UsbLegacyReleasedBaseline.ValidatePreservedValues(key,baselineNonce);
  if(key.SubKeyCount>(baselineNonce==null?2:3)||key.ValueCount>(baselineNonce==null?1:4))throw new InvalidOperationException("Effective cleanup drift");
  foreach(string name in key.GetValueNames()){if(baselineNonce!=null&&LegacyValue(name))continue;if(!markerAllowed||name!="SentinelAdmissionOperation"||key.GetValueKind(name)!=RegistryValueKind.String||(string)key.GetValue(name)!=nonce)throw new InvalidOperationException("Effective policy not released");}
  foreach(string sub in key.GetSubKeyNames()){if(baselineNonce!=null&&sub=="DenyInstanceIDs")continue;if(sub!="AllowInstanceIDs"&&sub!="DenyDeviceIDs")throw new InvalidOperationException("Foreign effective cleanup key");using(var child=key.OpenSubKey(sub))if(child==null||child.ValueCount!=0||child.SubKeyCount!=0)throw new InvalidOperationException("Effective list not released");}
 }}
 static void SavedReleased(RegistryKey root,string path,string nonce,UsbSavedAdmissionEntry.Value[] plan,bool finalPending){using(var key=root.OpenSubKey(path)){
  if(key==null){if(finalPending)return;throw new InvalidOperationException("Saved ownership unavailable");}if(key.ValueCount>64||key.SubKeyCount>2)throw new InvalidOperationException("Saved cleanup bound");
  bool marker=key.GetValue("SentinelAdmissionOperation",null) as string==nonce&&key.GetValueKind("SentinelAdmissionOperation")==RegistryValueKind.String;
  bool deleting=key.GetValue("**Del.SentinelAdmissionOperation",null) as string==""&&key.GetValueKind("**Del.SentinelAdmissionOperation")==RegistryValueKind.String;
  if(!marker&&!deleting&&!finalPending)throw new InvalidOperationException("Saved cleanup ownership unavailable");
  foreach(string sub in key.GetSubKeyNames())if(sub!="AllowInstanceIDs"&&sub!="DenyDeviceIDs")throw new InvalidOperationException("Foreign saved cleanup key");
  foreach(string sub in new[]{"","AllowInstanceIDs","DenyDeviceIDs"})using(var child=sub==""?null:key.OpenSubKey(sub)){var current=child??key;if(sub!=""&&child==null)continue;if(sub!=""&&(current.SubKeyCount!=0||current.ValueCount>64))throw new InvalidOperationException("Foreign nested cleanup");foreach(string name in current.GetValueNames()){
   if(sub==""&&name=="SentinelAdmissionOperation"&&marker)continue;if(sub==""&&name=="**Del.SentinelAdmissionOperation"&&deleting)continue;
   if(!name.StartsWith("**Del.",StringComparison.Ordinal)||Array.Find(plan,p=>p.Key==sub&&p.Name==name.Substring(6))==null||current.GetValueKind(name)!=RegistryValueKind.String||(string)current.GetValue(name)!="")throw new InvalidOperationException("Saved cleanup value drift");
  }}
 }}
 static void PrepareCleanupCore(RegistryKey saved,RegistryKey effective,string path,IWorkerAuthority authority,string directory,UsbAdmissionJournal.Record operation,Action save){
  Bind(authority,operation);authority.CheckCurrent(true);var plan=UsbSavedAdmissionEntry.DecodePlan(authority.CanonicalPlan);var phase=UsbAdmissionCleanupStage.Read(directory,operation);
  bool pending=phase==UsbAdmissionCleanupStage.Phase.MarkerDeletionPending;if(!pending&&phase!=UsbAdmissionCleanupStage.Phase.ReleasePending)throw new InvalidOperationException("Cleanup stage refused");
  SavedReleased(saved,path,authority.Nonce,plan,false);EffectiveReleased(effective,path,authority.Nonce,true,Baseline(authority,path));
  if(!pending)UsbAdmissionCleanupStage.Advance(directory,operation,phase,UsbAdmissionCleanupStage.Phase.MarkerDeletionPending);
  authority.CheckCurrent(true);using(var key=saved.CreateSubKey(path)){key.SetValue("**Del.SentinelAdmissionOperation","",RegistryValueKind.String);key.DeleteValue("SentinelAdmissionOperation",false);key.Flush();}
  SavedReleased(saved,path,authority.Nonce,plan,false);EffectiveReleased(effective,path,authority.Nonce,true,Baseline(authority,path));authority.CheckCurrent(true);save();authority.CheckCurrent(true);
 }
 static void FinishCleanupCore(RegistryKey saved,RegistryKey effective,string path,IWorkerAuthority authority,string directory,UsbAdmissionJournal.Record operation,Action save){
  Bind(authority,operation);authority.CheckCurrent(true);var plan=UsbSavedAdmissionEntry.DecodePlan(authority.CanonicalPlan);var phase=UsbAdmissionCleanupStage.Read(directory,operation);
  bool pending=phase==UsbAdmissionCleanupStage.Phase.FinalCleanupPending;if(!pending&&phase!=UsbAdmissionCleanupStage.Phase.MarkerDeletionPending)throw new InvalidOperationException("Cleanup stage refused");
  EffectiveReleased(effective,path,authority.Nonce,false,Baseline(authority,path));SavedReleased(saved,path,authority.Nonce,plan,pending);
  if(!pending)UsbAdmissionCleanupStage.Advance(directory,operation,phase,UsbAdmissionCleanupStage.Phase.FinalCleanupPending);
  using(var key=saved.OpenSubKey(path,true))if(key!=null){foreach(var value in plan)using(var child=value.Key==""?null:key.OpenSubKey(value.Key,true)){var current=child??key;if(value.Key!=""&&child==null)continue;current.DeleteValue("**Del."+value.Name,false);current.Flush();}key.DeleteValue("**Del.SentinelAdmissionOperation",false);key.Flush();}
  // Keep empty directories: deleting a key cannot atomically exclude a foreign
  // writer inserting a value immediately before DeleteSubKey.
  if(!EmptyPolicy(saved,path))throw new InvalidOperationException("Saved cleanup not empty");EffectiveReleased(effective,path,authority.Nonce,false,Baseline(authority,path));authority.CheckCurrent(true);save();authority.CheckCurrent(true);
 }
 internal static void PrepareMachineCleanup(IWorkerAuthority authority,string directory,UsbAdmissionJournal.Record operation){
#if SENTINEL_USB_ADMISSION_LIVE_REVIEWED
  SentinelDuckyLocalGpo.Session(false,(saved,save)=>PrepareCleanupCore(saved,Registry.LocalMachine,Live,authority,directory,operation,save));
#else
  throw new InvalidOperationException("Live admission worker is not enabled");
#endif
 }
 internal static void FinishMachineCleanup(IWorkerAuthority authority,string directory,UsbAdmissionJournal.Record operation){
#if SENTINEL_USB_ADMISSION_LIVE_REVIEWED
  SentinelDuckyLocalGpo.Session(false,(saved,save)=>FinishCleanupCore(saved,Registry.LocalMachine,Live,authority,directory,operation,save));
#else
  throw new InvalidOperationException("Live admission worker is not enabled");
#endif
 }
 // Fresh saved/effective session must run AFTER final save, before clearing the
 // operation journal or deleting independent recovery tasks/images.
 internal static void VerifyMachineCleanup(IWorkerAuthority authority,string directory,UsbAdmissionJournal.Record operation){
#if SENTINEL_USB_ADMISSION_LIVE_REVIEWED
  Bind(authority,operation);authority.CheckCurrent(true);var phase=UsbAdmissionCleanupStage.Read(directory,operation);if(phase!=UsbAdmissionCleanupStage.Phase.FinalCleanupPending&&phase!=UsbAdmissionCleanupStage.Phase.VerifiedComplete)throw new InvalidOperationException("Cleanup stage refused");
  SentinelDuckyLocalGpo.Session(true,(saved,save)=>{if(!EmptyPolicy(saved,Live))throw new InvalidOperationException("Saved cleanup not empty");EffectiveReleased(Registry.LocalMachine,Live,authority.Nonce,false,Baseline(authority,Live));});authority.CheckCurrent(true);if(phase==UsbAdmissionCleanupStage.Phase.FinalCleanupPending)UsbAdmissionCleanupStage.Advance(directory,operation,UsbAdmissionCleanupStage.Phase.FinalCleanupPending,UsbAdmissionCleanupStage.Phase.VerifiedComplete);
#else
  throw new InvalidOperationException("Live admission worker is not enabled");
#endif
 }
 static string Text(UsbSavedAdmissionEntry.Value value){return Encoding.Unicode.GetString(value.Data).TrimEnd('\0');}
 static void Identity(IWorkerAuthority authority){if(authority==null||!Regex.IsMatch(authority.Nonce??"",@"\A[0-9a-f]{32}\z"))throw new InvalidOperationException("Worker authority unavailable");}
 static void OwnedOrAbsent(RegistryKey root,string path,string nonce,UsbSavedAdmissionEntry.Value[] plan,string baselineNonce=null){
  using(var key=root.OpenSubKey(path)){
   if(key==null){if(baselineNonce!=null)throw new InvalidOperationException("Legacy baseline missing");return;}
   if(baselineNonce!=null){UsbLegacyReleasedBaseline.ValidatePreservedValues(key,baselineNonce);if(key.GetValue("SentinelAdmissionOperation",null)==null){EffectiveReleased(root,path,nonce,false,baselineNonce);return;}}
   if(key.ValueCount>64||key.SubKeyCount>(baselineNonce==null?2:3))throw new InvalidOperationException("Machine policy exceeds bound");
   if(key.GetValue("SentinelAdmissionOperation",null) as string!=nonce||key.GetValueKind("SentinelAdmissionOperation")!=RegistryValueKind.String)throw new InvalidOperationException("Unowned machine policy");
   foreach(string sub in key.GetSubKeyNames())if(sub!="AllowInstanceIDs"&&sub!="DenyDeviceIDs"&&!(baselineNonce!=null&&sub=="DenyInstanceIDs"))throw new InvalidOperationException("Foreign machine policy subkey");
   foreach(string sub in new[]{"","AllowInstanceIDs","DenyDeviceIDs"})using(var child=sub==""?null:key.OpenSubKey(sub)){
    if(sub!=""&&child==null)continue;var current=child??key;
    if(sub!=""&&(current.SubKeyCount!=0||current.ValueCount>64))throw new InvalidOperationException("Foreign nested policy");
    foreach(string name in current.GetValueNames()){
     if(sub==""&&(name=="SentinelAdmissionOperation"||(baselineNonce!=null&&LegacyValue(name))))continue;
     bool deletion=name.StartsWith("**Del.",StringComparison.Ordinal);string original=deletion?name.Substring(6):name;
     var value=Array.Find(plan,p=>p.Key==sub&&p.Name==original);if(value==null)throw new InvalidOperationException("Foreign machine policy value");
     object actual=current.GetValue(name,null,RegistryValueOptions.DoNotExpandEnvironmentNames);var kind=current.GetValueKind(name);
     if(deletion){if(kind!=RegistryValueKind.String||!(actual is string)||(string)actual!="")throw new InvalidOperationException("Machine deletion drift");}
     else if(value.Kind==4){if(kind!=RegistryValueKind.DWord||!(actual is int)||(int)actual!=1)throw new InvalidOperationException("Machine switch drift");}
     else if(kind!=RegistryValueKind.String||!(actual is string)||(string)actual!=Text(value))throw new InvalidOperationException("Machine list drift");
    }
   }
  }
 }
 static void Core(RegistryKey saved,RegistryKey effective,string path,IWorkerAuthority authority,bool hold,Action save){
  Identity(authority);if(saved==null||effective==null||save==null)throw new ArgumentException("Missing machine policy session");
  // Re-parse immutable canonical compiler output. Only scope3 USB HID is accepted.
  var plan=UsbSavedAdmissionEntry.DecodePlan(authority.CanonicalPlan);
  if(!Array.Exists(plan,p=>p.Key=="DenyDeviceIDs"&&p.Name=="1"&&Text(p)==@"USB\Class_03"))throw new InvalidOperationException("Only USB HID policy supported");
  authority.CheckCurrent(!hold);
  if(hold){using(var prior=saved.OpenSubKey(path))if(prior!=null&&!EmptyPolicy(saved,path))throw new InvalidOperationException("Existing saved policy refuses admission");if(Baseline(authority,path)!=null)EffectiveReleased(effective,path,authority.Nonce,false,Baseline(authority,path));else using(var prior=effective.OpenSubKey(path))if(prior!=null&&!EmptyPolicy(effective,path))throw new InvalidOperationException("Existing effective policy refuses admission");}
  else{OwnedOrAbsent(saved,path,authority.Nonce,plan);OwnedOrAbsent(effective,path,authority.Nonce,plan,Baseline(authority,path));}
  using(var prior=saved.OpenSubKey(path))using(var applied=effective.OpenSubKey(path))if(prior==null&&applied==null&&!hold){authority.CheckCurrent(true);return;}
  using(var key=saved.CreateSubKey(path)){
   key.SetValue("SentinelAdmissionOperation",authority.Nonce,RegistryValueKind.String);
   for(int n=0;n<plan.Length;n++){
    var value=plan[hold?n:plan.Length-1-n];using(var child=value.Key==""?null:key.CreateSubKey(value.Key)){
     var current=child??key;
     if(hold){current.DeleteValue("**Del."+value.Name,false);if(value.Kind==4)current.SetValue(value.Name,1,RegistryValueKind.DWord);else current.SetValue(value.Name,Text(value),RegistryValueKind.String);}
     else{current.DeleteValue(value.Name,false);current.SetValue("**Del."+value.Name,"",RegistryValueKind.String);}
     current.Flush();
    }
   }
   key.Flush();OwnedOrAbsent(saved,path,authority.Nonce,plan);if(hold){if(Baseline(authority,path)!=null)EffectiveReleased(effective,path,authority.Nonce,false,Baseline(authority,path));else using(var current=effective.OpenSubKey(path))if(current!=null&&!EmptyPolicy(effective,path))throw new InvalidOperationException("Effective policy changed before save");}else OwnedOrAbsent(effective,path,authority.Nonce,plan,Baseline(authority,path));authority.CheckCurrent(!hold);save();authority.CheckCurrent(!hold);
  }
 }
 static void VerifyHeldCore(RegistryKey saved,RegistryKey effective,string path,IWorkerAuthority authority){
  Identity(authority);authority.CheckCurrent(false);var plan=UsbSavedAdmissionEntry.DecodePlan(authority.CanonicalPlan);
  OwnedOrAbsent(saved,path,authority.Nonce,plan);OwnedOrAbsent(effective,path,authority.Nonce,plan,Baseline(authority,path));
  foreach(var root in new[]{saved,effective})using(var key=root.OpenSubKey(path)){
   if(key==null||key.GetValue("SentinelAdmissionOperation",null) as string!=authority.Nonce||key.GetValueKind("SentinelAdmissionOperation")!=RegistryValueKind.String)throw new InvalidOperationException("Held operation missing");
   foreach(var value in plan)using(var child=value.Key==""?null:key.OpenSubKey(value.Key)){var current=child??key;if(value.Key!=""&&child==null)throw new InvalidOperationException("Held list missing");object actual=current.GetValue(value.Name,null,RegistryValueOptions.DoNotExpandEnvironmentNames);if(actual==null||(value.Kind==4?current.GetValueKind(value.Name)!=RegistryValueKind.DWord||!(actual is int)||(int)actual!=1:current.GetValueKind(value.Name)!=RegistryValueKind.String||!(actual is string)||(string)actual!=Text(value)))throw new InvalidOperationException("Held value mismatch");if(current.GetValue("**Del."+value.Name,null)!=null)throw new InvalidOperationException("Held deletion remains");}
  }authority.CheckCurrent(false);
 }
 internal static void VerifyHeldMachine(IWorkerAuthority authority){
#if SENTINEL_USB_ADMISSION_LIVE_REVIEWED
  SentinelDuckyLocalGpo.Session(true,(saved,save)=>VerifyHeldCore(saved,Registry.LocalMachine,Live,authority));
#else
  throw new InvalidOperationException("Live admission worker is not enabled");
#endif
 }
 internal static void EditMachine(IWorkerAuthority authority,bool hold){
#if SENTINEL_USB_ADMISSION_LIVE_REVIEWED
  Identity(authority);authority.CheckCurrent(!hold);
  SentinelDuckyLocalGpo.Session(false,(saved,save)=>Core(saved,Registry.LocalMachine,Live,authority,hold,save));
  authority.CheckCurrent(!hold);
#else
  throw new InvalidOperationException("Live admission worker is not enabled");
#endif
 }
#if SENTINEL_USB_ADMISSION_TEST
 internal static void TestEffectiveReleased(RegistryKey root,string path,string nonce,bool markerAllowed,string baselineNonce){EffectiveReleased(root,path,nonce,markerAllowed,baselineNonce);}
 internal static void TestEffectiveOwned(RegistryKey root,string path,string nonce,byte[] plan,string baselineNonce){OwnedOrAbsent(root,path,nonce,UsbSavedAdmissionEntry.DecodePlan(plan),baselineNonce);}
 internal static void TestVerifyHeld(RegistryKey saved,RegistryKey effective,string path,IWorkerAuthority authority){VerifyHeldCore(saved,effective,path,authority);}
 internal static void TestEdit(RegistryKey saved,RegistryKey effective,string path,IWorkerAuthority authority,bool hold,Action save){if(path!=@"Software\SentinelAdmissionMachineTest\"+authority.Nonce)throw new InvalidOperationException("Invalid test path");Core(saved,effective,path,authority,hold,save);}
#endif
#if SENTINEL_USB_ADMISSION_PRIVATE_QUALIFICATION
 // Same native edit/cleanup implementation, restricted to a nonce-bound private
 // Registry.pol probe. These entry points can never name DeviceInstall policy.
 static string PrivatePath(IWorkerAuthority authority){Identity(authority);return @"SOFTWARE\Sentinel\UsbAdmissionProbe\"+authority.Nonce;}
 internal static void VerifyHeldPrivate(IWorkerAuthority authority){string path=PrivatePath(authority);SentinelDuckyLocalGpo.Session(true,(saved,save)=>VerifyHeldCore(saved,Registry.LocalMachine,path,authority));}
 // Diagnostic qualification readback only: never saves or advances cleanup.
 internal static void ValidatePrivateCleanupReadOnly(IWorkerAuthority authority,string directory,UsbAdmissionJournal.Record operation){
  string path=PrivatePath(authority);Bind(authority,operation);authority.CheckCurrent(true);
  var phase=UsbAdmissionCleanupStage.Read(directory,operation);
  if(phase!=UsbAdmissionCleanupStage.Phase.ReleasePending&&phase!=UsbAdmissionCleanupStage.Phase.MarkerDeletionPending)throw new InvalidOperationException("Cleanup stage refused");
  var plan=UsbSavedAdmissionEntry.DecodePlan(authority.CanonicalPlan);
  SentinelDuckyLocalGpo.Session(true,(saved,save)=>{SavedReleased(saved,path,authority.Nonce,plan,false);EffectiveReleased(Registry.LocalMachine,path,authority.Nonce,true,null);});
  authority.CheckCurrent(true);
 }
 internal static void EditPrivate(IWorkerAuthority authority,bool hold){string path=PrivatePath(authority);SentinelDuckyLocalGpo.Session(false,(saved,save)=>Core(saved,Registry.LocalMachine,path,authority,hold,save));}
 internal static void PreparePrivateCleanup(IWorkerAuthority authority,string directory,UsbAdmissionJournal.Record operation){string path=PrivatePath(authority);SentinelDuckyLocalGpo.Session(false,(saved,save)=>PrepareCleanupCore(saved,Registry.LocalMachine,path,authority,directory,operation,save));}
 internal static void FinishPrivateCleanup(IWorkerAuthority authority,string directory,UsbAdmissionJournal.Record operation){string path=PrivatePath(authority);SentinelDuckyLocalGpo.Session(false,(saved,save)=>FinishCleanupCore(saved,Registry.LocalMachine,path,authority,directory,operation,save));}
 internal static void VerifyPrivateCleanup(IWorkerAuthority authority,string directory,UsbAdmissionJournal.Record operation){
  string path=PrivatePath(authority);Bind(authority,operation);authority.CheckCurrent(true);var phase=UsbAdmissionCleanupStage.Read(directory,operation);
  if(phase!=UsbAdmissionCleanupStage.Phase.FinalCleanupPending&&phase!=UsbAdmissionCleanupStage.Phase.VerifiedComplete)throw new InvalidOperationException("Cleanup stage refused");
  SentinelDuckyLocalGpo.Session(true,(saved,save)=>{if(!EmptyPolicy(saved,path))throw new InvalidOperationException("Saved cleanup not empty");EffectiveReleased(Registry.LocalMachine,path,authority.Nonce,false);});
  authority.CheckCurrent(true);if(phase==UsbAdmissionCleanupStage.Phase.FinalCleanupPending)UsbAdmissionCleanupStage.Advance(directory,operation,phase,UsbAdmissionCleanupStage.Phase.VerifiedComplete);
 }
#endif
}
