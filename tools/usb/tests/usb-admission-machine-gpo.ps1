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
  effective.DeleteSubKeyTree(path,false);string baseline=new string('c',32);
  using(var kept=effective.CreateSubKey(path)){
   kept.SetValue("SentinelOperation",baseline);kept.SetValue("DenyInstanceIDs",1,RegistryValueKind.DWord);kept.SetValue("DenyInstanceIDsRetroactive",1,RegistryValueKind.DWord);using(var empty=kept.CreateSubKey("DenyInstanceIDs")){}
   UsbAdmissionMachineGpo.TestEffectiveReleased(effective,path,nonce,false,baseline);
   Refused(()=>UsbAdmissionMachineGpo.TestEffectiveOwned(effective,path,nonce,plan,null));
   kept.SetValue("SentinelAdmissionOperation",nonce);
   foreach(var value in UsbSavedAdmissionEntry.DecodePlan(plan))using(var child=value.Key==""?null:kept.CreateSubKey(value.Key)){var key=child??kept;if(value.Kind==4)key.SetValue(value.Name,1,RegistryValueKind.DWord);else key.SetValue(value.Name,System.Text.Encoding.Unicode.GetString(value.Data).TrimEnd('\0'));}
   UsbAdmissionMachineGpo.TestEffectiveOwned(effective,path,nonce,plan,baseline);
   kept.SetValue("ForeignPolicy",1,RegistryValueKind.DWord);Refused(()=>UsbAdmissionMachineGpo.TestEffectiveOwned(effective,path,nonce,plan,baseline));kept.DeleteValue("ForeignPolicy");
   using(var list=kept.OpenSubKey("DenyInstanceIDs",true)){list.SetValue("1","USB\\SYNTHETIC");Refused(()=>UsbAdmissionMachineGpo.TestEffectiveOwned(effective,path,nonce,plan,baseline));list.DeleteValue("1");}
   foreach(var value in UsbSavedAdmissionEntry.DecodePlan(plan))using(var child=value.Key==""?null:kept.OpenSubKey(value.Key,true)){var key=child??kept;key.DeleteValue(value.Name,false);}kept.DeleteValue("SentinelAdmissionOperation");
   UsbAdmissionMachineGpo.TestEffectiveReleased(effective,path,nonce,false,baseline);Assert((string)kept.GetValue("SentinelOperation")==baseline&&(int)kept.GetValue("DenyInstanceIDs")==1&&(int)kept.GetValue("DenyInstanceIDsRetroactive")==1);
   kept.SetValue("ForeignPolicy",1);Refused(()=>UsbAdmissionMachineGpo.TestEffectiveReleased(effective,path,nonce,false,baseline));kept.DeleteValue("ForeignPolicy");
  }
  saved.DeleteSubKeyTree(path,false);effective.DeleteSubKeyTree(path,false);UsbAdmissionMachineGpo.TestEdit(saved,effective,path,authority,true,()=>saves++);
  using(var held=effective.CreateSubKey(path)){held.SetValue("SentinelAdmissionOperation",nonce);foreach(var value in UsbSavedAdmissionEntry.DecodePlan(plan))using(var child=value.Key==""?null:held.CreateSubKey(value.Key)){var key=child??held;if(value.Kind==4)key.SetValue(value.Name,1,RegistryValueKind.DWord);else key.SetValue(value.Name,System.Text.Encoding.Unicode.GetString(value.Data).TrimEnd('\0'));}}
  UsbAdmissionMachineGpo.TestVerifyHeld(saved,effective,path,authority);
  using(var held=effective.OpenSubKey(path,true)){held.SetValue("Unexpected",1);Refused(()=>UsbAdmissionMachineGpo.TestVerifyHeld(saved,effective,path,authority));held.DeleteValue("Unexpected");held.DeleteValue("DenyDeviceIDs");Refused(()=>UsbAdmissionMachineGpo.TestVerifyHeld(saved,effective,path,authority));held.SetValue("DenyDeviceIDs",1,RegistryValueKind.DWord);}
  using(var held=saved.OpenSubKey(path,true)){held.SetValue("Unexpected",1);Refused(()=>UsbAdmissionMachineGpo.TestVerifyHeld(saved,effective,path,authority));held.DeleteValue("Unexpected");}
  Refused(()=>UsbAdmissionMachineGpo.EditMachine(authority,true));
 }Console.WriteLine("PASS: actual disposable HKCU core edits, release tombstones, legacy conflict preserved, authenticated effective baseline overlays reject drift, default live gate");return 0;}finally{Registry.CurrentUser.DeleteSubKeyTree(basePath,false);}}
}
"@ | Set-Content $source
$csc=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
$exe=Join-Path $root 'artifacts/UsbAdmissionMachineTest.exe'
& $csc /nologo /target:exe /platform:x64 /define:SENTINEL_USB_ADMISSION_TEST ('/resource:'+$plan+',Plan') ('/out:'+$exe) $source (Join-Path $root 'tools/usb/UsbSavedAdmissionEntry.cs') (Join-Path $root 'tools/usb/UsbAdmissionMachineGpo.cs') (Join-Path $root 'tools/usb/UsbAdmissionCleanupStage.cs') (Join-Path $root 'tools/usb/UsbAdmissionJournal.cs') (Join-Path $root 'tools/usb/DuckyPolicyJournal.cs') (Join-Path $root 'tools/usb/UsbLegacyReleasedBaseline.cs') (Join-Path $root 'apps/desktop/DuckyPolicyEnrollment.cs') /reference:Microsoft.CSharp.dll /reference:System.Web.Extensions.dll
if($LASTEXITCODE -ne 0){throw 'Machine core test compile failed'}
& $exe
if($LASTEXITCODE -ne 0){throw 'Machine core test failed'}
