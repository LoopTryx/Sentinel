$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$compiler=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
$output=Join-Path $root 'artifacts/DuckyPolicyArgumentTest.exe'
$arguments=@('/nologo','/target:exe','/platform:x64','/define:SENTINEL_DUCKY_POLICY_LAB',('/out:'+$output),('/reference:'+(Join-Path (Split-Path $compiler) 'System.Web.Extensions.dll')),('/resource:'+(Join-Path $root 'tools/usb/DuckyPolicyEntry.cs')+',Sentinel.Ducky.Entry'))
$arguments+=@('apps/desktop/DuckyPolicyHost.cs','apps/desktop/DuckyPolicyEnrollment.cs','tools/usb/DuckyPolicyEntry.cs','tools/usb/DuckyPolicyJournal.cs')|ForEach-Object {Join-Path $root $_}
& $compiler $arguments
if($LASTEXITCODE -ne 0){throw 'Fixed-purpose helper compile failed'}
# Deliberately omit elevation manifest for these rejection-only tests. No accepted
# command is ever invoked; these paths return before any native/registry access.
foreach($argument in @('status','hold EXTRA','release TARGET','USB\VID_0001&PID_0001\TEST')){
 $process=Start-Process $output -ArgumentList $argument -PassThru -WindowStyle Hidden
 if(-not $process.WaitForExit(10000) -or $process.ExitCode -ne 10){throw 'Helper accepted unsupported command or caller target'}
}
Write-Output 'Desktop fixed-purpose helper compile and argument rejection PASS; no device policy changed'
$fixture=Join-Path $root 'artifacts/DuckyTaskStateTest.cs'
$fixtureSource=@'
using System;
using System.Collections.Generic;
using System.Web.Script.Serialization;
class TaskStateTest {
 static int Main(){
  var pending=DuckyTaskState.Create("target","nonce","new-task","old-task",DateTime.UtcNow.AddMinutes(5));
  // Retirement times out; a subsequent process must retain and refuse the old task.
  var saved=new JavaScriptSerializer().Serialize(pending);
  var reloaded=new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(saved);
  if((string)reloaded["retiringTask"]!="old-task"||(string)reloaded["task"]!="new-task")return 1;
  bool refused=false;try{DuckyTaskState.AssertReady(reloaded);}catch(InvalidOperationException){refused=true;}
  if(!refused)return 2;
  reloaded["retiringTask"]=null;DuckyTaskState.AssertReady(reloaded);return 0;
 }
}
'@
[IO.File]::WriteAllText($fixture,$fixtureSource)
$journalExe=Join-Path $root 'artifacts/DuckyTaskStateTest.exe'
$arguments[4]='/out:'+$journalExe
$arguments+=@('/main:TaskStateTest',$fixture)
& $compiler $arguments
if($LASTEXITCODE -ne 0){throw 'Task restart regression compile failed'}
& $journalExe
if($LASTEXITCODE -ne 0){throw 'Retirement timeout/restart regression failed'}
Write-Output 'Retirement timeout preserves both task identities and refuses another hold after restart: PASS'
