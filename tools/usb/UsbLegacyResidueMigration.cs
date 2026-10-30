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

// Fixed native migration for the exact authenticated legacy RELEASED residue.
// No task execution/removal, no process killing, no encoded recovery invocation.
internal static class UsbLegacyResidueMigration {
 const string Policy=@"SOFTWARE\Policies\Microsoft\Windows\DeviceInstall\Restrictions";
 const string Evidence=@"SOFTWARE\Sentinel\UsbLegacyResidueMigration";
 const int Access=0x2001f|0x100;
 [DllImport("KtmW32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern IntPtr CreateTransaction(IntPtr a,IntPtr b,int c,int d,int e,int timeout,string description);
 [DllImport("KtmW32.dll",SetLastError=true)]static extern bool CommitTransaction(IntPtr transaction);
 [DllImport("KtmW32.dll",SetLastError=true)]static extern bool RollbackTransaction(IntPtr transaction);
 [DllImport("kernel32.dll")]static extern bool CloseHandle(IntPtr handle);
 [DllImport("kernel32.dll")]static extern ulong GetTickCount64();
 [DllImport("advapi32.dll",CharSet=CharSet.Unicode)]static extern int RegOpenKeyTransacted(IntPtr root,string path,int options,int access,out IntPtr key,IntPtr tx,IntPtr extended);
 [DllImport("advapi32.dll",CharSet=CharSet.Unicode)]static extern int RegOpenKeyEx(IntPtr root,string path,int options,int access,out IntPtr key);
 [DllImport("advapi32.dll",CharSet=CharSet.Unicode)]static extern int RegDeleteKeyTransacted(IntPtr root,string path,int view,int reserved,IntPtr tx,IntPtr extended);
 [DllImport("advapi32.dll",CharSet=CharSet.Unicode)]static extern int RegDeleteValue(IntPtr key,string name);
 [DllImport("advapi32.dll",CharSet=CharSet.Unicode)]static extern int RegQueryValueEx(IntPtr key,string name,IntPtr reserved,out int type,byte[] bytes,ref int size);
 [DllImport("advapi32.dll",CharSet=CharSet.Unicode)]static extern int RegQueryInfoKey(IntPtr key,IntPtr cls,IntPtr clsLength,IntPtr reserved,out int subkeys,IntPtr maxSubkey,IntPtr maxClass,out int values,IntPtr maxName,IntPtr maxValue,IntPtr security,IntPtr time);
 [DllImport("advapi32.dll")]static extern int RegCloseKey(IntPtr key);
 static int stage;static bool eligible,removed=false;static int beforeWriters,beforeCommitWriters=0;
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
 static void ReleasedEffective(string nonce){using(var key=Registry.LocalMachine.OpenSubKey(Policy)){
  Require(key!=null&&key.ValueCount==3&&key.SubKeyCount==1&&key.GetValueKind("SentinelOperation")==RegistryValueKind.String&&key.GetValue("SentinelOperation",null) as string==nonce&&key.GetValueKind("DenyInstanceIDs")==RegistryValueKind.DWord&&key.GetValue("DenyInstanceIDs",null) is int&&(int)key.GetValue("DenyInstanceIDs")==1&&key.GetValueKind("DenyInstanceIDsRetroactive")==RegistryValueKind.DWord&&key.GetValue("DenyInstanceIDsRetroactive",null) is int&&(int)key.GetValue("DenyInstanceIDsRetroactive")==1);
  using(var list=key.OpenSubKey("DenyInstanceIDs"))Require(list!=null&&list.ValueCount==0&&list.SubKeyCount==0);
 }}
 static void Count(IntPtr key,int children,int values){int actualChildren,actualValues;Check(RegQueryInfoKey(key,IntPtr.Zero,IntPtr.Zero,IntPtr.Zero,out actualChildren,IntPtr.Zero,IntPtr.Zero,out actualValues,IntPtr.Zero,IntPtr.Zero,IntPtr.Zero,IntPtr.Zero));Require(actualChildren==children&&actualValues==values);}
 static void Value(IntPtr key,string name,int kind,byte[] expected){byte[] actual=new byte[1024];int type,length=actual.Length;Check(RegQueryValueEx(key,name,IntPtr.Zero,out type,actual,ref length));Require(type==kind&&length==expected.Length);for(int i=0;i<length;i++)Require(actual[i]==expected[i]);}
 static void NotLink(IntPtr hive,string path){IntPtr key;Check(RegOpenKeyEx(hive,path,8,0x20019|0x100,out key));try{int type,length=0;Require(RegQueryValueEx(key,"SymbolicLinkValue",IntPtr.Zero,out type,null,ref length)==2);}finally{RegCloseKey(key);}}
 static void Cleanup(IntPtr hive,string path,string nonce,Action beforeCommit,int fail){
  Require(Regex.IsMatch(nonce??"",@"\A[0-9a-f]{32}\z"));NotLink(hive,path);NotLink(hive,path+"\\DenyInstanceIDs");IntPtr transaction=CreateTransaction(IntPtr.Zero,IntPtr.Zero,0,0,0,30000,"Sentinel released residue cleanup"),key=IntPtr.Zero,list=IntPtr.Zero;Require(transaction!=IntPtr.Zero&&transaction!=new IntPtr(-1));
  try{
   Check(RegOpenKeyTransacted(hive,path,0,Access,out key,transaction,IntPtr.Zero));Count(key,1,3);Value(key,"SentinelOperation",1,Encoding.Unicode.GetBytes(nonce+"\0"));Value(key,"DenyInstanceIDs",4,BitConverter.GetBytes(1));Value(key,"DenyInstanceIDsRetroactive",4,BitConverter.GetBytes(1));
   Check(RegOpenKeyTransacted(key,"DenyInstanceIDs",0,Access,out list,transaction,IntPtr.Zero));Count(list,0,0);if(fail==1)throw new IOException("Injected pre-edit interruption.");
   Check(RegDeleteValue(key,"DenyInstanceIDs"));if(fail==2)throw new IOException("Injected flag interruption.");Check(RegDeleteValue(key,"DenyInstanceIDsRetroactive"));if(fail==3)throw new IOException("Injected flag interruption.");Check(RegDeleteValue(key,"SentinelOperation"));if(fail==4)throw new IOException("Injected marker interruption.");
   Check(RegDeleteKeyTransacted(hive,path+"\\DenyInstanceIDs",0x100,0,transaction,IntPtr.Zero));Count(key,0,0);if(fail==5)throw new IOException("Injected pre-commit interruption.");beforeCommit();if(!CommitTransaction(transaction))throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error(),"Legacy cleanup commit refused.");
  }finally{if(list!=IntPtr.Zero)RegCloseKey(list);if(key!=IntPtr.Zero)RegCloseKey(key);RollbackTransaction(transaction);CloseHandle(transaction);}
 }
 // Synthetic tests can reach only an exact disposable HKCU namespace.
 internal static void TestCleanup(string path,string nonce,Action check,int failure){Require(path==@"Software\SentinelLegacyResidueTest\"+nonce);Cleanup(new IntPtr(unchecked((int)0x80000001)),path,nonce,check,failure);}
 static void Publish(string state){using(var key=Registry.LocalMachine.CreateSubKey(Evidence)){key.SetValue("State",state);key.SetValue("Stage",stage,RegistryValueKind.DWord);key.SetValue("Eligible",eligible?1:0,RegistryValueKind.DWord);key.SetValue("Removed",removed?1:0,RegistryValueKind.DWord);key.SetValue("KnownWritersBefore",beforeWriters,RegistryValueKind.DWord);key.SetValue("KnownWritersBeforeCommit",beforeCommitWriters,RegistryValueKind.DWord);}}
 [STAThread]static int Main(string[] args){
  if(args.Length!=0)return 2;using(var identity=WindowsIdentity.GetCurrent())if(!new WindowsPrincipal(identity).IsInRole(WindowsBuiltInRole.Administrator))return 3;
  var held=new List<IDisposable>();try{
   stage=1;Publish("checking");string target,nonce;Require(DuckyPolicyEnrollment.Read(out target,out nonce));
   string directory=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),"SentinelDuckyPolicy");var ancestry=new List<string>();for(var cursor=new DirectoryInfo(directory);cursor!=null;cursor=cursor.Parent)ancestry.Insert(0,cursor.FullName);
   stage=2;foreach(string path in ancestry){held.Add(new SentinelPolicyDirectory(path));DirectoryAcl(path,path==directory);}string lockPath=Path.Combine(directory,".lock");Require(File.Exists(lockPath)&&(File.GetAttributes(lockPath)&FileAttributes.ReparsePoint)==0);var legacyLock=new FileStream(lockPath,FileMode.Open,FileAccess.ReadWrite,FileShare.None);held.Add(legacyLock);FileAcl(legacyLock);
   stage=3;var trial=Read(Path.Combine(directory,"trial.json"),held);var desktop=Read(Path.Combine(directory,"desktop-trial.json"),held);Fields(trial,new[]{"target","nonce","deadline","task","priorState","sourceHash"});Fields(desktop,new[]{"target","nonce","task","retiringTask","deadline","engine"});
   Require(trial["target"] as string==target&&trial["nonce"] as string==nonce&&desktop["target"] as string==target&&desktop["nonce"] as string==nonce&&trial["priorState"] as string=="namespace_absent"&&desktop["engine"] as string=="profiled-ducky-v1"&&KnownSource(trial["sourceHash"] as string));
   DateTime first=Deadline(trial),last=Deadline(desktop);if(first>last)last=first;DateTime boot=DateTime.UtcNow.Subtract(TimeSpan.FromMilliseconds(GetTickCount64()));Require(boot>last); // Additional observation, NOT the writer-quiescence proof.
   string initial=trial["task"] as string,current=desktop["task"] as string,retiring=desktop["retiringTask"] as string;Require(initial=="Sentinel-Ducky-Policy-Recovery-"+nonce&&Regex.IsMatch(current??"",@"\ASentinel-Ducky-App-Recovery-"+nonce+@"-[0-9a-f]{32}\z")&&(retiring==null||Regex.IsMatch(retiring,@"\ASentinel-Ducky-App-Recovery-"+nonce+@"-[0-9a-f]{32}\z")));
   var names=new List<string>{initial,current};if(retiring!=null&&!names.Contains(retiring))names.Add(retiring);
   stage=4;SentinelDuckyLocalGpo.Session(true,(saved,save)=>{
    using(var existing=saved.OpenSubKey(Policy))Require(existing==null);TasksAbsent(names.ToArray());beforeWriters=KnownWriters();Require(beforeWriters==0);
    stage=5;ReleasedEffective(nonce);eligible=true;
#if SENTINEL_USB_LEGACY_MIGRATION_REVIEWED
    Cleanup(new IntPtr(unchecked((int)0x80000002)),Policy,nonce,()=>{stage=6;using(var existing=saved.OpenSubKey(Policy))Require(existing==null);TasksAbsent(names.ToArray());beforeCommitWriters=KnownWriters();Require(beforeCommitWriters==0);},0);removed=true;
    using(var effective=Registry.LocalMachine.OpenSubKey(Policy))Require(effective!=null&&effective.ValueCount==0&&effective.SubKeyCount==0);
#else
    // Default source build reports actual eligibility, never mutates policy.
#endif
   });stage=0;Publish(removed?"complete":"eligible_read_only");return 0;
  }catch{try{Publish("refused");}catch{}return 1;}
  finally{for(int i=held.Count-1;i>=0;i--)held[i].Dispose();}
 }
}
