using System;
using System.Diagnostics;
using System.Security.Principal;
using System.Text.RegularExpressions;
using System.IO;
using Microsoft.Win32;
// Fixed benign native qualification. No device IDs/paths/scripts accepted.
public static class DuckyGpoProbeHost {
 static void Refresh(){
  using(var p=Process.Start(new ProcessStartInfo(System.IO.Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),"gpupdate.exe"),"/target:computer /force /wait:30"){UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true})){
   var output=p.StandardOutput.ReadToEndAsync();var error=p.StandardError.ReadToEndAsync();
   if(!p.WaitForExit(45000)||p.ExitCode!=0)throw new InvalidOperationException("Private policy refresh failed");
  }
 }
 static bool LiveRuleAbsent(){using(var key=Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Policies\Microsoft\Windows\DeviceInstall\Restrictions\DenyInstanceIDs"))return key==null||key.ValueCount==0;}
 const string Receipt=@"SOFTWARE\Sentinel\DuckyGpoProbeReceipt";
 static void Record(string nonce,int stage,string state){using(var key=Registry.LocalMachine.CreateSubKey(Receipt)){key.SetValue("Nonce",nonce,RegistryValueKind.String);key.SetValue("Stage",stage,RegistryValueKind.DWord);key.SetValue("State",state,RegistryValueKind.String);key.Flush();}}
 public static int Main(string[] args){
  if(args.Length!=0)return 10;
  if(!new WindowsPrincipal(WindowsIdentity.GetCurrent()).IsInRole(WindowsBuiltInRole.Administrator))return 11;
  if(Process.GetProcessesByName("mmc").Length!=0||!LiveRuleAbsent())return 12;
  using(var receipt=Registry.LocalMachine.OpenSubKey(Receipt)){
   if(receipt!=null&&(string)receipt.GetValue("State","")!="complete"){
    string pending=receipt.GetValue("Nonce",null) as string;
    if(!Regex.IsMatch(pending??"",@"\A[0-9a-f]{32}\z"))return 14;
    try{SentinelDuckyLocalGpo.EditPrivateProbe(pending,false);Refresh();Record(pending,0,"complete");return 0;}catch{return 29;}
   }
  }
  string nonce=Guid.NewGuid().ToString("N"),before,after;bool touched=false;int stage=20,result=0;
  try{
   if(SentinelDuckyLocalGpo.PrivateProbeState(nonce,out before)!="missing")return 13;
   stage=21;Record(nonce,stage,"pending");touched=true;SentinelDuckyLocalGpo.EditPrivateProbe(nonce,true);
   stage=22;if(SentinelDuckyLocalGpo.PrivateProbeState(nonce,out after)!="armed"||before!=after)throw new InvalidOperationException("Saved private policy not preserved");
   stage=23;Refresh();
   using(var list=Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Sentinel\DuckyGpoProbe\"+nonce+@"\DenyInstanceIDs"))if(list==null||(string)list.GetValue("1",null)!=@"USB\VID_0001&PID_0001\PRIVATE-PROBE")throw new InvalidOperationException("Private policy not applied");
   stage=24;Record(nonce,stage,"pending");SentinelDuckyLocalGpo.EditPrivateProbe(nonce,false);
   stage=25;if(SentinelDuckyLocalGpo.PrivateProbeState(nonce,out after)!="released"||before!=after)throw new InvalidOperationException("Saved release not preserved");
   stage=26;Refresh();
   using(var list=Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Sentinel\DuckyGpoProbe\"+nonce+@"\DenyInstanceIDs"))if(list!=null&&list.GetValue("1",null)!=null)throw new InvalidOperationException("Private release not applied");
   stage=27;Record(nonce,stage,"pending");bool expected=false;
   try{SentinelDuckyLocalGpo.PrivateUncertainSaveProbe(nonce);}catch(Exception e){expected=e.ToString().Contains("Injected after real saved policy commit");}
   if(!expected||SentinelDuckyLocalGpo.PrivateProbeState(nonce,out after)!="armed"||before!=after)throw new InvalidOperationException("Uncertain save was not verified in fresh session");
   stage=28;SentinelDuckyLocalGpo.EditPrivateProbe(nonce,false);Refresh();
   if(SentinelDuckyLocalGpo.PrivateProbeState(nonce,out after)!="released"||before!=after)throw new InvalidOperationException("Uncertain save recovery not persisted");
   using(var list=Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Sentinel\DuckyGpoProbe\"+nonce+@"\DenyInstanceIDs"))if(list!=null&&list.GetValue("1",null)!=null)throw new InvalidOperationException("Uncertain save recovery not applied");
   if(!LiveRuleAbsent())throw new InvalidOperationException("Device policy changed externally");
   stage=30;string entrySource,gpoSource;
   using(var reader=new StreamReader(typeof(DuckyPolicyHost).Assembly.GetManifestResourceStream("Sentinel.Ducky.Entry")))entrySource="#define SENTINEL_DUCKY_POLICY_LAB\n"+reader.ReadToEnd();
   using(var reader=new StreamReader(typeof(DuckyPolicyHost).Assembly.GetManifestResourceStream("Sentinel.Ducky.Gpo")))gpoSource=reader.ReadToEnd();
   DuckyPolicyHost.QualifySavedRecovery(entrySource,gpoSource);
  }catch{result=stage;}
  finally{
   if(touched){try{SentinelDuckyLocalGpo.EditPrivateProbe(nonce,false);Refresh();Record(nonce,result,result==0?"complete":"recovered");}catch{Record(nonce,29,"pending");result=29;}}
  }
  return result;
 }
}
