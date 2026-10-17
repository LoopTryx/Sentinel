using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.Win32;

// Default build is private-only; reviewed machine factory requires a pinned baseline.
// It exercises actual saved/effective local GPO machinery at a disposable private key.
internal sealed class UsbExactBlockGpo {
 internal sealed class Image {
  readonly SortedDictionary<string,object> values;readonly string[] tombstones;
  internal Image(IDictionary<string,object> source,string[] deletions=null){tombstones=deletions==null?new string[0]:(string[])deletions.Clone();values=new SortedDictionary<string,object>(StringComparer.Ordinal);foreach(var entry in source)values.Add(entry.Key,entry.Value);}
  internal string[] Tombstones{get{return (string[])tombstones.Clone();}}
  internal SortedDictionary<string,object> Values{get{return new SortedDictionary<string,object>(values,StringComparer.Ordinal);}}
 }
 readonly string path;readonly Action fence;readonly string legacyNonce;
 internal UsbExactBlockGpo(string privatePath,string nonce,Action checkCurrent,string privateLegacyNonce=null){
  if(!Regex.IsMatch(nonce??"",@"\A[0-9a-f]{32}\z")||privatePath!=@"SOFTWARE\Sentinel\ExactBlockQualification\"+nonce||checkCurrent==null)throw new InvalidOperationException("Unqualified exact-block policy location");if(privateLegacyNonce!=null&&!Regex.IsMatch(privateLegacyNonce,@"\A[0-9a-f]{32}\z"))throw new ArgumentException("Invalid private baseline");path=privatePath;fence=checkCurrent;legacyNonce=privateLegacyNonce;
 }
 // The default build remains incapable of writing DeviceInstall policy.
#if SENTINEL_USB_EXACT_LIVE_REVIEWED
 internal static UsbExactBlockGpo CreateReviewedMachine(UsbExactBlockBaseline baseline,Action checkCurrent){if(baseline==null||checkCurrent==null)throw new ArgumentNullException();baseline.Check();return new UsbExactBlockGpo(baseline,checkCurrent);}
 UsbExactBlockGpo(UsbExactBlockBaseline baseline,Action guard){path=@"SOFTWARE\Policies\Microsoft\Windows\DeviceInstall\Restrictions";legacyNonce=baseline.Nonce;fence=()=>{guard();baseline.Check();};}
#endif
 static void ValidateLegacyChildren(RegistryKey key,bool requireDeny=true){if(key.SubKeyCount>3)throw new InvalidOperationException("Foreign overlay structure");bool deny=false;foreach(string name in key.GetSubKeyNames()){if(name=="DenyInstanceIDs"){deny=true;continue;}if(name!="AllowInstanceIDs"&&name!="DenyDeviceIDs")throw new InvalidOperationException("Foreign overlay subkey");using(var neutral=key.OpenSubKey(name))if(neutral==null||neutral.ValueCount!=0||neutral.SubKeyCount!=0)throw new InvalidOperationException("Neutral legacy list changed");}if(requireDeny&&!deny)throw new InvalidOperationException("Legacy deny list missing");}
 // Group Policy may omit an empty list subkey. Presence is not authority:
 // exact values/transition union below and authenticated root flags still govern.
 internal static void ValidateLegacyOverlay(RegistryKey key,Image before,Image candidate,bool transition){
  if(key==null||before==null||candidate==null)throw new InvalidOperationException("Foreign overlay structure");ValidateLegacyChildren(key,false);var values=new SortedDictionary<string,object>(StringComparer.Ordinal);
  foreach(string name in key.GetValueNames()){if(name=="SentinelOperation"||name=="DenyInstanceIDs"||name=="DenyInstanceIDsRetroactive")continue;if(name!="SentinelExactBlockState"||key.GetValueKind(name)!=RegistryValueKind.String)throw new InvalidOperationException("Foreign overlay root value");values.Add(name,key.GetValue(name,null,RegistryValueOptions.DoNotExpandEnvironmentNames));}
  using(var list=key.OpenSubKey("DenyInstanceIDs")){if(list!=null&&(list.SubKeyCount!=0||list.ValueCount>32))throw new InvalidOperationException("Foreign overlay list");if(list!=null)foreach(string name in list.GetValueNames()){string full="DenyInstanceIDs\\"+name;object value=list.GetValue(name,null,RegistryValueOptions.DoNotExpandEnvironmentNames);if(!Name(full)||list.GetValueKind(name)!=RegistryValueKind.String||!(value is string)||!Exact((string)value))throw new InvalidOperationException("Foreign overlay subject");values.Add(full,value);}}
  before=ManagedOverlay(before);candidate=ManagedOverlay(candidate);var actual=new Image(values);if(transition)Recognizable(actual,before,candidate);else if(!Same(actual,before))throw new InvalidOperationException("Overlay baseline differs");
 }
 // This private-only mode preserves an independently authenticated legacy baseline.
 internal static Image ManagedOverlay(Image full){if(full==null)throw new ArgumentNullException("full");var values=full.Values;values.Remove("DenyInstanceIDs");values.Remove("DenyInstanceIDsRetroactive");return new Image(values,full.Tombstones);}
 internal Image Managed(Image full){return legacyNonce==null?full:ManagedOverlay(full);}
 internal static Image Empty(){return new Image(new Dictionary<string,object>());}
 internal static Image Desired(ulong generation,string digest,string[] exactTargets){
  if(generation<1||!Regex.IsMatch(digest??"",@"\A[0-9a-f]{64}\z")||exactTargets==null||exactTargets.Length>32)throw new ArgumentException("Exact policy image refused");
  if(exactTargets.Length==0)return Empty();var values=new SortedDictionary<string,object>(StringComparer.Ordinal);var seen=new HashSet<string>(StringComparer.OrdinalIgnoreCase);
  for(int i=0;i<exactTargets.Length;i++){string id=exactTargets[i];if(!Exact(id)||!seen.Add(id))throw new ArgumentException("Exact USB instance required");values.Add("DenyInstanceIDs\\"+(i+1),id);}
  values.Add("DenyInstanceIDs",1);values.Add("DenyInstanceIDsRetroactive",1);values.Add("SentinelExactBlockState","SNTEXB01:"+generation+":"+digest);return new Image(values);
 }
 static bool Exact(string id){return id!=null&&id.Length<=200&&Regex.IsMatch(id,@"\AUSB\\VID_[0-9A-Fa-f]{4}&PID_[0-9A-Fa-f]{4}[^\\*?/""<>| ]*\\[!-~]+\z")&&id.IndexOfAny(new[]{'*','?','/','"','<','>','|'})<0&&id.Split('\\').Length==3;}
 static bool Name(string key){if(key=="DenyInstanceIDs"||key=="DenyInstanceIDsRetroactive"||key=="SentinelExactBlockState")return true;if(!key.StartsWith("DenyInstanceIDs\\",StringComparison.Ordinal))return false;string suffix=key.Substring(16);int number;return int.TryParse(suffix,out number)&&number>=1&&number<=32&&number.ToString()==suffix;}
 static bool Equal(object first,object second){return first!=null&&second!=null&&first.GetType()==second.GetType()&&first.Equals(second);}
 Image Read(RegistryKey root,string path,bool saved){
  var values=new SortedDictionary<string,object>(StringComparer.Ordinal);var tombstones=new List<string>();using(var key=root.OpenSubKey(path)){
   if(key==null){if(!saved&&legacyNonce!=null)throw new InvalidOperationException("Legacy baseline missing");return Empty();}if(!saved&&legacyNonce!=null)ValidatePrivateBaseline(key);if(legacyNonce!=null)ValidateLegacyChildren(key,false);else if(key.SubKeyCount>1||Array.Exists(key.GetSubKeyNames(),name=>name!="DenyInstanceIDs"))throw new InvalidOperationException("Foreign exact policy subkey");
   foreach(string sub in new[]{"","DenyInstanceIDs"})using(var child=sub==""?null:key.OpenSubKey(sub)){
    var current=child??key;if(sub!=""&&child==null)continue;if(sub!=""&&current.SubKeyCount!=0||current.ValueCount>36)throw new InvalidOperationException("Exact policy bound");
    foreach(string name in current.GetValueNames()){
     if(sub==""&&!saved&&legacyNonce!=null&&(name=="SentinelOperation"||name=="DenyInstanceIDs"||name=="DenyInstanceIDsRetroactive"))continue;
     string plain=name.StartsWith("**Del.",StringComparison.Ordinal)?name.Substring(6):name;string full=sub==""?plain:sub+"\\"+plain;if(!Name(full))throw new InvalidOperationException("Foreign exact policy value");object value=current.GetValue(name,null,RegistryValueOptions.DoNotExpandEnvironmentNames);
     if(name!=plain){if(!saved||current.GetValueKind(name)!=RegistryValueKind.String||!(value is string)||(string)value!="")throw new InvalidOperationException("Foreign deletion value");tombstones.Add(full);continue;}
     if(sub=="DenyInstanceIDs"){if(current.GetValueKind(name)!=RegistryValueKind.String||!(value is string)||!Exact((string)value))throw new InvalidOperationException("Invalid exact deny entry");}
     else if(name=="SentinelExactBlockState"){if(current.GetValueKind(name)!=RegistryValueKind.String||!(value is string)||!Regex.IsMatch((string)value,@"\ASNTEXB01:[1-9][0-9]{0,19}:[0-9a-f]{64}\z"))throw new InvalidOperationException("Invalid exact policy owner");}
     else if(current.GetValueKind(name)!=RegistryValueKind.DWord||!(value is int)||(int)value!=1)throw new InvalidOperationException("Invalid exact policy switch");
     if(values.ContainsKey(full))throw new InvalidOperationException("Duplicate exact policy entry");values.Add(full,value);
    }
   }
  }return new Image(values,tombstones.ToArray());
 }
 void ValidatePrivateBaseline(RegistryKey key){if(key.GetValueKind("SentinelOperation")!=RegistryValueKind.String||!legacyNonce.Equals(key.GetValue("SentinelOperation")))throw new InvalidOperationException("Legacy baseline changed");foreach(string name in new[]{"DenyInstanceIDs","DenyInstanceIDsRetroactive"})if(key.GetValueKind(name)!=RegistryValueKind.DWord||!((object)1).Equals(key.GetValue(name)))throw new InvalidOperationException("Legacy switch changed");}
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
 internal void VerifyEffective(Image expected){if(!Same(Effective(),expected))throw new InvalidOperationException("Effective exact policy differs");}
 internal void DeleteEmptyPrivateProbe(){if(!path.StartsWith(@"SOFTWARE\Sentinel\ExactBlockQualification\",StringComparison.Ordinal))throw new InvalidOperationException("Private cleanup only");Verify(Empty());SentinelDuckyLocalGpo.Session(false,(root,save)=>{fence();root.DeleteSubKeyTree(path,false);save();});if(legacyNonce==null)Registry.LocalMachine.DeleteSubKeyTree(path,false);}
}
