using System;
using System.IO;
using System.Text;
using System.Collections.Generic;
using System.Security.Principal;
using System.Security.AccessControl;
using Microsoft.Win32;

internal static class UsbAdmissionJournalTest {
 static int stage;
 static void Require(bool value){if(!value)throw new InvalidOperationException("Journal qualification failed.");}
 static void Refuses(Action action){bool refused=false;try{action();}catch{refused=true;}Require(refused);}
 static byte[] Policy(params string[] ids){var bytes=new List<byte>(Encoding.ASCII.GetBytes("SNTINP03"));bytes.Add((byte)ids.Length);foreach(string id in ids){byte[] value=Encoding.ASCII.GetBytes(id);bytes.Add((byte)value.Length);bytes.AddRange(value);}return bytes.ToArray();}
 internal static void Validation(){
  DateTime now=DateTime.UtcNow;string nonce=Guid.NewGuid().ToString("N"),hash=new string('a',64);byte[] policy=Policy("USB\\SYNTHETIC\\INTERFACE");
  var record=new UsbAdmissionJournal.Record(nonce,now,now.AddSeconds(60),hash,policy);
  Require(!record.RequiresRecovery(now.AddSeconds(1))&&record.RequiresRecovery(now.AddSeconds(-1))&&record.RequiresRecovery(now.AddSeconds(60)));
  Refuses(()=>new UsbAdmissionJournal.Record(nonce,now,now.AddSeconds(301),hash,policy));
  Refuses(()=>new UsbAdmissionJournal.Record(nonce,now,now,hash,policy));
  Refuses(()=>new UsbAdmissionJournal.Record("bad",now,now.AddSeconds(60),hash,policy));
  Refuses(()=>new UsbAdmissionJournal.Record(nonce,now,now.AddSeconds(60),hash,Policy("USB\\SYNTHETIC\\INTERFACE","usb\\synthetic\\interface")));
  Refuses(()=>new UsbAdmissionJournal.Record(nonce,now,now.AddSeconds(60),hash,new byte[4073]));
  byte[] copy=record.Policy;copy[0]=0;Require(record.Policy[0]==83);
 }
 static void Receipt(string state){using(var key=Registry.LocalMachine.CreateSubKey(@"SOFTWARE\Sentinel\UsbAdmissionJournalQualification")){key.SetValue("State",state);key.SetValue("Stage",stage,RegistryValueKind.DWord);}}
 static void ProtectedBase(string path){
  var security=Directory.GetAccessControl(path,AccessControlSections.Owner|AccessControlSections.Access);
  var admin=new SecurityIdentifier(WellKnownSidType.BuiltinAdministratorsSid,null);var system=new SecurityIdentifier(WellKnownSidType.LocalSystemSid,null);
  var owner=(SecurityIdentifier)security.GetOwner(typeof(SecurityIdentifier));Require(owner.Equals(admin)||owner.Equals(system));Require(security.AreAccessRulesProtected);
  bool allowed=false;foreach(FileSystemAccessRule rule in security.GetAccessRules(true,true,typeof(SecurityIdentifier))){if(rule.AccessControlType!=AccessControlType.Allow)continue;Require(rule.IdentityReference.Equals(admin)||rule.IdentityReference.Equals(system));if((rule.FileSystemRights&FileSystemRights.FullControl)==FileSystemRights.FullControl)allowed=true;}Require(allowed);
 }
 [STAThread] static int Main(string[] args){
  if(args.Length!=0)return 2;
  using(var identity=WindowsIdentity.GetCurrent())if(!new WindowsPrincipal(identity).IsInRole(WindowsBuiltInRole.Administrator))return 3;
  string path=null,file=null,protectedBase=null;bool passed=false,created=false;
  SentinelPolicyDirectory basePin=null,fixturePin=null;
  try{
   stage=1;Receipt("running");Validation();
   // Never place an elevated mutation fixture beneath user-writable TEMP: its
   // parent DELETE_CHILD permission could redirect writes between store opens.
   // The existing protected base is validated, not created or ACL-repaired here.
   protectedBase=Path.GetFullPath(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),"SentinelDuckyPolicy"));
   basePin=new SentinelPolicyDirectory(protectedBase);ProtectedBase(protectedBase);
   path=Path.GetFullPath(Path.Combine(protectedBase,"SentinelAdmissionProbe-"+Guid.NewGuid().ToString("N")));
   Require(string.Equals(Path.GetDirectoryName(path),protectedBase,StringComparison.OrdinalIgnoreCase)&&!Directory.Exists(path)&&!File.Exists(path));
   stage=2;SentinelPolicyDirectory.Provision(path);created=true;fixturePin=new SentinelPolicyDirectory(path);ProtectedBase(path);file=Path.Combine(path,"admission.bin");
   DateTime now=DateTime.UtcNow;string nonce=Guid.NewGuid().ToString("N");var record=new UsbAdmissionJournal.Record(nonce,now,now.AddSeconds(60),new string('a',64),Policy("USB\\SYNTHETIC\\INTERFACE"));
   stage=3;using(var journal=new UsbAdmissionJournal(path)){
    Require(journal.Read()==null);journal.Arm(record);
    Refuses(()=>journal.Arm(record));Refuses(()=>{using(var duplicate=new UsbAdmissionJournal(path)){} });
    Refuses(()=>journal.ClearAfterVerifiedRestore(new string('b',32)));
    Require(journal.Read().Nonce==nonce);
   }
   stage=4;using(var reopened=new UsbAdmissionJournal(path)){
    Require(reopened.Read().Nonce==nonce);reopened.ClearAfterVerifiedRestore(nonce);Require(reopened.Read()==null);reopened.Arm(record);
   }
   stage=5;byte[] original=File.ReadAllBytes(file);byte[] truncated=new byte[13];Array.Copy(original,truncated,truncated.Length);
   foreach(byte[] invalid in new[]{truncated,new byte[5000]}){
    File.WriteAllBytes(file,invalid);Refuses(()=>{using(var refused=new UsbAdmissionJournal(path)){} });
   }
   stage=6;byte[] corrupt=(byte[])original.Clone();corrupt[corrupt.Length-1]^=1;File.WriteAllBytes(file,corrupt);Refuses(()=>{using(var refused=new UsbAdmissionJournal(path)){} });
   stage=7;File.WriteAllBytes(file,original);using(var recovered=new UsbAdmissionJournal(path)){Require(recovered.Read().Nonce==nonce);recovered.ClearAfterVerifiedRestore(nonce);}
   passed=true;
  }catch{passed=false;}
  finally{
   if(created){try{
    Require(path!=null&&Path.GetFileName(path).StartsWith("SentinelAdmissionProbe-",StringComparison.Ordinal)&&string.Equals(Path.GetDirectoryName(path),protectedBase,StringComparison.OrdinalIgnoreCase));
    Require((File.GetAttributes(path)&FileAttributes.ReparsePoint)==0);
    if(File.Exists(file)){Require((File.GetAttributes(file)&FileAttributes.ReparsePoint)==0);File.Delete(file);}
    if(fixturePin!=null){fixturePin.Dispose();fixturePin=null;}
    Directory.Delete(path,false); // Exact empty fixture only; never recursive.
   }catch{passed=false;stage=99;}}
   if(fixturePin!=null)fixturePin.Dispose();if(basePin!=null)basePin.Dispose();
   if(passed)stage=0;
   try{Receipt(passed?"complete":"failed");}catch{passed=false;}
  }
  return passed?0:1;
 }
}
internal static class UsbAdmissionJournalPureTest {
 static int Main(string[] args){if(args.Length!=0)return 2;try{UsbAdmissionJournalTest.Validation();Console.WriteLine("Admission journal pure validation PASS");return 0;}catch{return 1;}}
}
