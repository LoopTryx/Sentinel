using System;
using System.IO;
using System.Text;
using System.Security.AccessControl;
using System.Security.Principal;
using Microsoft.Win32;

internal static class UsbEnrollmentConfigTest {
 static int stage;
 static void Require(bool value){if(!value)throw new InvalidOperationException("Enrollment qualification failed.");}
 static void Refuses(Action action){bool refused=false;try{action();}catch{refused=true;}Require(refused);}
 internal static void Pure(){
  var record=new UsbEnrollmentConfig.Snapshot(1,"S-1-5-21-111-222-333-1001",new[]{"ACPI\\SYNTHETIC\\INTERNAL"},new[]{"USB\\SYNTHETIC\\APPROVED"});
  byte[] bytes=UsbEnrollmentConfig.Encode(record);
  var copy=UsbEnrollmentConfig.Decode(bytes);Require(copy.Generation==1&&copy.InternalSafety.Length==1&&copy.ApprovedExternal.Length==1);
  string[] ids=record.InternalSafety;ids[0]="altered";Require(record.InternalSafety[0]!="altered");
  Refuses(()=>new UsbEnrollmentConfig.Snapshot(0,"S-1-5-21-111-222-333-1001",new string[0],new string[0]));
  Refuses(()=>new UsbEnrollmentConfig.Snapshot(1,"S-1-5-21-111-222-333-1001",new[]{"USB\\SYNTHETIC\\A"},new[]{"usb\\synthetic\\a"}));
  Refuses(()=>new UsbEnrollmentConfig.Snapshot(1,"S-1-5-21-111-222-333-1001",new string[0],new[]{"USB\\*"}));
  Refuses(()=>new UsbEnrollmentConfig.Snapshot(1,"S-1-5-21-111-222-333-1001",new string[33],new string[0]));
  Refuses(()=>new UsbEnrollmentConfig.Snapshot(1,"invalid",new string[0],new string[0]));
  Refuses(()=>new UsbEnrollmentConfig.Snapshot(1,"BA",new string[0],new string[0]));
  Refuses(()=>new UsbEnrollmentConfig.Snapshot(1,"S-1-5-18",new string[0],new string[0]));
  var maximum=new string[32];for(int i=0;i<maximum.Length;i++)maximum[i]="USB\\S"+i+"\\"+new string('x',185);
  Refuses(()=>new UsbEnrollmentConfig.Snapshot(1,"S-1-5-21-111-222-333-1001",maximum,new string[0]));
  var exact=new string[21];for(int i=0;i<20;i++){string prefix="USB\\N"+i+"\\";exact[i]=prefix+new string('x',200-prefix.Length);}string last="USB\\LAST\\";exact[20]=last+new string('x',42-last.Length);
  var bounded=new UsbEnrollmentConfig.Snapshot(ulong.MaxValue,"S-1-5-21-111-222-333-1001",new string[0],exact);
  Require(UsbEnrollmentConfig.Decode(UsbEnrollmentConfig.Encode(bounded)).ApprovedExternal.Length==21);
  exact[20]+="x";Refuses(()=>new UsbEnrollmentConfig.Snapshot(1,"S-1-5-21-111-222-333-1001",new string[0],exact));
  Refuses(()=>UsbEnrollmentConfig.Decode(new byte[5000]));
  Refuses(()=>UsbEnrollmentConfig.Decode(new byte[13]));
  byte[] corrupt=(byte[])bytes.Clone();corrupt[corrupt.Length-1]^=1;Refuses(()=>UsbEnrollmentConfig.Decode(corrupt));
  var empty=new UsbEnrollmentConfig.Snapshot(1,"S-1-5-21-111-222-333-1001",new string[0],new string[0]);Require(UsbEnrollmentConfig.Decode(UsbEnrollmentConfig.Encode(empty)).ApprovedExternal.Length==0);
 }
 static void Protected(string path){
  var acl=Directory.GetAccessControl(path,AccessControlSections.Owner|AccessControlSections.Access);var admin=new SecurityIdentifier(WellKnownSidType.BuiltinAdministratorsSid,null);var system=new SecurityIdentifier(WellKnownSidType.LocalSystemSid,null);
  var owner=acl.GetOwner(typeof(SecurityIdentifier));Require(owner.Equals(admin)||owner.Equals(system));Require(acl.AreAccessRulesProtected);bool full=false;
  foreach(FileSystemAccessRule rule in acl.GetAccessRules(true,true,typeof(SecurityIdentifier))){if(rule.AccessControlType!=AccessControlType.Allow)continue;Require(rule.IdentityReference.Equals(admin)||rule.IdentityReference.Equals(system));if((rule.FileSystemRights&FileSystemRights.FullControl)==FileSystemRights.FullControl)full=true;}Require(full);
 }
 static void Receipt(string state){using(var key=Registry.LocalMachine.CreateSubKey(@"SOFTWARE\Sentinel\UsbEnrollmentConfigQualification")){key.SetValue("State",state);key.SetValue("Stage",stage,RegistryValueKind.DWord);}}
 [STAThread]static int Main(string[] args){
  if(args.Length!=0)return 2;using(var identity=WindowsIdentity.GetCurrent())if(!new WindowsPrincipal(identity).IsInRole(WindowsBuiltInRole.Administrator))return 3;
  string root=Path.GetFullPath(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),"SentinelDuckyPolicy"));string fixture=null;
  SentinelPolicyDirectory basePin=null,fixturePin=null;bool created=false,passed=false;
  try{
   stage=1;Receipt("running");Pure();basePin=new SentinelPolicyDirectory(root);Protected(root);
   fixture=Path.Combine(root,"SentinelEnrollmentProbe-"+Guid.NewGuid().ToString("N"));Require(!Directory.Exists(fixture)&&!File.Exists(fixture));SentinelPolicyDirectory.Provision(fixture);created=true;fixturePin=new SentinelPolicyDirectory(fixture);Protected(fixture);
   var first=new UsbEnrollmentConfig.Snapshot(1,"S-1-5-21-111-222-333-1001",new[]{"ACPI\\SYNTHETIC\\INTERNAL"},new string[0]);
   var second=new UsbEnrollmentConfig.Snapshot(2,"S-1-5-21-111-222-333-1001",first.InternalSafety,new[]{"USB\\SYNTHETIC\\APPROVED"});
   stage=2;using(var store=new UsbEnrollmentConfig(fixture)){
    Require(store.ReadCommitted()==null);store.Commit(0,first);
    Refuses(()=>store.Commit(0,first));Refuses(()=>{using(var duplicate=new UsbEnrollmentConfig(fixture)){} });
    Refuses(()=>store.Commit(1,new UsbEnrollmentConfig.Snapshot(3,"S-1-5-21-111-222-333-1001",new string[0],new string[0])));
    Refuses(()=>store.Commit(1,new UsbEnrollmentConfig.Snapshot(2,"S-1-5-21-111-222-333-1002",first.InternalSafety,new string[0])));
   }
   stage=3;using(var store=new UsbEnrollmentConfig(fixture)){
    Require(store.ReadCommitted().Generation==1);
    Refuses(()=>store.CommitForTest(1,second,2));Require(store.ReadCommitted().Generation==1&&store.ReadPending().Generation==2);
    Refuses(()=>store.Commit(1,second));Refuses(()=>store.DiscardPending(0,2));Refuses(()=>store.DiscardPending(1,3));
   }
   stage=4;using(var store=new UsbEnrollmentConfig(fixture)){
    Require(store.ReadCommitted().Generation==1&&store.ReadPending().Generation==2);store.DiscardPending(1,2);
    Refuses(()=>store.CommitForTest(1,second,3));Require(store.ReadCommitted().Generation==2&&store.ReadPending()==null);Refuses(()=>store.Commit(1,second));
   }
   stage=5;using(var store=new UsbEnrollmentConfig(fixture)){
    var third=new UsbEnrollmentConfig.Snapshot(3,"S-1-5-21-111-222-333-1001",first.InternalSafety,new string[0]);Refuses(()=>store.CommitForTest(2,third,1));
   }
   Refuses(()=>{using(var failed=new UsbEnrollmentConfig(fixture)){} });
   Require(UsbEnrollmentConfig.ReadCommittedForRecovery(fixture).Generation==2);
   using(var recoveryOnly=new UsbAdmissionNativeStores(fixture)){Require(recoveryOnly.Read()==null);}
   string pending=Path.Combine(fixture,"enrollment.pending");File.Delete(pending); // Exact malformed test-owned stage only; no production auto-repair.
   stage=6;string committed=Path.Combine(fixture,"enrollment.bin");byte[] saved=File.ReadAllBytes(committed);byte[] damaged=(byte[])saved.Clone();damaged[damaged.Length-1]^=1;File.WriteAllBytes(committed,damaged);
   Refuses(()=>{using(var failed=new UsbEnrollmentConfig(fixture)){} });File.WriteAllBytes(committed,saved);
   stage=7;using(var store=new UsbEnrollmentConfig(fixture)){Require(store.ReadCommitted().Generation==2&&store.ReadCommitted().ApprovedExternal.Length==1);}
   stage=8;using(var stores=new UsbAdmissionNativeStores(fixture)){
    Require(stores.ReadCommitted().Generation==2&&stores.Read()==null);
    byte[] policy;using(var memory=new MemoryStream())using(var writer=new BinaryWriter(memory,Encoding.ASCII)){string id="USB\\SYNTHETIC\\PRIVATE";writer.Write(Encoding.ASCII.GetBytes("SNTINP03"));writer.Write((byte)1);writer.Write((byte)id.Length);writer.Write(Encoding.ASCII.GetBytes(id));writer.Flush();policy=memory.ToArray();}
    DateTime now=DateTime.UtcNow;var intent=new UsbAdmissionJournal.Record(new string('a',32),now,now.AddMinutes(2),new string('b',64),policy);stores.Arm(intent);
    // Recovery can reopen intent while the native operator/store adapter lives.
    using(var independent=new UsbAdmissionJournal(fixture)){Require(independent.Read().Nonce==intent.Nonce);}
    Exception readerFailure=null;UsbAdmissionJournal.Record observed=null;System.Threading.Thread reader;
    using(var held=new UsbAdmissionJournal(fixture)){
     reader=new System.Threading.Thread(()=>{try{observed=stores.Read();}catch(Exception error){readerFailure=error;}});reader.Start();System.Threading.Thread.Sleep(150);Require(reader.IsAlive);
    }
    Require(reader.Join(3000)&&readerFailure==null&&observed!=null&&observed.Nonce==intent.Nonce);
    stores.ClearAfterVerifiedRestore(intent.Nonce);Require(stores.Read()==null);
   }
   passed=true;
  }catch{passed=false;}
  finally{
   if(created)try{
    Require(Path.GetDirectoryName(fixture)==root&&(File.GetAttributes(fixture)&FileAttributes.ReparsePoint)==0);
    foreach(string name in new[]{"enrollment.bin","enrollment.pending",".enrollment.lock","admission.bin"}){string exact=Path.Combine(fixture,name);if(File.Exists(exact)){Require((File.GetAttributes(exact)&FileAttributes.ReparsePoint)==0);File.Delete(exact);}}
    if(fixturePin!=null){fixturePin.Dispose();fixturePin=null;}Directory.Delete(fixture,false);
   }catch{passed=false;stage=99;}
   if(fixturePin!=null)fixturePin.Dispose();if(basePin!=null)basePin.Dispose();if(passed)stage=0;try{Receipt(passed?"complete":"failed");}catch{passed=false;}
  }
  return passed?0:1;
 }
}
internal static class UsbEnrollmentConfigPureTest {static int Main(string[] args){if(args.Length!=0)return 2;try{UsbEnrollmentConfigTest.Pure();Console.WriteLine("Enrollment config pure validation PASS");return 0;}catch{return 1;}}}
