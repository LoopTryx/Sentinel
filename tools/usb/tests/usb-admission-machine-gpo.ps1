$ErrorActionPreference='Stop'
$root=Split-Path (Split-Path (Split-Path $PSScriptRoot))
$plan=Join-Path $root 'artifacts/usb-admission-private-plan.bin'
if(!(Test-Path $plan)){throw 'Run usb-admission-plan-bridge.ps1 first'}
$source=Join-Path $root 'artifacts/UsbAdmissionMachineTest.cs'
@"
using System;using System.IO;using System.Reflection;using Microsoft.Win32;
class MachineTest {
 class Authority:UsbAdmissionMachineGpo.IWorkerAuthority {public string Nonce{get;set;}public byte[] CanonicalPlan{get;set;}public int Checks;public void CheckCurrent(bool recovery){Checks++;}}
 static void Assert(bool ok){if(!ok)throw new Exception("Machine policy test failed");}
 static void Refused(Action run){bool refused=false;try{run();}catch(InvalidOperationException){refused=true;}Assert(refused);}
 public static int Main(){string nonce=Guid.NewGuid().ToString("N"),basePath=@"Software\SentinelAdmissionMachineHarness\"+nonce,path=@"Software\SentinelAdmissionMachineTest\"+nonce;byte[] plan;using(var stream=Assembly.GetExecutingAssembly().GetManifestResourceStream("Plan"))using(var memory=new MemoryStream()){stream.CopyTo(memory);plan=memory.ToArray();}var authority=new Authority{Nonce=nonce,CanonicalPlan=plan};int saves=0;
 try{using(var saved=Registry.CurrentUser.CreateSubKey(basePath+@"\saved"))using(var effective=Registry.CurrentUser.CreateSubKey(basePath+@"\effective")){
  UsbAdmissionMachineGpo.TestEdit(saved,effective,path,authority,true,()=>saves++);Assert(saves==1&&authority.Checks>=3);
  using(var own=saved.OpenSubKey(path))Assert((string)own.GetValue("SentinelAdmissionOperation")==nonce);
  Refused(()=>UsbAdmissionMachineGpo.TestEdit(saved,effective,path,authority,true,()=>saves++));Assert(saves==1);
  UsbAdmissionMachineGpo.TestEdit(saved,effective,path,authority,false,()=>saves++);Assert(saves==2);
  using(var released=saved.OpenSubKey(path))Assert(released.GetValue("DenyDeviceIDs")==null&&(string)released.GetValue("**Del.DenyDeviceIDs")=="");
  using(var foreign=effective.CreateSubKey(path))foreign.SetValue("SentinelOperation","legacy");
  Refused(()=>UsbAdmissionMachineGpo.TestEdit(saved,effective,path,authority,false,()=>saves++));Assert(saves==2);
  using(var foreign=effective.OpenSubKey(path))Assert((string)foreign.GetValue("SentinelOperation")=="legacy");
  Refused(()=>UsbAdmissionMachineGpo.EditMachine(authority,true));
 }Console.WriteLine("PASS: actual disposable HKCU core edits, release tombstones, legacy conflict preserved, default live gate");return 0;}finally{Registry.CurrentUser.DeleteSubKeyTree(basePath,false);}}
}
"@ | Set-Content $source
$csc=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
$exe=Join-Path $root 'artifacts/UsbAdmissionMachineTest.exe'
& $csc /nologo /target:exe /platform:x64 /define:SENTINEL_USB_ADMISSION_TEST ('/resource:'+$plan+',Plan') ('/out:'+$exe) $source (Join-Path $root 'tools/usb/UsbSavedAdmissionEntry.cs') (Join-Path $root 'tools/usb/UsbAdmissionMachineGpo.cs') (Join-Path $root 'tools/usb/UsbAdmissionCleanupStage.cs') (Join-Path $root 'tools/usb/UsbAdmissionJournal.cs') (Join-Path $root 'tools/usb/DuckyPolicyJournal.cs')
if($LASTEXITCODE -ne 0){throw 'Machine core test compile failed'}
& $exe
if($LASTEXITCODE -ne 0){throw 'Machine core test failed'}
