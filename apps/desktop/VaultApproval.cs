using System;
using System.Diagnostics;
using System.IO;
using System.Text.RegularExpressions;
using System.Security.Principal;
using Microsoft.Win32;
using System.Threading;
using System.Runtime.InteropServices;
using System.Text;
using System.ComponentModel;
public sealed class PasswordActionLease : IDisposable {
 readonly Semaphore gate;bool acquired;
 PasswordActionLease(Semaphore gate){this.gate=gate;acquired=true;}
 public static PasswordActionLease TryAcquire(){var gate=new Semaphore(1,1,"Local\\SentinelPasswordAction");if(!gate.WaitOne(0)){gate.Dispose();return null;}return new PasswordActionLease(gate);}
 public void Dispose(){if(acquired){acquired=false;gate.Release();gate.Dispose();}}
}
public static class VaultApproval {
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern uint GetFinalPathNameByHandle(IntPtr handle,StringBuilder path,uint size,uint flags);
 public static string LastError {get;private set;}
 public static string ResolveExecutable(string path){
  using(var file=new FileStream(path,FileMode.Open,FileAccess.Read,FileShare.ReadWrite|FileShare.Delete)){
   var buffer=new StringBuilder(32768);uint count=GetFinalPathNameByHandle(file.SafeFileHandle.DangerousGetHandle(),buffer,(uint)buffer.Capacity,0);
   if(count==0||count>=buffer.Capacity)throw new IOException("Approval helper path unavailable.");
   string physical=buffer.ToString();if(physical.StartsWith(@"\\?\"))physical=physical.Substring(4);
   if(!Regex.IsMatch(physical,@"^[A-Za-z]:\\"))throw new IOException("Local approval helper required.");return physical;
  }
 }
 public static bool Approve(string operation,string id) {
  LastError="Windows approval declined or unavailable.";
  if((operation!="copy"&&operation!="rotate"&&operation!="view"&&operation!="add"&&operation!="remove"&&operation!="update")||!Regex.IsMatch(id??"","^[a-zA-Z0-9_-]{1,64}$"))return false;
  try {
   if(new WindowsPrincipal(WindowsIdentity.GetCurrent()).IsInRole(WindowsBuiltInRole.Administrator)){LastError="Restart Sentinel without Run as administrator to request approval.";return false;}
   using(var policy=Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System")) {
    if(policy==null||Convert.ToInt32(policy.GetValue("EnableLUA",0))!=1||Convert.ToInt32(policy.GetValue("ConsentPromptBehaviorAdmin",0))==0)return false;
   }
   string executable=ResolveExecutable(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"Sentinel.PasswordApproval.exe"));
   var elapsed=Stopwatch.StartNew();
   using(var process=Process.Start(new ProcessStartInfo(executable,operation+" "+id){UseShellExecute=true,Verb="runas",WorkingDirectory=Path.GetDirectoryName(executable),WindowStyle=ProcessWindowStyle.Hidden})) {
    int remaining=60000-(int)Math.Min(60000,elapsed.ElapsedMilliseconds);
    if(remaining<=0||!process.WaitForExit(remaining)){try{process.Kill();}catch{}return false;}return process.ExitCode==0;
   }
  }catch(Win32Exception e){LastError=e.NativeErrorCode==1223?"Windows approval declined.":"Windows approval could not open (error "+e.NativeErrorCode+").";return false;}catch(IOException){LastError="Windows approval helper is missing or inaccessible. Reinstall Sentinel.";return false;}catch{return false;}
 }
}
