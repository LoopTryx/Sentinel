using System;using System.IO;using System.Text;using System.Linq;using System.Collections.Generic;using System.Text.RegularExpressions;using Microsoft.Win32;

// Saved/effective admission overlay. Default build can address only a disposable
// private path. A live factory is compiled only by a separate reviewed build.
internal sealed class UsbHidAdmissionGpo {
 internal sealed class Image {
  readonly SortedDictionary<string,object> values;readonly string[] tombstones;
  internal Image(IDictionary<string,object> source,string[] deletions=null){values=new SortedDictionary<string,object>(StringComparer.Ordinal);foreach(var entry in source){if(!(entry.Value is int)&&!(entry.Value is string))throw new ArgumentException("Immutable policy scalar required");values.Add(entry.Key,entry.Value);}tombstones=deletions==null?new string[0]:(string[])deletions.Clone();}
  internal SortedDictionary<string,object> Values{get{return new SortedDictionary<string,object>(values,StringComparer.Ordinal);}}internal string[] Tombstones{get{return (string[])tombstones.Clone();}}
 }
 readonly string path;readonly Action fence;readonly string legacyNonce;
 internal UsbHidAdmissionGpo(string privatePath,string nonce,Action checkCurrent,string privateLegacyNonce=null){if(!Regex.IsMatch(nonce??"",@"\A[0-9a-f]{32}\z")||privatePath!=@"SOFTWARE\Sentinel\HidAdmissionQualification\"+nonce||checkCurrent==null||privateLegacyNonce!=null&&!Regex.IsMatch(privateLegacyNonce,@"\A[0-9a-f]{32}\z"))throw new InvalidOperationException("Unqualified HID admission location");path=privatePath;fence=checkCurrent;legacyNonce=privateLegacyNonce;}
#if SENTINEL_USB_HID_ADMISSION_LIVE_REVIEWED
 internal static UsbHidAdmissionGpo CreateReviewedMachine(UsbExactBlockBaseline baseline,Action writerFence){if(baseline==null||writerFence==null)throw new ArgumentNullException();baseline.Check();return new UsbHidAdmissionGpo(baseline,writerFence);}
 UsbHidAdmissionGpo(UsbExactBlockBaseline baseline,Action writerFence){path=@"SOFTWARE\Policies\Microsoft\Windows\DeviceInstall\Restrictions";legacyNonce=baseline.Nonce;fence=()=>{writerFence();baseline.Check();};}
#endif
 internal static Image Empty(){return new Image(new Dictionary<string,object>());}
 static bool Exact(string id){try{UsbExactBlockState.ValidateId(id);return true;}catch{return false;}}
 static bool Index(string name,int maximum){int n;return int.TryParse(name,out n)&&n>=1&&n<=maximum&&n.ToString()==name;}
 static bool Root(string name){return name=="AllowDenyLayered"||name=="AllowInstanceIDs"||name=="DenyDeviceIDs"||name=="DenyDeviceIDsRetroactive";}
 static bool Name(string name){if(Root(name)||name=="SentinelHidAdmissionState")return true;if(name.StartsWith("AllowInstanceIDs\\",StringComparison.Ordinal))return Index(name.Substring(17),32);return name=="DenyDeviceIDs\\1";}
 static string CompilerText(UsbSavedAdmissionEntry.Value v){return new UnicodeEncoding(false,false,true).GetString(v.Data,0,v.Data.Length-2);}
 internal static Image Desired(UsbHidAdmissionPolicy.Snapshot state,byte[] authoritativeCompilerOutput){if(state==null)throw new ArgumentNullException("state");if(!state.Active){if(authoritativeCompilerOutput!=null&&authoritativeCompilerOutput.Length!=0)throw new ArgumentException("Inactive overlay cannot consume active compiler entries");return Empty();}var compiled=UsbSavedAdmissionEntry.DecodePlan(authoritativeCompilerOutput);var values=new SortedDictionary<string,object>(StringComparer.Ordinal);var approvals=new List<string>();foreach(var v in compiled){string full=v.Key==""?v.Name:v.Key+"\\"+v.Name;if(!Name(full)||full=="SentinelHidAdmissionState")throw new ArgumentException("Unexpected compiler schema");if(v.Kind==4){if(v.Key!=""||!Root(v.Name)||v.Data.Length!=4||BitConverter.ToUInt32(v.Data,0)!=1)throw new ArgumentException("Compiler switch mismatch");values.Add(full,1);}else{string text=CompilerText(v);if(v.Key=="AllowInstanceIDs"){if(!Exact(text))throw new ArgumentException("Compiler subject must be exact USB HID function");approvals.Add(text);}else if(full!="DenyDeviceIDs\\1"||text!=@"USB\Class_03")throw new ArgumentException("Compiler compatible-ID mismatch");values.Add(full,text);}}
  foreach(string flag in new[]{"AllowDenyLayered","AllowInstanceIDs","DenyDeviceIDs","DenyDeviceIDsRetroactive"})if(!values.ContainsKey(flag))throw new ArgumentException("Compiler switch missing");if(!values.ContainsKey("DenyDeviceIDs\\1")||!approvals.OrderBy(x=>x,StringComparer.Ordinal).SequenceEqual(UsbHidAdmissionPolicy.CompilerApprovals(state),StringComparer.Ordinal))throw new ArgumentException("Compiler approvals differ from authenticated decision");values.Add("SentinelHidAdmissionState","SNTHID01:"+state.Generation+":"+state.Digest);return new Image(values);
 }
 static bool Equal(object a,object b){return a!=null&&b!=null&&a.GetType()==b.GetType()&&a.Equals(b);}
 static bool BaselineField(string name){return name=="SentinelOperation"||name=="DenyInstanceIDs"||name=="DenyInstanceIDsRetroactive";}
 static void ValidateChildren(RegistryKey key,bool legacy){if(key.SubKeyCount>(legacy?3:2))throw new InvalidOperationException("Foreign admission children");foreach(string sub in key.GetSubKeyNames()){if(sub=="AllowInstanceIDs"||sub=="DenyDeviceIDs")continue;if(!legacy||sub!="DenyInstanceIDs")throw new InvalidOperationException("Foreign admission child");using(var neutral=key.OpenSubKey(sub))if(neutral==null||neutral.ValueCount!=0||neutral.SubKeyCount!=0)throw new InvalidOperationException("Competing exact deny entries");}}
 static Image ReadKey(RegistryKey key,bool saved,bool legacy,string nonce){if(key==null){if(legacy&&!saved)throw new InvalidOperationException("Authenticated legacy baseline missing");return Empty();}ValidateChildren(key,legacy);var values=new SortedDictionary<string,object>(StringComparer.Ordinal);var deletions=new List<string>();
  if(legacy&&!saved){if(key.GetValueKind("SentinelOperation")!=RegistryValueKind.String||(string)key.GetValue("SentinelOperation")!=nonce)throw new InvalidOperationException("Legacy marker changed");foreach(string flag in new[]{"DenyInstanceIDs","DenyInstanceIDsRetroactive"})if(key.GetValueKind(flag)!=RegistryValueKind.DWord||!((object)1).Equals(key.GetValue(flag)))throw new InvalidOperationException("Legacy switch changed");}
  foreach(string sub in new[]{"","AllowInstanceIDs","DenyDeviceIDs"})using(var child=sub==""?null:key.OpenSubKey(sub)){if(sub!=""&&child==null)continue;var current=child??key;if(sub!=""&&current.SubKeyCount!=0||current.ValueCount>40)throw new InvalidOperationException("Admission policy bound");foreach(string name in current.GetValueNames()){if(legacy&&!saved&&sub==""&&BaselineField(name))continue;string plain=name.StartsWith("**Del.",StringComparison.Ordinal)?name.Substring(6):name;string full=sub==""?plain:sub+"\\"+plain;if(!Name(full))throw new InvalidOperationException("Foreign admission field");object value=current.GetValue(name,null,RegistryValueOptions.DoNotExpandEnvironmentNames);if(name!=plain){if(!saved||current.GetValueKind(name)!=RegistryValueKind.String||!(value is string)||(string)value!="")throw new InvalidOperationException("Malformed admission tombstone");deletions.Add(full);continue;}
    if(sub=="AllowInstanceIDs"){if(current.GetValueKind(name)!=RegistryValueKind.String||!(value is string)||!Exact((string)value))throw new InvalidOperationException("Malformed approval");}
    else if(sub=="DenyDeviceIDs"){if(current.GetValueKind(name)!=RegistryValueKind.String||!(value is string)||(string)value!=@"USB\Class_03")throw new InvalidOperationException("Foreign deny compatible ID");}
    else if(name=="SentinelHidAdmissionState"){if(current.GetValueKind(name)!=RegistryValueKind.String||!(value is string)||!Regex.IsMatch((string)value,@"\ASNTHID01:[1-9][0-9]{0,19}:[0-9a-f]{64}\z"))throw new InvalidOperationException("Malformed admission marker");}
    else if(current.GetValueKind(name)!=RegistryValueKind.DWord||!((object)1).Equals(value))throw new InvalidOperationException("Malformed admission switch");values.Add(full,value);
   }}return new Image(values,deletions.ToArray());
 }
 Image Read(RegistryKey root,string location,bool saved){using(var key=root.OpenSubKey(location))return ReadKey(key,saved,legacyNonce!=null,legacyNonce);}
 internal static Image ReadPrivateForTest(RegistryKey key,bool saved){return ReadKey(key,saved,false,null);}
 internal static void ValidateLegacyOverlay(RegistryKey key,Image before,Image candidate,bool transition){if(key==null||before==null||candidate==null)throw new ArgumentNullException();string nonce=key.GetValue("SentinelOperation") as string;if(!Regex.IsMatch(nonce??"",@"\A[0-9a-f]{32}\z"))throw new InvalidOperationException("Legacy nonce missing");var actual=ReadKey(key,false,true,nonce);if(transition)Recognizable(actual,before,candidate);else if(!Same(actual,before))throw new InvalidOperationException("Admission overlay differs");}
 internal static bool Same(Image first,Image second){var a=first.Values;var b=second.Values;if(a.Count!=b.Count)return false;foreach(var value in a){object other;if(!b.TryGetValue(value.Key,out other)||!Equal(value.Value,other))return false;}return true;}
 internal Image Saved(){Image value=null;SentinelDuckyLocalGpo.Session(true,(root,save)=>{fence();value=Read(root,path,true);fence();});return value;}
 internal Image Effective(){fence();var value=Read(Registry.LocalMachine,path,false);fence();return value;}
 internal void Verify(Image expected){var saved=Saved();if(saved.Tombstones.Length!=0||!Same(saved,expected)||!Same(Effective(),expected))throw new InvalidOperationException("Exact saved/effective readback differs");}
 static void Recognizable(Image actual,Image before,Image candidate){var a=before.Values;var b=candidate.Values;foreach(var value in actual.Values){object oldValue,newValue;bool old=a.TryGetValue(value.Key,out oldValue),next=b.TryGetValue(value.Key,out newValue);if(!(old&&Equal(value.Value,oldValue))&&!(next&&Equal(value.Value,newValue)))throw new InvalidOperationException("Foreign policy drift retained");}}
 internal void WriteSaved(Image before,Image candidate,Image desired,bool recovering){
  if(before==null||candidate==null||desired==null)throw new ArgumentException();fence();
  SentinelDuckyLocalGpo.Session(false,(root,save)=>{
   fence();var current=Read(root,path,true);ValidateTombstones(current,before,candidate);if(recovering)Recognizable(current,before,candidate);else if(!Same(current,before))throw new InvalidOperationException("Saved baseline changed");
   var union=before.Values;foreach(var entry in candidate.Values)union[entry.Key]=entry.Value;var wanted=desired.Values;
   using(var key=root.CreateSubKey(path))foreach(var entry in union){
    fence();int slash=entry.Key.IndexOf('\\');string sub=slash<0?"":entry.Key.Substring(0,slash),name=slash<0?entry.Key:entry.Key.Substring(slash+1);using(var child=sub==""?null:key.CreateSubKey(sub)){
     var target=child??key;object value;if(wanted.TryGetValue(entry.Key,out value)){target.DeleteValue("**Del."+name,false);target.SetValue(name,value,value is int?RegistryValueKind.DWord:RegistryValueKind.String);}else{target.DeleteValue(name,false);target.SetValue("**Del."+name,"",RegistryValueKind.String);}target.Flush();
    }
   }
   fence();save();fence();if(!Same(Read(root,path,true),desired))throw new InvalidOperationException("Saved exact policy differs");
  });
 }
 internal static void ValidateTombstones(Image actual,Image before,Image candidate){var allowed=before.Values;foreach(var value in candidate.Values)allowed[value.Key]=value.Value;foreach(string key in actual.Tombstones)if(!allowed.ContainsKey(key))throw new InvalidOperationException("Foreign deletion instruction retained");}
 // Remove only authenticated transition deletion instructions after effective
 // readback proves their effects. Commit is gated on the subsequent clean save.
 internal void FinalizeSaved(Image before,Image candidate,Image desired){
  VerifyEffective(desired);SentinelDuckyLocalGpo.Session(false,(root,save)=>{fence();var image=Read(root,path,true);ValidateTombstones(image,before,candidate);if(!Same(image,desired))throw new InvalidOperationException("Saved finalization drift");
   using(var key=root.OpenSubKey(path,true)){if(key==null){if(image.Tombstones.Length!=0)throw new InvalidOperationException();return;}foreach(string full in image.Tombstones){fence();int slash=full.IndexOf('\\');string sub=slash<0?"":full.Substring(0,slash),name=slash<0?full:full.Substring(slash+1);using(var child=sub==""?null:key.OpenSubKey(sub,true)){var current=child??key;if(sub!=""&&child==null)throw new InvalidOperationException();current.DeleteValue("**Del."+name,false);current.Flush();}}}
   fence();save();fence();var final=Read(root,path,true);if(final.Tombstones.Length!=0||!Same(final,desired))throw new InvalidOperationException("Saved finalization not verified");
  });
 }
 internal void WaitEffective(Image before,Image candidate,Image desired){
  var clock=System.Diagnostics.Stopwatch.StartNew();
  for(;;){fence();var current=Effective();Recognizable(current,before,candidate);if(Same(current,desired)){fence();return;}if(clock.ElapsedMilliseconds>=30000)throw new TimeoutException("Admission effective policy did not converge");System.Threading.Thread.Sleep(100);}
 }
 internal void VerifyEffective(Image expected){if(!Same(Effective(),expected))throw new InvalidOperationException("Effective exact policy differs");}
 internal void DeleteEmptyPrivateProbe(){if(!path.StartsWith(@"SOFTWARE\Sentinel\HidAdmissionQualification\",StringComparison.Ordinal))throw new InvalidOperationException("Private cleanup only");Verify(Empty());SentinelDuckyLocalGpo.Session(false,(root,save)=>{fence();root.DeleteSubKeyTree(path,false);save();});if(legacyNonce==null)Registry.LocalMachine.DeleteSubKeyTree(path,false);}
}
