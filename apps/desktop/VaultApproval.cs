using System;
using System.Diagnostics;
using System.IO;
using System.Text.RegularExpressions;
using System.Security.Principal;
using Microsoft.Win32;
using System.Threading;
public sealed class PasswordActionLease : IDisposable {
 readonly Semaphore gate;bool acquired;
 PasswordActionLease(Semaphore gate){this.gate=gate;acquired=true;}
 public static PasswordActionLease TryAcquire(){var gate=new Semaphore(1,1,"Local\\SentinelPasswordAction");if(!gate.WaitOne(0)){gate.Dispose();return null;}return new PasswordActionLease(gate);}
 public void Dispose(){if(acquired){acquired=false;gate.Release();gate.Dispose();}}
}
public static class VaultApproval {
 public static bool Approve(string operation,string id) {
  if((operation!="copy"&&operation!="rotate"&&operation!="view"&&operation!="add"&&operation!="remove"&&operation!="update")||!Regex.IsMatch(id??"","^[a-zA-Z0-9_-]{1,64}$"))return false;
  try {
   if(new WindowsPrincipal(WindowsIdentity.GetCurrent()).IsInRole(WindowsBuiltInRole.Administrator))return false;
   using(var policy=Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System")) {
    if(policy==null||Convert.ToInt32(policy.GetValue("EnableLUA",0))!=1||Convert.ToInt32(policy.GetValue("ConsentPromptBehaviorAdmin",0))==0)return false;
   }
   var elapsed=Stopwatch.StartNew();
   using(var process=Process.Start(new ProcessStartInfo(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"Sentinel.PasswordApproval.exe"),operation+" "+id){UseShellExecute=true,Verb="runas",WindowStyle=ProcessWindowStyle.Hidden})) {
    int remaining=60000-(int)Math.Min(60000,elapsed.ElapsedMilliseconds);
    if(remaining<=0||!process.WaitForExit(remaining)){try{process.Kill();}catch{}return false;}return process.ExitCode==0;
   }
  }catch{return false;}
 }
}
