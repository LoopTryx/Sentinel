using System;
using System.IO;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using Microsoft.Win32;
using Microsoft.Win32.SafeHandles;

// Not referenced by the installed helper yet. Default builds accept private probes only.
public static class SentinelDuckyGpoEntry {
 const string Live=@"SOFTWARE\Policies\Microsoft\Windows\DeviceInstall\Restrictions";
 static void Validate(string path,string target,string nonce){
  if(!Regex.IsMatch(nonce??"",@"\A[0-9a-f]{32}\z")||!Regex.IsMatch(target??"",@"\AUSB\\VID_[0-9A-Fa-f]{4}&PID_[0-9A-Fa-f]{4}\\[A-Za-z0-9&_.-]{1,160}\z"))throw new ArgumentException("Invalid exact enrollment");
  bool permitted=path==@"SOFTWARE\Sentinel\DuckyGpoProbe\"+nonce;
#if SENTINEL_DUCKY_GPO_LAB
  permitted=permitted||path==Live;
#endif
  if(!permitted)throw new InvalidOperationException("Saved device policy is not qualified");
 }
 static void Fault(int fail,int stage){if(fail==stage)throw new InvalidOperationException("Injected saved edit failure");}
 static void Owned(RegistryKey key,string nonce,string target){
  foreach(string name in key.GetValueNames()){
   if(name=="SentinelOperation"){if(key.GetValueKind(name)!=RegistryValueKind.String||(string)key.GetValue(name)!=nonce)throw new InvalidOperationException("Saved policy ownership changed");}
   else if(name=="DenyInstanceIDs"||name=="DenyInstanceIDsRetroactive"){if(key.GetValueKind(name)!=RegistryValueKind.DWord||(int)key.GetValue(name)!=1)throw new InvalidOperationException("Saved flags changed");}
   else throw new InvalidOperationException("Foreign saved policy value");
  }
  if(key.GetValue("SentinelOperation",null)==null)throw new InvalidOperationException("Unowned saved policy");
  foreach(string name in key.GetSubKeyNames())if(name!="DenyInstanceIDs")throw new InvalidOperationException("Foreign saved policy subkey");
  using(var list=key.OpenSubKey("DenyInstanceIDs")){
   if(list==null)return;
   if(list.SubKeyCount!=0||list.ValueCount>1)throw new InvalidOperationException("Foreign saved list");
   foreach(string name in list.GetValueNames()){
    if(list.GetValueKind(name)!=RegistryValueKind.String)throw new InvalidOperationException("Saved target type changed");
    string value=(string)list.GetValue(name);
    if(name=="1"&&value==target)continue;
    if(name=="**Del.1"&&value=="")continue;
    throw new InvalidOperationException("Foreign saved target");
   }
  }
 }
 // save persists the edited GPO, not the effective HKLM key. Throwing save is uncertain.
 public static void Edit(RegistryKey root,string path,string target,string nonce,bool hold,Action save,Action checkCurrent,int fail){
  Validate(path,target,nonce);if(root==null||save==null||checkCurrent==null||fail<0||fail>5)throw new ArgumentException("Invalid saved edit");
  checkCurrent();
  using(var existing=root.OpenSubKey(path)){
   if(existing==null&&!hold)return;
   if(existing!=null)Owned(existing,nonce,target);
  }
  using(var key=root.CreateSubKey(path)){
   key.SetValue("SentinelOperation",nonce,RegistryValueKind.String);Fault(fail,1);
   key.SetValue("DenyInstanceIDsRetroactive",1,RegistryValueKind.DWord);Fault(fail,2);
   key.SetValue("DenyInstanceIDs",1,RegistryValueKind.DWord);Fault(fail,3);
   using(var list=key.CreateSubKey("DenyInstanceIDs")){
    if(hold){list.DeleteValue("**Del.1",false);list.SetValue("1",target,RegistryValueKind.String);}
    else {list.DeleteValue("1",false);list.SetValue("**Del.1","",RegistryValueKind.String);}
    list.Flush();Fault(fail,4);
   }
   key.Flush();checkCurrent();Fault(fail,5);save();
  }
 }
}

// One COM instance, one STA thread, no registry.pol byte rewriting.
public static class SentinelDuckyLocalGpo {
 [ComImport,Guid("EA502723-A23D-11D1-A7D3-0000F87571E3"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
 interface IGpo {
  void New([MarshalAs(UnmanagedType.LPWStr)]string domain,[MarshalAs(UnmanagedType.LPWStr)]string display,uint flags);
  void OpenDSGPO([MarshalAs(UnmanagedType.LPWStr)]string path,uint flags);
  void OpenLocalMachineGPO(uint flags);
  void OpenRemoteMachineGPO([MarshalAs(UnmanagedType.LPWStr)]string computer,uint flags);
  void Save([MarshalAs(UnmanagedType.Bool)]bool machine,[MarshalAs(UnmanagedType.Bool)]bool add,ref Guid extension,ref Guid app);
  void Delete();
  void GetName([MarshalAs(UnmanagedType.LPWStr)]StringBuilder name,int max);
  void GetDisplayName([MarshalAs(UnmanagedType.LPWStr)]StringBuilder name,int max);
  void SetDisplayName([MarshalAs(UnmanagedType.LPWStr)]string name);
  void GetPath([MarshalAs(UnmanagedType.LPWStr)]StringBuilder path,int max);
  void GetDSPath(uint section,[MarshalAs(UnmanagedType.LPWStr)]StringBuilder path,int max);
  void GetFileSysPath(uint section,[MarshalAs(UnmanagedType.LPWStr)]StringBuilder path,int max);
  void GetRegistryKey(uint section,out IntPtr key);
 }
 static string Fingerprint(string path){
  if(!File.Exists(path))return "absent";
  using(var file=new FileStream(path,FileMode.Open,FileAccess.Read,FileShare.ReadWrite|FileShare.Delete)){
   if(file.Length>2097152)throw new InvalidOperationException("Policy file exceeds bound");
   using(var hash=SHA256.Create())return Convert.ToBase64String(hash.ComputeHash(file));
  }
 }
 static void Sta(Action action){Exception failure=null;var thread=new Thread(()=>{try{action();}catch(Exception e){failure=e;}});thread.SetApartmentState(ApartmentState.STA);thread.Start();thread.Join();if(failure!=null)throw new InvalidOperationException("Local policy operation failed",failure);}
 static void Session(bool readOnly,Action<RegistryKey,Action> action){
  Sta(()=>{
   using(var mutex=new Mutex(false,@"Global\SentinelDuckyLocalGpo")){
   bool acquired=false;
   try{
   try{acquired=mutex.WaitOne(10000);}catch(AbandonedMutexException){acquired=true;}
   if(!acquired)throw new InvalidOperationException("Another saved policy session is active");
   string file=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),@"GroupPolicy\Machine\Registry.pol");string before=Fingerprint(file);
   object instance=null;RegistryKey root=null;
   try{
    instance=Activator.CreateInstance(Type.GetTypeFromCLSID(new Guid("EA502722-A23D-11D1-A7D3-0000F87571E3")));
    var gpo=(IGpo)instance;gpo.OpenLocalMachineGPO(readOnly?3u:1u);
    IntPtr handle;gpo.GetRegistryKey(2,out handle);if(handle==IntPtr.Zero)throw new InvalidOperationException("Missing machine policy handle");
    root=RegistryKey.FromHandle(new SafeRegistryHandle(handle,true),RegistryView.Default);
    Action check=()=>{if(Fingerprint(file)!=before)throw new InvalidOperationException("Local policy changed concurrently; save refused");};check();
    Action save=()=>{
     if(readOnly)throw new InvalidOperationException("Read-only session");
     check();Guid extension=new Guid("35378EAC-683F-11D2-A89A-00C04FBBCFA2"),app=new Guid("7F8622F9-8153-4C66-B863-83A84CA65852");gpo.Save(true,true,ref extension,ref app);
    };
    action(root,save);
   }finally{if(root!=null)root.Dispose();if(instance!=null&&Marshal.IsComObject(instance))Marshal.FinalReleaseComObject(instance);}
   }finally{if(acquired)mutex.ReleaseMutex();}
   }
  });
 }
 static string Digest(RegistryKey root,string excluded){
  var values=new SortedDictionary<string,string>(StringComparer.Ordinal);
  var paths=new Queue<string>();paths.Enqueue("");int keys=0,total=0;
  while(paths.Count>0){
   string path=paths.Dequeue();if(path.Equals(excluded,StringComparison.OrdinalIgnoreCase)||path.StartsWith(excluded+"\\",StringComparison.OrdinalIgnoreCase))continue;
   if(++keys>2048||path.Length>2048)throw new InvalidOperationException("Policy snapshot exceeds bound");
   using(var key=path==""?null:root.OpenSubKey(path)){
    RegistryKey current=key??root;
    // Ignore only the probe's potentially new empty ancestors. Values on those
    // ancestors and all unrelated empty-key existence remain in the digest.
    if(path!=""&&!excluded.StartsWith(path+"\\",StringComparison.OrdinalIgnoreCase))values.Add("K:"+path,"");
    foreach(string child in current.GetSubKeyNames())paths.Enqueue(path==""?child:path+"\\"+child);
    foreach(string name in current.GetValueNames()){
     object value=current.GetValue(name,null,RegistryValueOptions.DoNotExpandEnvironmentNames);
     string data=value is byte[]?Convert.ToBase64String((byte[])value):value is string[]?string.Join("\0",(string[])value):Convert.ToString(value,System.Globalization.CultureInfo.InvariantCulture);
     string row=((int)current.GetValueKind(name)).ToString()+":"+Convert.ToBase64String(Encoding.UTF8.GetBytes(data));
     total+=row.Length+path.Length+name.Length;if(total>2097152)throw new InvalidOperationException("Policy values exceed bound");
     values.Add("V:"+path+"\0"+name,row);
    }
   }
  }
  var text=new StringBuilder();foreach(var pair in values)text.Append(pair.Key.Length).Append(':').Append(pair.Key).Append(pair.Value.Length).Append(':').Append(pair.Value);
  using(var hash=SHA256.Create())return Convert.ToBase64String(hash.ComputeHash(Encoding.UTF8.GetBytes(text.ToString())));
 }
 public static string PrivateProbeState(string nonce,out string unrelatedDigest){
  if(!Regex.IsMatch(nonce??"",@"\A[0-9a-f]{32}\z"))throw new ArgumentException("Invalid probe nonce");
  string state="missing",digest=null,path=@"SOFTWARE\Sentinel\DuckyGpoProbe\"+nonce;
  Session(true,(root,save)=>{
   digest=Digest(root,path);
   using(var key=root.OpenSubKey(path+@"\DenyInstanceIDs")){
    if(key!=null)state=key.GetValue("1",null) as string==@"USB\VID_0001&PID_0001\PRIVATE-PROBE"?"armed":key.GetValue("**Del.1",null) as string==""?"released":"unexpected";
   }
  });unrelatedDigest=digest;return state;
 }
 public static bool ReadOnlyProbe(){bool result=false;Session(true,(root,save)=>{result=root!=null;});return result;}
 // No live-device entry point. Native qualification is restricted to this private path.
 public static void EditPrivateProbe(string nonce,bool hold){
  if(!Regex.IsMatch(nonce??"",@"\A[0-9a-f]{32}\z"))throw new ArgumentException("Invalid probe nonce");
  Session(false,(root,save)=>SentinelDuckyGpoEntry.Edit(root,@"SOFTWARE\Sentinel\DuckyGpoProbe\"+nonce,@"USB\VID_0001&PID_0001\PRIVATE-PROBE",nonce,hold,save,()=>{},0));
 }
 public static void PrivateUncertainSaveProbe(string nonce){
  if(!Regex.IsMatch(nonce??"",@"\A[0-9a-f]{32}\z"))throw new ArgumentException("Invalid probe nonce");
  Session(false,(root,save)=>SentinelDuckyGpoEntry.Edit(root,@"SOFTWARE\Sentinel\DuckyGpoProbe\"+nonce,@"USB\VID_0001&PID_0001\PRIVATE-PROBE",nonce,true,()=>{save();throw new InvalidOperationException("Injected after real saved policy commit");},()=>{},0));
 }
 public static void EditEnrolled(string target,string nonce,bool hold){
#if SENTINEL_DUCKY_GPO_LAB
  Session(false,(root,save)=>SentinelDuckyGpoEntry.Edit(root,@"SOFTWARE\Policies\Microsoft\Windows\DeviceInstall\Restrictions",target,nonce,hold,save,()=>{},0));
#else
  throw new InvalidOperationException("Saved device policy is not qualified");
#endif
 }
}
