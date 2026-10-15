using System;
using System.IO;
using System.Reflection;
using System.Diagnostics;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Threading;
using System.Xml;
using Microsoft.Win32;

// Standalone benign SYSTEM qualification. No USB, policy-write or shell actions.
class DuckyWorkerQualification {
 const string Receipt=@"SOFTWARE\Sentinel\DuckyWorkerQualification";
 static int stage=10;
 static bool Trusted(string sid){return sid=="S-1-5-18"||sid=="S-1-5-32-544";}
 static void CheckPrivate(string path){
  var acl=Directory.GetAccessControl(path);
  if(!acl.AreAccessRulesProtected||!Trusted(acl.GetOwner(typeof(SecurityIdentifier)).Value))throw new InvalidOperationException("Unsafe qualification directory");
  foreach(FileSystemAccessRule rule in acl.GetAccessRules(true,true,typeof(SecurityIdentifier)))if(rule.AccessControlType==AccessControlType.Allow&&!Trusted(rule.IdentityReference.Value))throw new InvalidOperationException("Untrusted qualification access");
 }
 static string Hash(byte[] bytes){using(var hash=SHA256.Create())return BitConverter.ToString(hash.ComputeHash(bytes)).Replace("-","").ToLowerInvariant();}
 static void Record(string nonce,int code,string state,int seconds,int elapsed){using(var key=Registry.LocalMachine.CreateSubKey(Receipt)){key.SetValue("Nonce",nonce);key.SetValue("Stage",code,RegistryValueKind.DWord);key.SetValue("State",state);key.SetValue("LimitSeconds",seconds,RegistryValueKind.DWord);key.SetValue("ElapsedMilliseconds",elapsed,RegistryValueKind.DWord);key.Flush();}}
 static bool Matches(dynamic task,string path,string args){
  dynamic d=task.Definition;
  return (d.Principal.UserId=="SYSTEM"||d.Principal.UserId=="S-1-5-18")&&d.Actions.Count==1&&string.Equals((string)d.Actions[1].Path,path,StringComparison.OrdinalIgnoreCase)&&(string)d.Actions[1].Arguments==args&&d.Settings.AllowHardTerminate;
 }
 static void Released(Mutex mutex){bool acquired=false;try{try{acquired=mutex.WaitOne(0);}catch(AbandonedMutexException){acquired=true;}if(!acquired)throw new InvalidOperationException("Worker retained mutex");}finally{if(acquired)mutex.ReleaseMutex();}}
 static bool LockFree(string name){using(var mutex=new Mutex(false,name)){bool owned=false;try{try{owned=mutex.WaitOne(0);}catch(AbandonedMutexException){owned=true;}return owned;}finally{if(owned)mutex.ReleaseMutex();}}}
 static bool Quiescent(dynamic service,string name,string nonce){
  foreach(dynamic running in service.GetRunningTasks(1))if((string)running.Path=="\\"+name)return false;
  return LockFree(@"Global\SentinelDuckyLocalGpo")&&LockFree(@"Global\Sentinel-Ducky-Worker-Test-"+nonce+"-child-mutex");
 }
 sealed class ProbeTask {public string Name,Arguments,Image;public bool Recovery;public int Limit;public DateTime InitialLastRun;public dynamic Registered;}
 static ProbeTask RegisterPrivate(dynamic service,dynamic folder,string image,string nonce,string mode,List<ProbeTask> owned,bool recovery){
  DateTime now=DateTime.UtcNow;var lease=DuckyWorkerLease.Create(now,now.AddSeconds(120),null);
  var item=new ProbeTask{Name="Sentinel-Ducky-Gpo-Native-"+mode+"-"+nonce,Image=image,Limit=lease.Seconds,Arguments=mode+" "+nonce+" "+lease.Seconds+" "+lease.LatestStartUtc.Ticks+" "+lease.RecoveryDeadlineUtc.Ticks+" system",Recovery=recovery};
  dynamic definition=service.NewTask(0);definition.Principal.UserId="SYSTEM";definition.Principal.LogonType=5;definition.Principal.RunLevel=1;
  definition.Settings.ExecutionTimeLimit=lease.ExecutionTimeLimit;definition.Settings.AllowHardTerminate=true;definition.Settings.DisallowStartIfOnBatteries=false;definition.Settings.StopIfGoingOnBatteries=false;definition.Settings.StartWhenAvailable=recovery;definition.Settings.AllowDemandStart=true;definition.Settings.MultipleInstances=2;
  if(recovery){dynamic trigger=definition.Triggers.Create(1);trigger.StartBoundary=now.AddSeconds(30).ToString("o");trigger.Enabled=true;}
  dynamic action=definition.Actions.Create(0);action.Path=image;action.Arguments=item.Arguments;
  item.Registered=folder.RegisterTaskDefinition(item.Name,definition,2,"SYSTEM",null,5,null);owned.Add(item);
  item.InitialLastRun=(DateTime)item.Registered.LastRunTime;
  if(!Matches(item.Registered,image,item.Arguments)||XmlConvert.ToTimeSpan((string)item.Registered.Definition.Settings.ExecutionTimeLimit).TotalSeconds!=lease.Seconds)throw new InvalidOperationException("Private task differs");
  if(recovery){dynamic readback=item.Registered.Definition;if(readback.Triggers.Count!=1||readback.Triggers[1].Type!=1||!readback.Triggers[1].Enabled||!readback.Settings.StartWhenAvailable||Math.Abs((DateTime.Parse((string)readback.Triggers[1].StartBoundary).ToUniversalTime()-now.AddSeconds(30)).TotalSeconds)>1)throw new InvalidOperationException("Independent private trigger differs");}
  return item;
 }
 static void WaitPrivate(dynamic folder,ProbeTask item,bool start){
  dynamic task=folder.GetTask(item.Name);DateTime before=item.InitialLastRun;
  if(!Matches(task,item.Image,item.Arguments)||XmlConvert.ToTimeSpan((string)task.Definition.Settings.ExecutionTimeLimit).TotalSeconds!=item.Limit)throw new InvalidOperationException("Private task changed before execution");
  if(start){if((DateTime)task.LastRunTime>before&&(int)task.State==3&&(int)task.LastTaskResult==0)return;before=(DateTime)task.LastRunTime;task.Run(null);}
  var watch=Stopwatch.StartNew();
  do{
   Thread.Sleep(100);task=folder.GetTask(item.Name);
   if((DateTime)task.LastRunTime>before&&(int)task.State==3){if((int)task.LastTaskResult!=0)throw new InvalidOperationException("Private native worker failed");return;}
  }while(watch.Elapsed.TotalSeconds<95);
  throw new InvalidOperationException("Private native worker timed out");
 }
 static bool PrivateTasksQuiet(dynamic service,List<ProbeTask> owned,string nonce){
  foreach(dynamic running in service.GetRunningTasks(1))foreach(var item in owned)if((string)running.Path=="\\"+item.Name)return false;
  return LockFree(@"Global\SentinelDuckyLocalGpo");
 }
 static int QualifyNativeGpo(string image,string nonce){
  dynamic service=null,folder=null;var owned=new List<ProbeTask>();ProbeTask recovery=null;bool armed=false,released=false;int failure=0;
  try{
   service=Activator.CreateInstance(Type.GetTypeFromProgID("Schedule.Service"));service.Connect();folder=service.GetFolder("\\");
   stage=40;Record(nonce,stage,"pending",0,0);
   using(var key=Registry.LocalMachine.CreateSubKey(Receipt)){key.SetValue("NativePrivateSavedRecovery",0,RegistryValueKind.DWord);}
   var baseline=RegisterPrivate(service,folder,image,nonce,"private-baseline",owned,false);WaitPrivate(folder,baseline,true);
   stage=41;recovery=RegisterPrivate(service,folder,image,nonce,"private-release",owned,true);
   stage=42;var hold=RegisterPrivate(service,folder,image,nonce,"private-hold",owned,false);armed=true;WaitPrivate(folder,hold,true);
   stage=43;var held=RegisterPrivate(service,folder,image,nonce,"private-held",owned,false);WaitPrivate(folder,held,true);
   stage=44;WaitPrivate(folder,recovery,false); // Independently triggered; broker does not start it.
   stage=45;var verify=RegisterPrivate(service,folder,image,nonce,"private-released",owned,false);WaitPrivate(folder,verify,true);released=true;
   using(var check=Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Sentinel\DuckyWorkerQualification\Checks\"+nonce))if(check==null||(int)check.GetValue("HeldVerified",0)!=1||(int)check.GetValue("ReleaseVerified",0)!=1)throw new InvalidOperationException("Private verification receipt missing");
   using(var key=Registry.LocalMachine.CreateSubKey(Receipt)){key.SetValue("NativePrivateSavedRecovery",1,RegistryValueKind.DWord);key.Flush();}
  }catch{failure=stage;}
  finally{
   try{if(owned.Count>0){
    // Stop producers/readers first. Preserve and use the independent cleanup task
    // if a partially completed save needs recovery; never cancel it prematurely.
    foreach(var item in owned)if(!item.Recovery){dynamic task=folder.GetTask(item.Name);if(!Matches(task,image,item.Arguments))throw new InvalidOperationException("Private task changed");task.Enabled=false;try{task.Stop(0);}catch(COMException e){if(e.HResult!=unchecked((int)0x8004130B))throw;}}
    var watch=Stopwatch.StartNew();while(!PrivateTasksQuiet(service,owned,nonce)&&watch.Elapsed.TotalSeconds<20)Thread.Sleep(100);
    if(!PrivateTasksQuiet(service,owned,nonce))throw new InvalidOperationException("Private producer cleanup unknown");
    if(armed&&!released){if(recovery==null)throw new InvalidOperationException("Private recovery unavailable");WaitPrivate(folder,recovery,true);}
    foreach(var item in owned){dynamic task=folder.GetTask(item.Name);if(!Matches(task,image,item.Arguments))throw new InvalidOperationException("Private cleanup task changed");task.Enabled=false;try{task.Stop(0);}catch(COMException e){if(e.HResult!=unchecked((int)0x8004130B))throw;}}
    watch.Restart();while(!PrivateTasksQuiet(service,owned,nonce)&&watch.Elapsed.TotalSeconds<20)Thread.Sleep(100);
    if(!PrivateTasksQuiet(service,owned,nonce))throw new InvalidOperationException("Private recovery cleanup unknown");
    foreach(var item in owned)folder.DeleteTask(item.Name,0);
   }
   }catch{Record(nonce,90,"cleanup_unknown",0,0);while(true)Thread.Sleep(1000);}
   if(folder!=null&&Marshal.IsComObject(folder))Marshal.FinalReleaseComObject(folder);if(service!=null&&Marshal.IsComObject(service))Marshal.FinalReleaseComObject(service);
  }
  return failure;
 }
 public static int Main(string[] args){
  if(args.Length>1||(args.Length==1&&args[0]!="private-gpo"))return 10;
  if(!new WindowsPrincipal(WindowsIdentity.GetCurrent()).IsInRole(WindowsBuiltInRole.Administrator))return 11;
  if(args.Length==1){
   if(Process.GetProcessesByName("mmc").Length!=0)return 12;
   using(var key=Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Policies\Microsoft\Windows\DeviceInstall\Restrictions\DenyInstanceIDs"))if(key!=null&&key.ValueCount!=0)return 13;
  }
  using(var key=Registry.LocalMachine.CreateSubKey(Receipt)){key.SetValue("Scenario",args.Length==0?"system-containment":"native-private-gpo");}
  string nonce=Guid.NewGuid().ToString("N"),taskName="Sentinel-Ducky-Worker-Qualification-"+nonce,workerArgs=null,lateArgs=null,image=null;
  dynamic service=null,folder=null;bool registered=false;int result=0,seconds=0,elapsed=0;SentinelPolicyDirectory anchor=null;FileStream pinned=null;
  try{
   string directory=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),"SentinelDuckyPolicy");
   anchor=new SentinelPolicyDirectory(directory);{
    CheckPrivate(directory);
    byte[] bytes;using(var resource=Assembly.GetExecutingAssembly().GetManifestResourceStream("Sentinel.WorkerFixture"))using(var memory=new MemoryStream()){resource.CopyTo(memory);bytes=memory.ToArray();}
    if(bytes.Length>2097152)throw new InvalidOperationException("Worker image exceeds bound");
    image=Path.Combine(directory,"qualification-worker-"+Hash(bytes)+".exe");
    stage=12;
    if(!File.Exists(image))using(var created=new FileStream(image,FileMode.CreateNew,FileAccess.Write,FileShare.None)){created.Write(bytes,0,bytes.Length);created.Flush(true);}
    if((File.GetAttributes(image)&FileAttributes.ReparsePoint)!=0)throw new InvalidOperationException("Reparse worker image");
    // Retain deny-write/delete handle across registration, execution and cleanup.
    pinned=new FileStream(image,FileMode.Open,FileAccess.Read,FileShare.Read);{
     using(var memory=new MemoryStream()){pinned.CopyTo(memory);if(Hash(memory.ToArray())!=Hash(bytes))throw new InvalidOperationException("Worker image changed");}
     if(args.Length==1){result=QualifyNativeGpo(image,nonce);return result;}
     stage=13;
     using(var rootMutex=new Mutex(false,@"Global\SentinelDuckyLocalGpo"))using(var childMutex=new Mutex(false,@"Global\Sentinel-Ducky-Worker-Test-"+nonce+"-child-mutex"))
     using(var rootReady=new EventWaitHandle(false,EventResetMode.ManualReset,@"Global\Sentinel-Ducky-Worker-Test-"+nonce+"-root-ready"))using(var childReady=new EventWaitHandle(false,EventResetMode.ManualReset,@"Global\Sentinel-Ducky-Worker-Test-"+nonce+"-child-ready")){
      Released(rootMutex); // Refuse a busy policy session before starting the test.
      service=Activator.CreateInstance(Type.GetTypeFromProgID("Schedule.Service"));service.Connect();folder=service.GetFolder("\\");
      dynamic definition=service.NewTask(0);definition.Principal.UserId="SYSTEM";definition.Principal.LogonType=5;definition.Principal.RunLevel=1;
      DateTime start=DateTime.UtcNow;var watch=Stopwatch.StartNew();var lease=DuckyWorkerLease.Create(start,start.AddSeconds(45),null);seconds=lease.Seconds;
      workerArgs="root "+nonce+" "+seconds+" "+lease.LatestStartUtc.Ticks+" "+lease.RecoveryDeadlineUtc.Ticks+" system";
      definition.Settings.ExecutionTimeLimit=lease.ExecutionTimeLimit;definition.Settings.AllowHardTerminate=true;definition.Settings.DisallowStartIfOnBatteries=false;definition.Settings.StopIfGoingOnBatteries=false;
      definition.Settings.StartWhenAvailable=false;definition.Settings.AllowDemandStart=true;definition.Settings.MultipleInstances=2;
      dynamic action=definition.Actions.Create(0);action.Path=image;action.Arguments=workerArgs;
      Record(nonce,14,"pending",seconds,0);stage=14;
      dynamic task=folder.RegisterTaskDefinition(taskName,definition,2,"SYSTEM",null,5,null);registered=true;
      if(!Matches(task,image,workerArgs)||XmlConvert.ToTimeSpan((string)task.Definition.Settings.ExecutionTimeLimit).TotalSeconds!=seconds||!lease.CanStart(DateTime.UtcNow))throw new InvalidOperationException("Worker task differs or missed dispatch");
      task.Run(null);stage=15;
      if(!rootReady.WaitOne(10000)||!childReady.WaitOne(10000))throw new InvalidOperationException("SYSTEM worker did not acquire both locks");
      do{Thread.Sleep(100);task=folder.GetTask(taskName);}while((int)task.State==4&&watch.Elapsed.TotalSeconds<45);
      if((int)task.State==4)throw new InvalidOperationException("SYSTEM worker did not terminate");
      stage=16;
      bool initialRoot=LockFree(@"Global\SentinelDuckyLocalGpo"),initialChild=LockFree(@"Global\Sentinel-Ducky-Worker-Test-"+nonce+"-child-mutex");
      int stoppedAt=(int)watch.ElapsedMilliseconds;
      using(var key=Registry.LocalMachine.CreateSubKey(Receipt)){key.SetValue("RootInitiallyFree",initialRoot?1:0,RegistryValueKind.DWord);key.SetValue("ChildInitiallyFree",initialChild?1:0,RegistryValueKind.DWord);key.SetValue("TaskStoppedMilliseconds",stoppedAt,RegistryValueKind.DWord);}
      bool quiet=false;do{quiet=Quiescent(service,taskName,nonce);if(quiet)break;Thread.Sleep(50);}while(watch.Elapsed.TotalSeconds<45);
      if(!quiet)throw new InvalidOperationException("Worker locks missed recovery deadline");
      Released(rootMutex);Released(childMutex);elapsed=(int)watch.ElapsedMilliseconds;
      if(elapsed>45000)throw new InvalidOperationException("Worker exceeded recovery deadline");
      stage=17;if(!SentinelDuckyLocalGpo.ReadOnlyProbe())throw new InvalidOperationException("Fresh GPO read unavailable after termination");
      rootReady.Reset();childReady.Reset();DateTime late=DateTime.UtcNow;
      lateArgs="root "+nonce+" 5 "+late.AddSeconds(-1).Ticks+" "+late.AddSeconds(30).Ticks+" system";
      definition.Actions[1].Arguments=lateArgs;folder.RegisterTaskDefinition(taskName,definition,4,"SYSTEM",null,5,null);
      task=folder.GetTask(taskName);if(!Matches(task,image,lateArgs))throw new InvalidOperationException("Late test task changed");
      task.Run(null);stage=18;
      var lateWatch=Stopwatch.StartNew();do{Thread.Sleep(100);task=folder.GetTask(taskName);}while((int)task.LastTaskResult!=12&&lateWatch.Elapsed.TotalSeconds<10);
      if((int)task.LastTaskResult!=12||rootReady.WaitOne(0)||childReady.WaitOne(0))throw new InvalidOperationException("Late SYSTEM worker entered protected work");
     }
    }
   }
  }catch{result=stage;}
  finally{
   if(registered){try{
    dynamic task=folder.GetTask(taskName);
    if(!Matches(task,image,workerArgs)&&(lateArgs==null||!Matches(task,image,lateArgs)))throw new InvalidOperationException("Cleanup task changed");
    task.Enabled=false;try{task.Stop(0);}catch(COMException e){if(e.HResult!=unchecked((int)0x8004130B))throw;}
    var cleanupWatch=Stopwatch.StartNew();bool quiet=false;
    do{quiet=Quiescent(service,taskName,nonce);if(quiet)break;Thread.Sleep(100);}while(cleanupWatch.Elapsed.TotalSeconds<20);
    if(!quiet)throw new InvalidOperationException("Cleanup remains unknown");
    folder.DeleteTask(taskName,0);
   }catch{result=90;}}
   if(result==90){
    Record(nonce,result,"cleanup_unknown",seconds,elapsed);
    // Qualification only: preserve exact task identity and live image/anchor
    // pins for diagnosis. This broker owns no GPO mutex and changes no policy.
    while(true)Thread.Sleep(1000);
   }
   try{Record(nonce,result,result==0?"complete":"failed",seconds,elapsed);}catch{result=91;}
   if(folder!=null&&Marshal.IsComObject(folder))Marshal.FinalReleaseComObject(folder);
   if(service!=null&&Marshal.IsComObject(service))Marshal.FinalReleaseComObject(service);
   if(pinned!=null)pinned.Dispose();if(anchor!=null)anchor.Dispose();
  }
  return result;
 }
}
