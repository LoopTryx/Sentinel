using System;using System.IO;using System.Diagnostics;using System.Security.Principal;using System.Threading;
internal static class UsbExactBlockPrivateQualification {
 static readonly string Root=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),"SentinelExactBlockQualification");
 static readonly string A=@"USB\VID_0001&PID_0001&MI_00\SENTINEL_SYNTHETIC_A",B=@"USB\VID_0001&PID_0002&MI_00\SENTINEL_SYNTHETIC_B";
 static void Check(bool value){if(!value)throw new InvalidOperationException("Private exact-block assertion failed");}
 static bool Refused(Action action){try{action();return false;}catch(InvalidOperationException){return true;}}
 static void Provision(string path){SentinelPolicyDirectory.Provision(path);}
 static string PathFor(string nonce){if(!System.Text.RegularExpressions.Regex.IsMatch(nonce??"",@"\A[0-9a-f]{32}\z"))throw new ArgumentException();return Path.Combine(Root,nonce);}
 static UsbExactBlockState.Request Request(string action,UsbExactBlockState.Snapshot before,string[] next,string[] targets){var now=DateTime.UtcNow;string owner=WindowsIdentity.GetCurrent().User.Value;return new UsbExactBlockState.Request(action,before,new UsbExactBlockState.Snapshot(before==null?1:before.Generation+1,owner,next),targets,Guid.NewGuid().ToString("N"),new string('a',64),now,now.AddMinutes(5));}
 static void Verified(UsbExactBlockFileStore store,UsbExactBlockState.Request r){store.WritePrepared(r);store.AdvancePending(r.Digest,UsbExactBlockState.Stage.Prepared,UsbExactBlockState.Stage.RecoveryArmed);store.AdvancePending(r.Digest,UsbExactBlockState.Stage.RecoveryArmed,UsbExactBlockState.Stage.Applied);store.AdvancePending(r.Digest,UsbExactBlockState.Stage.Applied,UsbExactBlockState.Stage.PolicyVerified);}
 static void Child(string args){using(var process=Process.Start(new ProcessStartInfo(System.Reflection.Assembly.GetExecutingAssembly().Location,args){UseShellExecute=false,CreateNoWindow=true})){if(!process.WaitForExit(15000)){process.Kill();throw new TimeoutException("Private readback child timeout");}Check(process.ExitCode==0);}}
 static void Files(string nonce){string path=PathFor(nonce);Provision(path);var first=Request("block",null,new[]{A},new[]{A});
  using(var store=new UsbExactBlockFileStore(path)){Verified(store,first);store.CommitCandidate(first.Digest,null,first.After);store.AdvancePending(first.Digest,UsbExactBlockState.Stage.PolicyVerified,UsbExactBlockState.Stage.Committed);store.RetirePending(first.Digest);}
  Child("--read-state "+nonce+" "+first.After.Digest);Console.WriteLine("PASS actual protected file commit survives a fresh process; no reboot claim");
  using(var store=new UsbExactBlockFileStore(path)){Check(UsbExactBlockState.Same(store.ReadCommitted(),first.After));var next=Request("block",first.After,new[]{A,B},new[]{B});Verified(store,next);Check(UsbExactBlockState.Same(store.ClaimRecovery(next.Digest),first.After));Check(Refused(()=>store.CommitCandidate(next.Digest,first.After,next.After)));store.RetirePending(next.Digest);Check(UsbExactBlockState.Same(store.ReadCommitted(),first.After));
   var release=Request("allow",first.After,new string[0],new[]{A});Verified(store,release);store.CommitCandidate(release.Digest,first.After,release.After);Check(UsbExactBlockState.Same(store.ClaimRecovery(release.Digest),release.After));store.RetirePending(release.Digest);Check(UsbExactBlockState.Same(store.ReadCommitted(),release.After));}
  Console.WriteLine("PASS actual file claim fences late commit; post-commit recovery preserves the candidate and empty final block set");
 }
 static void Refresh(){using(var process=Process.Start(new ProcessStartInfo(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),"gpupdate.exe"),"/target:computer /force /wait:30"){UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true})){process.OutputDataReceived+=delegate{};process.ErrorDataReceived+=delegate{};process.BeginOutputReadLine();process.BeginErrorReadLine();if(!process.WaitForExit(35000)){process.Kill();throw new TimeoutException("Private policy refresh timeout");}process.WaitForExit();Check(process.ExitCode==0);}}
 static void Policy(string nonce){string path=@"SOFTWARE\Sentinel\ExactBlockQualification\"+nonce;var provider=new UsbExactBlockGpo(path,nonce,()=>{});var empty=UsbExactBlockGpo.Empty();var one=UsbExactBlockGpo.Desired(1,new string('b',64),new[]{A});provider.Verify(empty);
  try{provider.WriteSaved(empty,one,one,false);Refresh();provider.VerifyEffective(one);provider.FinalizeSaved(empty,one,one);Refresh();provider.Verify(one);Child("--read-policy "+nonce);Console.WriteLine("PASS actual private saved/effective exact policy survives fresh-process readback; DeviceInstall policy untouched");
   provider.WriteSaved(one,empty,empty,false);Refresh();provider.VerifyEffective(empty);provider.FinalizeSaved(one,empty,empty);Refresh();provider.Verify(empty);provider.DeleteEmptyPrivateProbe();Console.WriteLine("PASS actual private final-entry removal and verified cleanup");
  }catch{Console.WriteLine("Private probe recovery required; nonce is retained in protected run receipt.");throw;}
 }
 static void LegacyPolicy(string nonce){string path=@"SOFTWARE\Sentinel\ExactBlockQualification\"+nonce;string baseline=Guid.NewGuid().ToString("N");var provider=new UsbExactBlockGpo(path,nonce,()=>{},baseline);var empty=UsbExactBlockGpo.Empty();var one=provider.Managed(UsbExactBlockGpo.Desired(1,new string('c',64),new[]{A}));var both=provider.Managed(UsbExactBlockGpo.Desired(2,new string('d',64),new[]{A,B}));var second=provider.Managed(UsbExactBlockGpo.Desired(3,new string('e',64),new[]{B}));
  using(var key=Microsoft.Win32.Registry.LocalMachine.CreateSubKey(path)){key.SetValue("SentinelOperation",baseline);key.SetValue("DenyInstanceIDs",1);key.SetValue("DenyInstanceIDsRetroactive",1);key.CreateSubKey("DenyInstanceIDs").Dispose();}
  provider.Verify(empty);var current=empty;
  foreach(var next in new[]{one,both,second,empty}){provider.WriteSaved(current,next,next,false);Refresh();provider.VerifyEffective(next);provider.FinalizeSaved(current,next,next);Refresh();provider.Verify(next);current=next;}
  provider.DeleteEmptyPrivateProbe();provider.Verify(empty);Microsoft.Win32.Registry.LocalMachine.DeleteSubKeyTree(path,false);Console.WriteLine("PASS actual private legacy baseline preserved through two blocks, allow-one and allow-last; no live-policy claim");
 }
 [STAThread]static int Main(string[] args){
  if(!new WindowsPrincipal(WindowsIdentity.GetCurrent()).IsInRole(WindowsBuiltInRole.Administrator))return 3;DuckyWorkerJob.AttachCurrentWorker();
  if(args.Length==3&&args[0]=="--read-state"){using(var store=new UsbExactBlockFileStore(PathFor(args[1]))){var state=store.ReadCommitted();return state!=null&&state.Digest==args[2]&&store.ReadPending()==null?0:1;}}
  if(args.Length==2&&args[0]=="--read-policy"){string path=@"SOFTWARE\Sentinel\ExactBlockQualification\"+args[1];var provider=new UsbExactBlockGpo(path,args[1],()=>{});provider.Verify(UsbExactBlockGpo.Desired(1,new string('b',64),new[]{A}));return 0;}
  if(args.Length!=1||args[0]!="--private")return 2;string nonce=Guid.NewGuid().ToString("N");
  try{
   Provision(Root);using(var rootPin=new UsbExactBlockFileStore(Root)){
    string run=PathFor(nonce);Provision(run);using(var runPin=new UsbExactBlockFileStore(run)){
     using(var receipt=new FileStream(Path.Combine(run,"run.txt"),FileMode.CreateNew,FileAccess.Write,FileShare.Read)){byte[] bytes=System.Text.Encoding.ASCII.GetBytes(nonce);receipt.Write(bytes,0,bytes.Length);receipt.Flush(true);}
     Files(nonce);Policy(nonce);LegacyPolicy(nonce);Console.WriteLine("PASS native private exact-block file/GPO qualification; no device actions and no reboot trial");return 0;
    }
   }
  }catch(Exception error){Console.WriteLine("FAIL private exact qualification category="+error.GetType().Name+" hresult="+error.HResult.ToString("X8"));return 1;}
 }
}
