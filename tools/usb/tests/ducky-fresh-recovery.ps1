$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$source=Join-Path $root 'artifacts/DuckyFreshRecoveryTest.cs'
@"
using System;
using System.Reflection;
public class FakePrivateDefinition {public FakeSettings Settings=new FakeSettings();public FakeActions Actions=new FakeActions();public FakePrincipal Principal=new FakePrincipal();}
public class FakeSettings {public bool AllowHardTerminate=true;public string ExecutionTimeLimit="PT5S";}
public class FakePrincipal {public string UserId="SYSTEM";public int LogonType=5,RunLevel=1;}
public class FakeActions {public int Count=1;public FakeAction this[int i]{get{return new FakeAction();}}}
public class FakeAction {public int Type=0;public string Path="fixture.exe",Arguments="private-release";}
public class FakeTask {
 public FakePrivateDefinition Definition=new FakePrivateDefinition();public DateTime LastRunTime=DateTime.Now.AddMinutes(-1);public int State=3,LastTaskResult=0,Runs=0;
 public void Run(object unused){Runs++;LastRunTime=DateTime.Now;State=3;LastTaskResult=0;}
}
public class FakeFolder {public FakeTask Task=new FakeTask();public FakeTask GetTask(string name){return Task;}}
class DuckyFreshRecoveryTest {
 static int Main(){
  var host=typeof(DuckyFreshRecoveryTest).Assembly.GetType("DuckyWorkerQualification");
  var itemType=host.GetNestedType("ProbeTask",BindingFlags.NonPublic);object item=Activator.CreateInstance(itemType,true);
  Action<string,object> set=(n,v)=>itemType.GetField(n).SetValue(item,v);
  set("Name","test");set("Image","fixture.exe");set("Arguments","private-release");set("Limit",5);set("InitialLastRun",DateTime.Now.AddHours(-1));
  var folder=new FakeFolder();var before=folder.Task.LastRunTime;
  host.GetMethod("WaitPrivate",BindingFlags.Static|BindingFlags.NonPublic).Invoke(null,new object[]{folder,item,true});
  if(folder.Task.Runs!=1||folder.Task.LastRunTime<=before){Console.Error.WriteLine("FAIL: earlier successful recovery reused instead of new run");return 1;}
  Console.WriteLine("PASS: fresh cleanup requires a new recovery run; no tasks or policy changed");return 0;
 }
}
"@ | Set-Content $source
$csc=Join-Path $env:windir 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
$exe=Join-Path $root 'artifacts/DuckyFreshRecoveryTest.exe'
$inputs=@('tools/usb/tests/DuckyWorkerQualification.cs','tools/usb/DuckyWorkerLease.cs','tools/usb/DuckyLocalGpo.cs','tools/usb/DuckyPolicyJournal.cs')|ForEach-Object{Join-Path $root $_}
& $csc /nologo /target:exe /platform:x64 /main:DuckyFreshRecoveryTest ('/reference:'+(Join-Path (Split-Path $csc) 'Microsoft.CSharp.dll')) ('/out:'+$exe) $source $inputs
if($LASTEXITCODE -ne 0){throw 'Test compilation failed'}
& $exe
if($LASTEXITCODE -ne 0){throw 'Fresh recovery regression failed'}
