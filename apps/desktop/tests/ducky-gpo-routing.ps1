$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$csc=Join-Path $env:windir 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$fixture=Join-Path $root 'artifacts/DuckyGpoRoutingTest.cs'
@'
using System;
using System.IO;
using System.Reflection;
class DuckyGpoRoutingTest {
 static int Main(){
  var f=BindingFlags.NonPublic|BindingFlags.Static;var type=typeof(DuckyPolicyHost);
  var method=type.GetMethod("RecoveryFor",f);if(method==null){Console.WriteLine("RED: recovery routing is missing");return 1;}
  string entry=File.ReadAllText(Environment.GetCommandLineArgs()[1]),gpo=File.ReadAllText(Environment.GetCommandLineArgs()[2]);
  string path=@"SOFTWARE\Policies\Microsoft\Windows\DeviceInstall\Restrictions",target=@"USB\VID_0001&PID_0001\TEST",nonce="0123456789abcdef0123456789abcdef";
  string legacy=(string)type.GetMethod("Recovery",f).Invoke(null,new object[]{entry,path,target,nonce});
  string oldAction=(string)method.Invoke(null,new object[]{"profiled-ducky-v1",entry,gpo,path,target,nonce});
  if(oldAction!=legacy)return 2;
  string next=(string)method.Invoke(null,new object[]{"profiled-ducky-gpo-v2",entry,gpo,path,target,nonce});
  if(next==legacy||next.IndexOf("EditEnrolled",StringComparison.Ordinal)<0)return 3;
  string schedule=(string)type.GetMethod("ScheduleScript",f).Invoke(null,new object[]{"Sentinel-Ducky-App-Probe-"+nonce,next,DateTime.UtcNow.AddMinutes(1)});
  if(DuckyCommandEncoding.Arguments(next).Length>28000||DuckyCommandEncoding.Arguments(schedule).Length>28000)return 4;
  bool refused=false;try{method.Invoke(null,new object[]{"unknown",entry,gpo,path,target,nonce});}catch(TargetInvocationException e){refused=e.InnerException is InvalidOperationException;}
  if(!refused)return 5;
  Console.WriteLine("Legacy action preserved; saved-GPO recovery routing and full command bounds PASS (no native action)");return 0;
 }
}
'@ | Set-Content $fixture
$argsList=@('/nologo','/target:exe','/platform:x64','/main:DuckyGpoRoutingTest',('/out:'+(Join-Path $root 'artifacts/DuckyGpoRoutingTest.exe')),('/reference:'+(Join-Path (Split-Path $csc) 'System.Web.Extensions.dll')),('/resource:'+(Join-Path $root 'tools/usb/DuckyPolicyEntry.cs')+',Sentinel.Ducky.Entry'),('/resource:'+(Join-Path $root 'tools/usb/DuckyLocalGpo.cs')+',Sentinel.Ducky.Gpo'))
$argsList+=@('apps/desktop/DuckyPolicyHost.cs','apps/desktop/DuckyInputHealth.cs','apps/desktop/DuckyPolicyEnrollment.cs','tools/usb/DuckyPolicyEntry.cs','tools/usb/DuckyPolicyJournal.cs','tools/usb/DuckyLocalGpo.cs')|ForEach-Object {Join-Path $root $_}
$argsList+=$fixture
& $csc $argsList;if($LASTEXITCODE -ne 0){throw 'Routing fixture compile failed'}
& (Join-Path $root 'artifacts/DuckyGpoRoutingTest.exe') (Join-Path $root 'tools/usb/DuckyPolicyEntry.cs') (Join-Path $root 'tools/usb/DuckyLocalGpo.cs')
if($LASTEXITCODE -ne 0){throw 'Saved-GPO recovery routing regression failed'}
