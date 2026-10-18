using System;
using System.IO;
using System.Text;
using System.Reflection;
using System.Security.Cryptography;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Text.RegularExpressions;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Web.Script.Serialization;
using Microsoft.Win32;

// Read-only authenticated preservation lease. Never edits legacy policy or tasks.
internal static class UsbLegacyReleasedBaseline {
 const string Policy=@"SOFTWARE\Policies\Microsoft\Windows\DeviceInstall\Restrictions";
 [DllImport("advapi32.dll",CharSet=CharSet.Unicode)]static extern int RegQueryValueEx(IntPtr key,string name,IntPtr reserved,out int type,byte[] bytes,ref int size);
 static void Raw(RegistryKey key,string name,int kind,byte[] expected){int type,size=1024;byte[] bytes=new byte[size];Require(RegQueryValueEx(key.Handle.DangerousGetHandle(),name,IntPtr.Zero,out type,bytes,ref size)==0&&type==kind&&size==expected.Length);for(int i=0;i<size;i++)Require(bytes[i]==expected[i]);}
 static void Require(bool value){if(!value)throw new InvalidOperationException("Legacy migration refused.");}
 static void Check(int code){if(code!=0)throw new System.ComponentModel.Win32Exception(code,"Legacy registry transaction refused.");}
 static bool Trusted(string sid){return sid=="S-1-5-18"||sid=="S-1-5-32-544"||sid=="S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464";}
 static void DirectoryAcl(string path,bool final){var acl=Directory.GetAccessControl(path);Require(Trusted(acl.GetOwner(typeof(SecurityIdentifier)).Value));if(final)Require(acl.AreAccessRulesProtected);foreach(FileSystemAccessRule rule in acl.GetAccessRules(true,true,typeof(SecurityIdentifier))){if(rule.AccessControlType!=AccessControlType.Allow||Trusted(rule.IdentityReference.Value)||(rule.PropagationFlags&PropagationFlags.InheritOnly)!=0)continue;Require(!final&&(rule.FileSystemRights&(FileSystemRights.DeleteSubdirectoriesAndFiles|FileSystemRights.ChangePermissions|FileSystemRights.TakeOwnership|FileSystemRights.Delete))==0);}}
 static void FileAcl(FileStream stream){var acl=stream.GetAccessControl();Require(Trusted(acl.GetOwner(typeof(SecurityIdentifier)).Value));foreach(FileSystemAccessRule rule in acl.GetAccessRules(true,true,typeof(SecurityIdentifier)))if(rule.AccessControlType==AccessControlType.Allow&&!Trusted(rule.IdentityReference.Value))Require((rule.FileSystemRights&(FileSystemRights.Write|FileSystemRights.Delete|FileSystemRights.ChangePermissions|FileSystemRights.TakeOwnership))==0);}
 static Dictionary<string,object> Read(string path,List<IDisposable> held){Require(File.Exists(path)&&(File.GetAttributes(path)&FileAttributes.ReparsePoint)==0);var stream=new FileStream(path,FileMode.Open,FileAccess.Read,FileShare.Read);held.Add(stream);FileAcl(stream);Require(stream.Length>0&&stream.Length<=8192);var bytes=new byte[(int)stream.Length];int offset=0;while(offset<bytes.Length){int count=stream.Read(bytes,offset,bytes.Length-offset);Require(count>0);offset+=count;}return new JavaScriptSerializer{MaxJsonLength=8192,RecursionLimit=8}.Deserialize<Dictionary<string,object>>(new UTF8Encoding(false,true).GetString(bytes));}
 static void Fields(Dictionary<string,object> value,string[] names){Require(value!=null&&value.Count==names.Length);foreach(string name in names)Require(value.ContainsKey(name));}
 static DateTime Deadline(Dictionary<string,object> value){DateTime result;Require(DateTime.TryParse(value["deadline"] as string,System.Globalization.CultureInfo.InvariantCulture,System.Globalization.DateTimeStyles.RoundtripKind,out result)&&result.Kind==DateTimeKind.Utc&&result<DateTime.UtcNow);return result;}
 static string Hash(string value){using(var hash=SHA256.Create())return BitConverter.ToString(hash.ComputeHash(Encoding.UTF8.GetBytes(value))).Replace("-","").ToLowerInvariant();}
 static bool KnownSource(string expected){if(!Regex.IsMatch(expected??"",@"\A[0-9a-f]{64}\z"))return false;foreach(string name in Assembly.GetExecutingAssembly().GetManifestResourceNames())if(name.StartsWith("Sentinel.LegacySource.",StringComparison.Ordinal))using(var reader=new StreamReader(Assembly.GetExecutingAssembly().GetManifestResourceStream(name))){string body=reader.ReadToEnd(),lf=body.Replace("\r\n","\n");foreach(string variant in new[]{body,lf,lf.Replace("\n","\r\n")})if(Hash("#define SENTINEL_DUCKY_POLICY_LAB\n"+variant)==expected)return true;}return false;}
 static void TasksAbsent(string[] names){
  dynamic service=null,folder=null,running=null;try{
   service=Activator.CreateInstance(Type.GetTypeFromProgID("Schedule.Service",true));service.Connect();folder=service.GetFolder("\\");
   foreach(string name in names){bool absent=false;try{object task=folder.GetTask(name);if(task!=null&&Marshal.IsComObject(task))Marshal.FinalReleaseComObject(task);}catch(Exception error){if(error.HResult==unchecked((int)0x80070002))absent=true;else throw;}Require(absent);}
   running=service.GetRunningTasks(1);Require((int)running.Count<=4096);foreach(dynamic task in running){string path=task.Path as string;Require(path!=null&&path.Length<=1024);foreach(string name in names)Require(!path.Equals("\\"+name,StringComparison.OrdinalIgnoreCase));}
  }finally{if(running!=null&&Marshal.IsComObject(running))Marshal.FinalReleaseComObject(running);if(folder!=null&&Marshal.IsComObject(folder))Marshal.FinalReleaseComObject(folder);if(service!=null&&Marshal.IsComObject(service))Marshal.FinalReleaseComObject(service);}
 }
 static int KnownWriters(){int count=0;foreach(string name in new[]{"powershell","gpupdate","Sentinel.DuckyPolicy"}){Process[] processes=Process.GetProcessesByName(name);try{count+=processes.Length;Require(count<=1024);}finally{foreach(var process in processes)process.Dispose();}}return count;}

 internal sealed class Lease:IDisposable {
  internal readonly string Nonce, ReceiptDigest; readonly string target; readonly string[] tasks;
  readonly List<IDisposable> held;readonly Action<RegistryKey> overlayValidator; bool disposed;
  internal Lease(string n,string t,string digest,string[] names,List<IDisposable> pins,Action<RegistryKey> validator){Nonce=n;target=t;ReceiptDigest=digest;tasks=names;held=pins;overlayValidator=validator;}
  internal byte[] Binding { get { return Encoding.ASCII.GetBytes("SNTLEG02"+Nonce+ReceiptDigest); } }
  internal void Check(){Require(!disposed);string t,n;Require(DuckyPolicyEnrollment.Read(out t,out n)&&n==Nonce&&t==target);TasksAbsent(tasks);using(var root=Registry.LocalMachine.OpenSubKey(Policy))ValidateForLease(root,Nonce,overlayValidator);}
  public void Dispose(){if(disposed)return;disposed=true;for(int i=held.Count-1;i>=0;i--)held[i].Dispose();}
 }
 internal static Lease Acquire(byte[] expectedBinding){return AcquireCore(expectedBinding,null);}
 // Only a fixed trusted native exact-policy provider may supply this readonly
 // validator. An existing authenticated binding is mandatory; no capture path.
 internal static Lease AcquireForExactOverlay(byte[] expectedBinding,Action<RegistryKey> validateOwnedOverlay){
  Require(expectedBinding!=null&&expectedBinding.Length==104&&validateOwnedOverlay!=null);byte[] copy=(byte[])expectedBinding.Clone();Require(Encoding.ASCII.GetString(copy,0,8)=="SNTLEG02");return AcquireCore(copy,validateOwnedOverlay);
 }
 static void MatchBinding(Lease lease,byte[] expectedBinding){byte[] binding=lease.Binding;Require(expectedBinding!=null&&binding.Length==expectedBinding.Length);int mismatch=0;for(int i=0;i<binding.Length;i++)mismatch|=binding[i]^expectedBinding[i];Require(mismatch==0);}
 static Lease AcquireCore(byte[] expectedBinding,Action<RegistryKey> overlayValidator){
  var held=new List<IDisposable>();try{
   string target,nonce;Require(DuckyPolicyEnrollment.Read(out target,out nonce));
   string directory=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),"SentinelDuckyPolicy");var ancestry=new List<string>();for(var cursor=new DirectoryInfo(directory);cursor!=null;cursor=cursor.Parent)ancestry.Insert(0,cursor.FullName);
   foreach(string path in ancestry){held.Add(new SentinelPolicyDirectory(path));DirectoryAcl(path,path==directory);}string lockPath=Path.Combine(directory,".lock");Require(File.Exists(lockPath)&&(File.GetAttributes(lockPath)&FileAttributes.ReparsePoint)==0);var legacyLock=new FileStream(lockPath,FileMode.Open,FileAccess.ReadWrite,FileShare.None);held.Add(legacyLock);FileAcl(legacyLock);
   var trial=Read(Path.Combine(directory,"trial.json"),held);var desktop=Read(Path.Combine(directory,"desktop-trial.json"),held);Fields(trial,new[]{"target","nonce","deadline","task","priorState","sourceHash"});Fields(desktop,new[]{"target","nonce","task","retiringTask","deadline","engine"});
   Require(trial["target"] as string==target&&trial["nonce"] as string==nonce&&desktop["target"] as string==target&&desktop["nonce"] as string==nonce&&trial["priorState"] as string=="namespace_absent"&&desktop["engine"] as string=="profiled-ducky-v1"&&KnownSource(trial["sourceHash"] as string));
   DateTime first=Deadline(trial),last=Deadline(desktop);if(first>last)last=first;// Boot time is not writer-quiescence proof; exact locks/task absence govern.
   string initial=trial["task"] as string,current=desktop["task"] as string,retiring=desktop["retiringTask"] as string;Require(initial=="Sentinel-Ducky-Policy-Recovery-"+nonce&&Regex.IsMatch(current??"",@"\ASentinel-Ducky-App-Recovery-"+nonce+@"-[0-9a-f]{32}\z")&&(retiring==null||Regex.IsMatch(retiring,@"\ASentinel-Ducky-App-Recovery-"+nonce+@"-[0-9a-f]{32}\z")));
   var names=new List<string>{initial,current};if(retiring!=null&&!names.Contains(retiring))names.Add(retiring);
   // Pinned read streams prevent receipt replacement for the complete lease.
   var serializer=new JavaScriptSerializer();string digest=Hash(serializer.Serialize(trial)+"\n"+serializer.Serialize(desktop));
   var result=new Lease(nonce,target,digest,names.ToArray(),held,overlayValidator);if(overlayValidator!=null)MatchBinding(result,expectedBinding);result.Check();if(expectedBinding==null){
    // Retirement proof occurs only before initial protected sidecar creation.
    // Old encoded recovery does not acquire .lock: require no outstanding
    // legacy task or known writer here, while normal host writers are excluded
    // by the held lock. Recovery later authenticates this v2 retirement binding
    // and must never depend on unrelated terminal/process names being absent.
    ValidateReleasedValues(Registry.LocalMachine,Policy,nonce);TasksAbsent(names.ToArray());Require(KnownWriters()==0);TasksAbsent(names.ToArray());
   }
   if(expectedBinding!=null&&overlayValidator==null)MatchBinding(result,expectedBinding);
   return result;
  }catch{for(int i=held.Count-1;i>=0;i--)held[i].Dispose();throw;}
 }
 internal static void ValidateReleasedValues(RegistryKey root,string path,string nonce){
  Require(path==Policy);using(var key=root.OpenSubKey(path)){
   Require(key!=null&&key.ValueCount==3&&key.SubKeyCount==1);ValidatePreservedValues(key,nonce);
  }
 }
 // Caller still MUST validate every overlay value/key independently.
 internal static void ValidateForLease(RegistryKey readonlyKey,string nonce,Action<RegistryKey> validateOwnedOverlay){
  if(validateOwnedOverlay==null){ValidatePreservedValues(readonlyKey,nonce);return;}
  ValidateLegacyFlags(readonlyKey,nonce);validateOwnedOverlay(readonlyKey);ValidateLegacyFlags(readonlyKey,nonce);
 }
 internal static void ValidatePreservedValues(RegistryKey key,string nonce){
  ValidateLegacyFlags(key,nonce);using(var list=key.OpenSubKey("DenyInstanceIDs"))Require(list!=null&&list.ValueCount==0&&list.SubKeyCount==0);
 }
 static void ValidateLegacyFlags(RegistryKey key,string nonce){
  Require(Regex.IsMatch(nonce??"",@"\A[0-9a-f]{32}\z"));
  Require(key!=null&&key.GetValueKind("SentinelOperation")==RegistryValueKind.String&&key.GetValue("SentinelOperation",null) as string==nonce&&key.GetValueKind("DenyInstanceIDs")==RegistryValueKind.DWord&&key.GetValue("DenyInstanceIDs",null) is int&&(int)key.GetValue("DenyInstanceIDs")==1&&key.GetValueKind("DenyInstanceIDsRetroactive")==RegistryValueKind.DWord&&key.GetValue("DenyInstanceIDsRetroactive",null) is int&&(int)key.GetValue("DenyInstanceIDsRetroactive")==1);
  Raw(key,"SentinelOperation",1,Encoding.Unicode.GetBytes(nonce+"\0"));Raw(key,"DenyInstanceIDs",4,BitConverter.GetBytes(1));Raw(key,"DenyInstanceIDsRetroactive",4,BitConverter.GetBytes(1));
 }
}
