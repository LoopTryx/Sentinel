param([switch]$BuildOnly)
$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
Add-Type -Path (Join-Path $root 'tools/usb/DuckyWorkerLease.cs')
$fixture=Join-Path $root 'artifacts/DuckyWorkerHangFixture.cs'
@'
using System;
using System.Diagnostics;
using System.Reflection;
using System.Threading;
using System.Text.RegularExpressions;
using System.Security.Principal;
using Microsoft.Win32;
class DuckyWorkerHangFixture {
 static int Main(string[] args){
  bool privateMode=args.Length>0&&(args[0]=="private-baseline"||args[0]=="private-hold"||args[0]=="private-release"||args[0]=="private-held"||args[0]=="private-released");
  if((args.Length!=5&&args.Length!=6)||(!privateMode&&args[0]!="root"&&args[0]!="child")||!Regex.IsMatch(args[1],"\\A[0-9a-f]{32}\\z"))return 10;
  bool system=args.Length==6;if(system&&(args[5]!="system"||!WindowsIdentity.GetCurrent().IsSystem))return 11;
  if(privateMode&&!system)return 11;
  if(args[0]=="root"||privateMode){
   var lease=DuckyWorkerLease.Rehydrate(int.Parse(args[2]),new DateTime(long.Parse(args[3]),DateTimeKind.Utc),new DateTime(long.Parse(args[4]),DateTimeKind.Utc));
   // Cleanup is still allowed after expiry; it can only remove this private entry.
   if(args[0]!="private-release"&&!lease.CanStart(DateTime.UtcNow))return 12;
   DuckyWorkerJob.AttachCurrentWorker();
  }
  if(privateMode){
   try{
    string receipt=@"SOFTWARE\Sentinel\DuckyWorkerQualification\Checks\"+args[1],digest;
    if(args[0]=="private-hold"||args[0]=="private-release"){
     SentinelDuckyLocalGpo.EditPrivateProbe(args[1],args[0]=="private-hold");
     using(var p=Process.Start(new ProcessStartInfo(System.IO.Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),"gpupdate.exe"),"/target:computer /force /wait:20"){UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true})){
      var output=p.StandardOutput.ReadToEndAsync();var error=p.StandardError.ReadToEndAsync();if(!p.WaitForExit(25000)||p.ExitCode!=0)return 24;
     }
    }
    string state=SentinelDuckyLocalGpo.PrivateProbeState(args[1],out digest);
    using(var key=Registry.LocalMachine.CreateSubKey(receipt)){
     if(args[0]=="private-baseline"){if(state!="missing")return 21;key.SetValue("Baseline",digest);}
     else {if((string)key.GetValue("Baseline",null)!=digest)return 22;}
     if(args[0]=="private-held"){
      if(state!="armed")return 23;
      using(var effective=Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Sentinel\DuckyGpoProbe\"+args[1]+@"\DenyInstanceIDs"))if(effective==null||(string)effective.GetValue("1",null)!=@"USB\VID_0001&PID_0001\PRIVATE-PROBE")return 25;
      key.SetValue("HeldVerified",1,RegistryValueKind.DWord);
     }
     if(args[0]=="private-released"){
      if(state!="released")return 23;
      using(var effective=Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Sentinel\DuckyGpoProbe\"+args[1]+@"\DenyInstanceIDs"))if(effective!=null&&effective.GetValue("1",null)!=null)return 25;
      key.SetValue("ReleaseVerified",1,RegistryValueKind.DWord);
     }
     key.Flush();
    }return 0;
   }catch{return 20;}
  }
  string prefix=(system?@"Global\":@"Local\")+"Sentinel-Ducky-Worker-Test-"+args[1]+"-"+args[0];
  string mutexName=system&&args[0]=="root"?@"Global\SentinelDuckyLocalGpo":prefix+"-mutex";
  using(var mutex=new Mutex(false,mutexName))using(var ready=new EventWaitHandle(false,EventResetMode.ManualReset,prefix+"-ready")){
   mutex.WaitOne();
   if(args[0]=="root")Process.Start(new ProcessStartInfo(Assembly.GetExecutingAssembly().Location,"child "+string.Join(" ",args,1,args.Length-1)){UseShellExecute=false,CreateNoWindow=true});
   ready.Set();Thread.Sleep(Timeout.Infinite);
  }return 0;
 }
}
'@ | Set-Content $fixture
$exe=Join-Path $root 'artifacts/DuckyWorkerHangFixture.exe'
$csc=Join-Path $env:windir 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
& $csc /nologo /target:winexe /platform:x64 ('/out:'+$exe) $fixture (Join-Path $root 'tools/usb/DuckyWorkerJob.cs') (Join-Path $root 'tools/usb/DuckyWorkerLease.cs') (Join-Path $root 'tools/usb/DuckyLocalGpo.cs')
if($LASTEXITCODE -ne 0){throw 'Harmless worker fixture build failed'}
if($BuildOnly){return}
$nonce=[guid]::NewGuid().ToString('N')
$name='Sentinel-Ducky-Worker-Test-'+$nonce
$prefix='Local\Sentinel-Ducky-Worker-Test-'+$nonce
$rootMutex=[Threading.Mutex]::new($false,$prefix+'-root-mutex')
$childMutex=[Threading.Mutex]::new($false,$prefix+'-child-mutex')
$rootReady=[Threading.EventWaitHandle]::new($false,[Threading.EventResetMode]::ManualReset,$prefix+'-root-ready')
$childReady=[Threading.EventWaitHandle]::new($false,[Threading.EventResetMode]::ManualReset,$prefix+'-child-ready')
$registered=$false;$start=[datetime]::UtcNow
$workerArgs=$null;$lateArgs=$null
try{
 $lease=[DuckyWorkerLease]::Create($start,$start.AddSeconds(45),$null)
 $principal=New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
 $workerArgs='root '+$nonce+' '+$lease.Seconds+' '+$lease.LatestStartUtc.Ticks+' '+$lease.RecoveryDeadlineUtc.Ticks
 $action=New-ScheduledTaskAction -Execute $exe -Argument $workerArgs
 $settings=New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([timespan]::FromSeconds($lease.Seconds)) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
 Register-ScheduledTask -TaskName $name -Principal $principal -Action $action -Settings $settings|Out-Null
 $registered=$true
 $task=Get-ScheduledTask -TaskName $name
 if(-not $task.Settings.AllowHardTerminate -or [Xml.XmlConvert]::ToTimeSpan($task.Settings.ExecutionTimeLimit).TotalSeconds -ne $lease.Seconds){throw 'Task hard-termination settings differ'}
 if(-not $lease.CanStart([datetime]::UtcNow)){throw 'Task dispatch missed its lease'}
 Start-ScheduledTask -TaskName $name
 if(-not $rootReady.WaitOne(10000) -or -not $childReady.WaitOne(10000)){throw 'Harmless fixture did not enter both locks'}
 $until=$start.AddSeconds(50)
 do {
  $task=Get-ScheduledTask -TaskName $name
  if($task.State -ne 'Running'){break}
  Start-Sleep -Milliseconds 250
 }while([datetime]::UtcNow -lt $until)
 if($task.State -eq 'Running'){throw 'Task Scheduler did not stop hung worker'}
 foreach($mutex in @($rootMutex,$childMutex)){
  $acquired=$false
  try{try{$acquired=$mutex.WaitOne(0)}catch [Threading.AbandonedMutexException]{$acquired=$true}
   if(-not $acquired){throw 'Worker descendant retained its lock after task termination'}
  }finally{if($acquired){$mutex.ReleaseMutex()}}
 }
 $elapsed=([datetime]::UtcNow-$start).TotalSeconds
 if($elapsed -gt 45){throw 'Worker termination missed the test recovery deadline'}
 # Same scheduler, but now dispatch a stale lease. Worker must refuse BEFORE locks.
 $rootReady.Reset()|Out-Null;$childReady.Reset()|Out-Null
 $lateAt=[datetime]::UtcNow
 $lateArgs='root '+$nonce+' 5 '+$lateAt.AddSeconds(-1).Ticks+' '+$lateAt.AddSeconds(30).Ticks
 Set-ScheduledTask -TaskName $name -Action (New-ScheduledTaskAction -Execute $exe -Argument $lateArgs)|Out-Null
 Start-ScheduledTask -TaskName $name
 $until=[datetime]::UtcNow.AddSeconds(10)
 do{$info=Get-ScheduledTaskInfo -TaskName $name;if($info.LastTaskResult -eq 12){break};Start-Sleep -Milliseconds 100}while([datetime]::UtcNow -lt $until)
 if($info.LastTaskResult -ne 12 -or $rootReady.WaitOne(0) -or $childReady.WaitOne(0)){throw 'Late task entered protected work instead of refusing'}
 [pscustomobject]@{taskLimitSeconds=$lease.Seconds;elapsedSeconds=[Math]::Round($elapsed,2);rootLockReleased=$true;childLockReleased=$true;workerRejectedLateDispatch=$true;devicePolicyChanged=$false}|ConvertTo-Json
}finally{
 if($registered){
  $task=Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
  if($task -and $task.Actions.Count -eq 1 -and $task.Actions[0].Execute -ceq $exe -and $task.Actions[0].Arguments -cin @($workerArgs,$lateArgs)){
   Stop-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
   Unregister-ScheduledTask -TaskName $name -Confirm:$false
  }
 }
 # Only this test's exact executable/nonce/start window; never a USB/desktop process.
 Get-CimInstance Win32_Process -Filter "Name='DuckyWorkerHangFixture.exe'" -ErrorAction SilentlyContinue|Where-Object {$_.ExecutablePath -ceq $exe -and $_.CommandLine -like ('* '+$nonce+'*') -and $_.CreationDate.ToUniversalTime() -ge $start.AddSeconds(-2)}|ForEach-Object {
  $p=Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue
  if($p -and $p.Path -ceq $exe -and [decimal]::Truncate([decimal]$p.StartTime.ToUniversalTime().Ticks/10) -eq [decimal]::Truncate([decimal]$_.CreationDate.ToUniversalTime().Ticks/10)){Stop-Process -InputObject $p}
 }
 $rootMutex.Dispose();$childMutex.Dispose();$rootReady.Dispose();$childReady.Dispose()
}
