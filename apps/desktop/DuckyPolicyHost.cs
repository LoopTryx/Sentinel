using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Web.Script.Serialization;
using Microsoft.Win32;

// Elevated fixed-purpose helper: no device IDs, paths or scripts accepted as arguments.
public static class DuckyPolicyHost {
 static int stage=30;
 [System.Runtime.InteropServices.DllImport("cfgmgr32.dll",CharSet=System.Runtime.InteropServices.CharSet.Unicode)]static extern int CM_Locate_DevNode(out uint node,string id,int flags);
 [System.Runtime.InteropServices.DllImport("cfgmgr32.dll")]static extern int CM_Get_DevNode_Status(out uint status,out uint problem,uint node,int flags);
 const string Policy=@"SOFTWARE\Policies\Microsoft\Windows\DeviceInstall\Restrictions";
 static string PS {get{return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),@"WindowsPowerShell\v1.0\powershell.exe");}}
 static string B64(string text){return Convert.ToBase64String(Encoding.UTF8.GetBytes(text));}
 static int Run(string script){
  using(var p=Process.Start(new ProcessStartInfo(PS,DuckyCommandEncoding.Arguments(script)){UseShellExecute=false,CreateNoWindow=true})){
   if(!p.WaitForExit(90000))throw new InvalidOperationException("Windows policy operation still pending");return p.ExitCode;
  }
 }
 static string Recovery(string source,string path,string target,string nonce){
  string data=new JavaScriptSerializer().Serialize(new{path=path,target=target,nonce=nonce});
  return "try{Add-Type -TypeDefinition ([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('"+B64(source)+"')));$p=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('"+B64(data)+"'))|ConvertFrom-Json;[SentinelDuckyEntry]::Restore($p.path,$p.target,$p.nonce,$true); & (Join-Path ([Environment]::GetFolderPath('System')) 'gpupdate.exe') /target:computer /force /wait:30 *> $null;if($LASTEXITCODE -ne 0){exit 19};exit 0}catch{exit 18}";
 }
 static string Arguments(string payload){string value=Convert.ToBase64String(Encoding.Unicode.GetBytes(payload));if(value.Length>28000)throw new InvalidOperationException("Recovery action too large");return "-NoProfile -NonInteractive -WindowStyle Hidden -EncodedCommand "+value;}
 static void Schedule(string name,string recovery,DateTime at){
  string script="$ErrorActionPreference='Stop';$name='"+name+"';if(Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue){throw 'Existing recovery task'};$a=New-ScheduledTaskAction -Execute '"+PS+"' -Argument '"+Arguments(recovery)+"';$t=New-ScheduledTaskTrigger -Once -At ([datetime]::Parse('"+at.ToLocalTime().ToString("o")+"')) -RepetitionInterval (New-TimeSpan -Minutes 1);$p=New-ScheduledTaskPrincipal -UserId SYSTEM -LogonType ServiceAccount -RunLevel Highest;$s=New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 1);Register-ScheduledTask -TaskName $name -Action $a -Trigger $t -Principal $p -Settings $s|Out-Null";
  if(Run(script)!=0)throw new InvalidOperationException("Recovery task unavailable");
 }
 static void Refresh(){if(Run("& (Join-Path ([Environment]::GetFolderPath('System')) 'gpupdate.exe') /target:computer /force /wait:30 *> $null;exit $LASTEXITCODE")!=0)throw new InvalidOperationException("Windows policy refresh failed");}
 static void Save(string path,Dictionary<string,object> record){byte[] bytes=Encoding.UTF8.GetBytes(new JavaScriptSerializer().Serialize(record));using(var file=new FileStream(path,FileMode.Create,FileAccess.Write,FileShare.None)){file.Write(bytes,0,bytes.Length);file.Flush(true);}}
 static void Retire(string task,string action){
  if(task==null)return;
  string script="$ErrorActionPreference='Stop';$n='"+task+"';$t=Get-ScheduledTask -TaskName $n -ErrorAction SilentlyContinue;if($t){if($t.Principal.UserId -notin @('SYSTEM','S-1-5-18') -or $t.Actions.Count -ne 1 -or $t.Actions[0].Execute -cne '"+PS+"' -or $t.Actions[0].Arguments -cne '"+action+"'){exit 18};Disable-ScheduledTask -TaskName $n|Out-Null;Stop-ScheduledTask -TaskName $n;$until=[datetime]::UtcNow.AddSeconds(10);$service=New-Object -ComObject Schedule.Service;$service.Connect();do{$running=@($service.GetRunningTasks(1)|Where-Object {$_.Path -ceq ('\\'+$n)});if($running.Count -eq 0){Unregister-ScheduledTask -TaskName $n -Confirm:$false;exit 0};Start-Sleep -Milliseconds 250}while([datetime]::UtcNow -lt $until);exit 18}";
  if(Run(script)!=0)throw new InvalidOperationException("Previous recovery task did not retire");
 }
 static void Healthy(string target){uint node,status,problem;if(CM_Locate_DevNode(out node,target,0)!=0||CM_Get_DevNode_Status(out status,out problem,node,0)!=0||problem!=0)throw new InvalidOperationException("Reconnect the released device before another hold");}
 static bool Trusted(string sid){return sid=="S-1-5-18"||sid=="S-1-5-32-544"||sid=="S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464";}
 static void CheckDirectory(string path,bool privateDirectory){
  var acl=Directory.GetAccessControl(path);
  if(!Trusted(acl.GetOwner(typeof(SecurityIdentifier)).Value))throw new InvalidOperationException("Untrusted journal owner");
  if(privateDirectory&&!acl.AreAccessRulesProtected)throw new InvalidOperationException("Inherited journal access");
  foreach(FileSystemAccessRule rule in acl.GetAccessRules(true,true,typeof(SecurityIdentifier))){
   if(rule.AccessControlType!=AccessControlType.Allow || Trusted(rule.IdentityReference.Value) || (rule.PropagationFlags&PropagationFlags.InheritOnly)!=0)continue;
   if(privateDirectory || (rule.FileSystemRights&(FileSystemRights.DeleteSubdirectoriesAndFiles|FileSystemRights.ChangePermissions|FileSystemRights.TakeOwnership))!=0)throw new InvalidOperationException("Journal access unsafe");
  }
 }
 public static int Main(string[] args){
  if(args.Length!=1||(args[0]!="hold"&&args[0]!="release"))return 10;
  if(!new WindowsPrincipal(WindowsIdentity.GetCurrent()).IsInRole(WindowsBuiltInRole.Administrator))return 11;
  var anchors=new List<IDisposable>();
  try{
   stage=30;string directory=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),"SentinelDuckyPolicy");
   var parents=new List<string>();for(var d=new DirectoryInfo(directory);d!=null;d=d.Parent)parents.Insert(0,d.FullName);
   foreach(string d in parents){anchors.Add(new SentinelPolicyDirectory(d));CheckDirectory(d,d==directory);}
   anchors.Add(new FileStream(Path.Combine(directory,".lock"),FileMode.OpenOrCreate,FileAccess.ReadWrite,FileShare.None));
   Dictionary<string,object> profile;
   using(var file=new FileStream(Path.Combine(directory,"trial.json"),FileMode.Open,FileAccess.Read,FileShare.None)){
    if(file.Length>8192)throw new InvalidOperationException("Profile too large");using(var reader=new StreamReader(file))profile=new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(reader.ReadToEnd());
   }
   string target=profile["target"] as string,nonce=profile["nonce"] as string;
   if(!Regex.IsMatch(target??"",@"\AUSB\\VID_[0-9A-Fa-f]{4}&PID_[0-9A-Fa-f]{4}\\[A-Za-z0-9&_.-]{1,160}\z")||!Regex.IsMatch(nonce??"",@"\A[0-9a-f]{32}\z"))return 12;
   stage=31;DuckyPolicyEnrollment.Publish(target,nonce);
   string previousTask=null,retiringTask=null,desktopReceipt=Path.Combine(directory,"desktop-trial.json");Dictionary<string,object> priorRecord=null;
   if(File.Exists(desktopReceipt)){
    using(var file=new FileStream(desktopReceipt,FileMode.Open,FileAccess.Read,FileShare.None)){
     if(file.Length>8192)throw new InvalidOperationException("Trial journal too large");using(var reader=new StreamReader(file)){
      var prior=new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(reader.ReadToEnd());
      priorRecord=prior;
      if((prior["target"] as string)!=target||(prior["nonce"] as string)!=nonce)throw new InvalidOperationException("Trial identity changed");
      previousTask=prior["task"] as string;
      if(!Regex.IsMatch(previousTask??"",@"\ASentinel-Ducky-App-Recovery-"+nonce+@"-[0-9a-f]{32}\z"))throw new InvalidOperationException("Trial task identity changed");
      if(prior.ContainsKey("retiringTask")){retiringTask=prior["retiringTask"] as string;if(retiringTask!=null&&!Regex.IsMatch(retiringTask,@"\ASentinel-Ducky-App-Recovery-"+nonce+@"-[0-9a-f]{32}\z"))throw new InvalidOperationException("Retiring task identity changed");}
     }
    }
   }
   string task="Sentinel-Ducky-App-Recovery-"+nonce+"-"+Guid.NewGuid().ToString("N");
   string source;using(var reader=new StreamReader(typeof(DuckyPolicyHost).Assembly.GetManifestResourceStream("Sentinel.Ducky.Entry")))source="#define SENTINEL_DUCKY_POLICY_LAB\n"+reader.ReadToEnd();
   if(args[0]=="release"){
    stage=40;SentinelDuckyEntry.Restore(Policy,target,nonce,true);stage=41;Refresh();
    if(priorRecord!=null){Healthy(target);string expected=Arguments(Recovery(source,Policy,target,nonce));Retire(retiringTask,expected);Retire(previousTask,expected);priorRecord["retiringTask"]=null;Save(desktopReceipt,priorRecord);}
    return 0;
   }
   DuckyTaskState.AssertReady(priorRecord);
   using(var list=Registry.LocalMachine.OpenSubKey(Policy+@"\DenyInstanceIDs")){if(list==null||list.ValueCount!=0)throw new InvalidOperationException("Release current hold before arming again");}
   Refresh();
   if(previousTask!=null){uint node,status,problem;if(CM_Locate_DevNode(out node,target,0)!=0||CM_Get_DevNode_Status(out status,out problem,node,0)!=0||problem!=0)throw new InvalidOperationException("Reconnect the released device before arming again");}
   string probeNonce=Guid.NewGuid().ToString("N"),probePath=@"SOFTWARE\Sentinel\DuckyPolicyProbe\"+probeNonce,probeTask="Sentinel-Ducky-App-Probe-"+probeNonce;
   stage=32;Schedule(probeTask,Recovery(source,probePath,target,probeNonce),DateTime.UtcNow.AddSeconds(3));
   stage=33;SentinelDuckyEntry.Apply(probePath,target,probeNonce,true,0);
   stage=34;
   if(Run("$ErrorActionPreference='Stop';$n='"+probeTask+"';Start-ScheduledTask -TaskName $n;$until=[datetime]::UtcNow.AddSeconds(50);do{$r=Get-ScheduledTaskInfo -TaskName $n;if($r.LastRunTime -gt (Get-Date).AddMinutes(-1) -and $r.LastTaskResult -eq 0){Unregister-ScheduledTask -TaskName $n -Confirm:$false;exit 0};Start-Sleep -Milliseconds 250}while([datetime]::UtcNow -lt $until);exit 18")!=0)throw new InvalidOperationException("Independent recovery qualification failed");
   using(var list=Registry.LocalMachine.OpenSubKey(probePath+@"\DenyInstanceIDs")){if(list==null||list.GetValue("1",null)!=null)throw new InvalidOperationException("Independent recovery readback failed");}
   // Register replacement before retiring anything; there is no gap in recovery coverage.
   string action=Arguments(Recovery(source,Policy,target,nonce));
   DateTime deadline=DateTime.UtcNow.AddMinutes(5);
   stage=35;var receipt=DuckyTaskState.Create(target,nonce,task,previousTask,deadline);
   Save(desktopReceipt,receipt);
   stage=36;Schedule(task,Recovery(source,Policy,target,nonce),deadline);
   if(previousTask!=null){
    uint node,status,problem;if(CM_Locate_DevNode(out node,target,0)!=0||CM_Get_DevNode_Status(out status,out problem,node,0)!=0||problem!=0)throw new InvalidOperationException("Device recovery changed before task retirement");
    Retire(previousTask,action);
   }
   receipt["retiringTask"]=null;Save(desktopReceipt,receipt);
   try{stage=37;SentinelDuckyEntry.Arm(Policy,target,nonce,true,deadline);stage=38;Refresh();}
   catch{try{SentinelDuckyEntry.Restore(Policy,target,nonce,true);Refresh();}catch{}throw;}
   return 0;
  }catch{return stage;}
  finally{for(int i=anchors.Count-1;i>=0;i--)anchors[i].Dispose();}
 }
}
public static class DuckyCommandEncoding {
 public static string Arguments(string script){
  byte[] bytes=Encoding.UTF8.GetBytes(script);string compressed;
  using(var memory=new MemoryStream()){
   using(var zip=new GZipStream(memory,CompressionMode.Compress,true))zip.Write(bytes,0,bytes.Length);
   compressed=Convert.ToBase64String(memory.ToArray());
  }
  string loader="$ErrorActionPreference='Stop';$m=New-Object IO.MemoryStream(,[Convert]::FromBase64String('"+compressed+"'));$z=New-Object IO.Compression.GZipStream($m,[IO.Compression.CompressionMode]::Decompress);$r=New-Object IO.StreamReader($z,[Text.Encoding]::UTF8);try{& ([scriptblock]::Create($r.ReadToEnd()))}finally{$r.Dispose();$z.Dispose();$m.Dispose()}";
  string arguments="-NoProfile -NonInteractive -WindowStyle Hidden -EncodedCommand "+Convert.ToBase64String(Encoding.Unicode.GetBytes(loader));
  if(arguments.Length>28000)throw new InvalidOperationException("Management command exceeds Windows limit");return arguments;
 }
}
public static class DuckyTaskState {
 public static Dictionary<string,object> Create(string target,string nonce,string task,string retiringTask,DateTime deadline){return new Dictionary<string,object>{{"target",target},{"nonce",nonce},{"task",task},{"retiringTask",retiringTask},{"deadline",deadline.ToString("o")},{"engine","profiled-ducky-v1"}};}
 public static void AssertReady(Dictionary<string,object> record){if(record!=null&&record.ContainsKey("retiringTask")&&record["retiringTask"]!=null)throw new InvalidOperationException("Unresolved retiring task; release recovery required");}
}
