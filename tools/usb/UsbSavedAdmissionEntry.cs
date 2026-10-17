using System;
using System.Collections.Generic;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.Win32;

// Saved-policy staging only. Default build permits disposable private probes.
// Caller supplies canonical Rust-compiled entries, a protected recovery record,
// independent recovery readiness and serialized, externally bounded execution.
public static class UsbSavedAdmissionEntry {
 public sealed class Value {
  public readonly string Key,Name;public readonly uint Kind;public readonly byte[] Data;
  public Value(string key,string name,uint kind,byte[] data){Key=key;Name=name;Kind=kind;Data=data==null?null:(byte[])data.Clone();}
 }
 public static Value[] DecodePlan(byte[] bytes){
  if(bytes==null||bytes.Length<10||bytes.Length>32768)throw new ArgumentException("Invalid compiled plan bound");
  using(var memory=new System.IO.MemoryStream(bytes,false))using(var reader=new System.IO.BinaryReader(memory)){
   if(Encoding.ASCII.GetString(reader.ReadBytes(8))!="SNTPLAN1")throw new ArgumentException("Invalid compiler schema");
   int count=reader.ReadUInt16();if(count<6||count>38)throw new ArgumentException("Invalid compiler count");var values=new Value[count];
   for(int i=0;i<count;i++){
    int keySize=reader.ReadByte(),nameSize=reader.ReadByte();uint kind=reader.ReadUInt32();int dataSize=reader.ReadUInt16();
    if(keySize>32||nameSize<1||nameSize>64||dataSize>512||memory.Length-memory.Position<keySize+nameSize+dataSize)throw new ArgumentException("Truncated compiler entry");
    byte[] key=reader.ReadBytes(keySize),name=reader.ReadBytes(nameSize),data=reader.ReadBytes(dataSize);
    foreach(byte b in key)if(b<33||b>126)throw new ArgumentException("Invalid key bytes");foreach(byte b in name)if(b<33||b>126)throw new ArgumentException("Invalid name bytes");
    values[i]=new Value(Encoding.ASCII.GetString(key),Encoding.ASCII.GetString(name),kind,data);
   }
   if(memory.Position!=memory.Length)throw new ArgumentException("Trailing compiler bytes");Validate(values);return values;
  }
 }
 static string Text(Value v){if(v.Data==null||v.Data.Length<2||v.Data.Length>512||v.Data.Length%2!=0)throw new ArgumentException("Invalid text");string text=new UnicodeEncoding(false,false,true).GetString(v.Data);if(!text.EndsWith("\0")||text.Substring(0,text.Length-1).IndexOf('\0')>=0)throw new ArgumentException("Invalid terminator");return text.Substring(0,text.Length-1);}
 static void Validate(Value[] values){
  if(values==null||values.Length<6||values.Length>38)throw new ArgumentException("Invalid plan size");
  bool usb=Array.Exists(values,v=>v!=null&&v.Key=="DenyDeviceIDs");var seen=new HashSet<string>(StringComparer.OrdinalIgnoreCase);int allow=0,deny=0,flags=0;var instances=new HashSet<string>(StringComparer.OrdinalIgnoreCase);
  foreach(var value in values){
   if(value==null||value.Key==null||value.Name==null||value.Data==null||!seen.Add(value.Key+"\\"+value.Name))throw new ArgumentException("Duplicate or missing value");
   if(value.Key==""&&value.Kind==4){if(value.Name!="AllowDenyLayered"&&value.Name!="AllowInstanceIDs"&&value.Name!=(usb?"DenyDeviceIDsRetroactive":"DenyDeviceClassesRetroactive")&&value.Name!=(usb?"DenyDeviceIDs":"DenyDeviceClasses"))throw new ArgumentException("Unexpected switch");if(value.Data.Length!=4||BitConverter.ToUInt32(value.Data,0)!=1)throw new ArgumentException("Invalid switch");flags++;}
   else if(value.Key=="AllowInstanceIDs"&&value.Kind==1){int index;if(!int.TryParse(value.Name,out index)||index<1||index>32||index.ToString()!=value.Name)throw new ArgumentException("Invalid allow index");string id=Text(value);if(id.Length>200||!Regex.IsMatch(id,@"\A[!-~]+\z")||id.IndexOfAny(new[]{'*','?','/','\"','<','>','|'})>=0||id.Split('\\').Length!=3)throw new ArgumentException("Invalid exact instance");foreach(string part in id.Split('\\'))if(part.Length==0)throw new ArgumentException("Invalid exact instance");if(!instances.Add(id))throw new ArgumentException("Duplicate instance");allow++;}
   else if(!usb&&value.Key=="DenyDeviceClasses"&&value.Kind==1){string cls=Text(value);if((value.Name!="1"||cls!="{4d36e96b-e325-11ce-bfc1-08002be10318}")&&(value.Name!="2"||cls!="{4d36e96f-e325-11ce-bfc1-08002be10318}"))throw new ArgumentException("Unexpected denied class");deny++;}
   else if(usb&&value.Key=="DenyDeviceIDs"&&value.Kind==1&&value.Name=="1"&&Text(value)==@"USB\Class_03"){deny++;}
   else throw new ArgumentException("Unexpected policy value");
  }
  if(flags!=4||deny!=(usb?1:2)||allow<1)throw new ArgumentException("Incomplete policy plan");
  for(int i=1;i<=allow;i++)if(!seen.Contains("AllowInstanceIDs\\"+i))throw new ArgumentException("Sparse allowlist");
 }
 static void Owned(RegistryKey root,string path,string nonce,Value[] values){
  using(var key=root.OpenSubKey(path)){
   if(key==null)return;
   if(key.GetValueKind("SentinelAdmissionOperation")!=RegistryValueKind.String||(string)key.GetValue("SentinelAdmissionOperation")!=nonce)throw new InvalidOperationException("Unowned saved input policy");
   foreach(string sub in key.GetSubKeyNames())if(sub!="AllowInstanceIDs"&&sub!="DenyDeviceClasses"&&sub!="DenyDeviceIDs")throw new InvalidOperationException("Foreign policy subkey");
   foreach(string sub in new[]{"","AllowInstanceIDs","DenyDeviceClasses","DenyDeviceIDs"})using(var child=sub==""?null:key.OpenSubKey(sub)){
    var current=child??key;if(sub!=""&&child==null)continue;if(sub!=""&&current.SubKeyCount!=0)throw new InvalidOperationException("Nested policy drift");
    foreach(string name in current.GetValueNames()){
     if(sub==""&&name=="SentinelAdmissionOperation")continue;
     string original=name.StartsWith("**Del.",StringComparison.Ordinal)?name.Substring(6):name;
     Value expected=Array.Find(values,v=>v.Key==sub&&v.Name==original);if(expected==null)throw new InvalidOperationException("Foreign policy value");
     var kind=current.GetValueKind(name);object actual=current.GetValue(name);
     if(name!=original){if(kind!=RegistryValueKind.String||(string)actual!="")throw new InvalidOperationException("Invalid deletion instruction");}
     else if(expected.Kind==4){if(kind!=RegistryValueKind.DWord||(int)actual!=1)throw new InvalidOperationException("Policy switch drift");}
     else if(kind!=RegistryValueKind.String||(string)actual!=Text(expected))throw new InvalidOperationException("Policy list drift");
    }
   }
  }
 }
 public static void Edit(RegistryKey root,string path,string nonce,Value[] values,bool hold,Action save,Action checkCurrent,int fail){
  if(root==null||save==null||checkCurrent==null||!Regex.IsMatch(nonce??"",@"\A[0-9a-f]{32}\z")||fail<0)throw new ArgumentException("Invalid edit");
  if(path!=@"SOFTWARE\Sentinel\UsbAdmissionProbe\"+nonce)throw new InvalidOperationException("Live general policy is not enabled");
  if(values==null)throw new ArgumentException("Missing values");values=Array.ConvertAll(values,v=>v==null?null:new Value(v.Key,v.Name,v.Kind,v.Data));
  Validate(values);checkCurrent();Owned(root,path,nonce,values);
  using(var existing=root.OpenSubKey(path))if(existing==null&&!hold)return;
  using(var key=root.CreateSubKey(path)){
   key.SetValue("SentinelAdmissionOperation",nonce,RegistryValueKind.String);
   for(int n=0;n<values.Length;n++){
    int index=hold?n:values.Length-1-n;var value=values[index];
    using(var child=value.Key==""?null:key.CreateSubKey(value.Key)){
     var current=child??key;
     if(hold){current.DeleteValue("**Del."+value.Name,false);if(value.Kind==4)current.SetValue(value.Name,1,RegistryValueKind.DWord);else current.SetValue(value.Name,Text(value),RegistryValueKind.String);}
     else {current.DeleteValue(value.Name,false);current.SetValue("**Del."+value.Name,"",RegistryValueKind.String);}
     current.Flush();
    }
    if(fail==n+1)throw new InvalidOperationException("Injected admission edit failure");
   }
   checkCurrent();save();
  }
 }
}
