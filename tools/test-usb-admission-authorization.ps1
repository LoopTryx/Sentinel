$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$framework=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319'
$test=Join-Path $root 'artifacts/UsbAdmissionAuthorizationTest.cs'
@'
using System;
using System.IO;
using System.Text;
internal static class UsbAdmissionAuthorizationTest {
 static void Check(bool b){if(!b)throw new Exception("Authorization regression failed");}
 static void Refuses(Action work){bool refused=false;try{work();}catch{refused=true;}Check(refused);}
 static UsbAdmissionTransaction.Request Selected(string[] safety,string[] approved){
  var config=new UsbEnrollmentConfig.Snapshot(1,"S-1-5-21-111-222-333-1001",safety,approved);
  byte[] policy;using(var stream=new MemoryStream())using(var writer=new BinaryWriter(stream,Encoding.ASCII)){writer.Write(Encoding.ASCII.GetBytes("SNTINP03"));writer.Write((byte)(safety.Length+approved.Length));foreach(var list in new[]{safety,approved})foreach(string id in list){writer.Write((byte)id.Length);writer.Write(Encoding.ASCII.GetBytes(id));}writer.Flush();policy=stream.ToArray();}
  DateTime now=new DateTime(2026,10,16,0,0,0,DateTimeKind.Utc);return new UsbAdmissionTransaction.Request(0,config,new string('a',64),new string('b',32),now,now.AddMinutes(2),policy);
 }
 static void NativeSelection(){
  const string inside="USB\\SYNTHETIC\\INTERNAL",outside="USB\\SYNTHETIC\\EXTERNAL";
  var selected=Selected(new[]{inside},new string[0]);
  var inventory=new UsbAdmissionInventory.Result{Complete=true,Preflight=new UsbAdmissionPreflight.Result{State="review_required",TopologyToken=selected.TopologyHash,Candidates=new[]{new UsbAdmissionPreflight.Candidate{Instance=inside,Category="required_safety_candidate"},new UsbAdmissionPreflight.Candidate{Instance=outside,Category="external_approval_required"}}}};
  UsbAdmissionNativeAuthority.CheckInventory(selected,inventory);
  UsbAdmissionNativeAuthority.CheckInventory(Selected(new[]{inside},new[]{outside}),inventory);
  Refuses(()=>UsbAdmissionNativeAuthority.CheckInventory(Selected(new[]{inside,outside},new string[0]),inventory));
  Refuses(()=>UsbAdmissionNativeAuthority.CheckInventory(Selected(new[]{inside},new[]{"USB\\SYNTHETIC\\ABSENT"}),inventory));
  inventory.Complete=false;Refuses(()=>UsbAdmissionNativeAuthority.CheckInventory(selected,inventory));inventory.Complete=true;
  inventory.Preflight.TopologyToken=new string('c',64);Refuses(()=>UsbAdmissionNativeAuthority.CheckInventory(selected,inventory));
 }
 static int Main(){
  NativeSelection();
  var binding=new UsbAdmissionAuthorization.Request("S-1-5-21-111-222-333-1001",7,new string('a',64),"approve",new string('b',64));
  Check(!UsbAdmissionAuthorization.MatchesOwner(binding.OwnerSid,"S-1-5-21-111-222-333-1002",binding.OwnerSid,1,1));
  Check(!UsbAdmissionAuthorization.MatchesOwner(binding.OwnerSid,binding.OwnerSid,binding.OwnerSid,0,0));
  Check(!UsbAdmissionAuthorization.MatchesOwner(binding.OwnerSid,binding.OwnerSid,binding.OwnerSid,1,2));
  Check(UsbAdmissionAuthorization.MatchesOwner(binding.OwnerSid,binding.OwnerSid,binding.OwnerSid,1,1));
  bool used=false;Check(UsbAdmissionAuthorization.ConsumeGate(ref used,binding,binding,0,true));Check(!UsbAdmissionAuthorization.ConsumeGate(ref used,binding,binding,1,true));
  used=false;Check(!UsbAdmissionAuthorization.ConsumeGate(ref used,binding,binding,30000,true));Check(!UsbAdmissionAuthorization.ConsumeGate(ref used,binding,binding,1,true));
  used=false;Check(!UsbAdmissionAuthorization.ConsumeGate(ref used,binding,binding,-1,true));
  used=false;Check(!UsbAdmissionAuthorization.ConsumeGate(ref used,binding,binding,1,false));
  var changed=new UsbAdmissionAuthorization.Request(binding.OwnerSid,8,binding.Topology,binding.Action,binding.Digest);
  used=false;Check(!UsbAdmissionAuthorization.ConsumeGate(ref used,binding,changed,1,true));Check(!UsbAdmissionAuthorization.ConsumeGate(ref used,binding,binding,1,true));
  Check(UsbAdmissionAuthorization.Verify(IntPtr.Zero,binding).GetAwaiter().GetResult()==null);
  Console.WriteLine("USB native owner/session binding and invalid HWND refusal PASS");return 0;
 }
}
'@ | Set-Content -LiteralPath $test
$out=Join-Path $root 'artifacts/UsbAdmissionAuthorizationTest.exe'
$sources=@('apps/desktop/UsbAdmissionAuthorization.cs','apps/desktop/UsbAdmissionNativeAuthority.cs','apps/desktop/UsbOwnerVerification.cs','apps/desktop/UsbAdmissionInventory.cs','apps/desktop/UsbInternalDetection.cs','apps/desktop/UsbConnectorEvidence.cs','tools/usb/UsbAdmissionPreflight.cs','tools/usb/UsbAdmissionTransaction.cs','tools/usb/UsbAdmissionJournal.cs','tools/usb/UsbEnrollmentConfig.cs','tools/usb/DuckyPolicyJournal.cs')|ForEach-Object{Join-Path $root $_}
& (Join-Path $framework 'csc.exe') /nologo /target:exe ('/out:'+$out) ('/reference:'+(Join-Path $framework 'System.Runtime.WindowsRuntime.dll')) $test $sources
if($LASTEXITCODE -ne 0){throw 'Authorization test build failed'}
& $out
if($LASTEXITCODE -ne 0){throw 'Authorization test failed'}
