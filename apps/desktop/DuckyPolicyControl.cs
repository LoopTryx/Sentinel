using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.Win32;

public sealed class DuckyPolicyState {
 public string State,Title,Detail;
 public DuckyPolicyState(string state,string title,string detail){State=state;Title=title;Detail=detail;}
}
public static class DuckyPolicyControl {
 public static object Snapshot(){var state=Read();string target,nonce;string input=DuckyPolicyEnrollment.Read(out target,out nonce)?DuckyInputHealth.Read(target):"unavailable";return new{state=state.State,title=state.Title,detail=state.Detail,input};}
 public static string Failure(int code){switch(code){case 42:return "Previous recovery is unresolved. Keep the Ducky connected and use Allow first.";case 43:return "A block rule is still present or its namespace changed. Use Allow before another Block.";case 44:return "Windows policy refresh failed before blocking. No new block was armed.";case 45:return "Keep the Ducky connected while previous recovery is checked, then click Block. Reconnect only after Block armed appears.";case 21:return "Windows approval cancelled.";case 20:return "Windows is still processing. Outcome unknown; check device status before retrying.";case 40:return "The owned block entry could not be validated.";case 41:return "Release removed the rule, but Windows refresh or input recovery is incomplete. Reconnect the Ducky, then retry Allow.";case 31:return "The protected profile or recovery journal needs attention.";case 34:return "Independent automatic recovery test failed.";case 36:return "Automatic release could not be scheduled.";default:return "Device action failed at stage "+code+". No successful change is confirmed.";}}
 public static bool IsEnrolled(string root){string target,nonce;return DuckyPolicyEnrollment.Read(out target,out nonce)&&string.Equals(root,target,StringComparison.OrdinalIgnoreCase);}
 [DllImport("cfgmgr32.dll",CharSet=CharSet.Unicode)]static extern int CM_Locate_DevNode(out uint node,string id,int flags);
 [DllImport("cfgmgr32.dll")]static extern int CM_Get_DevNode_Status(out uint status,out uint problem,uint node,int flags);
 public static DuckyPolicyState Read(){
  try{using(var key=Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Policies\Microsoft\Windows\DeviceInstall\Restrictions")){
   string enrolledTarget,enrolledNonce;
   if(!DuckyPolicyEnrollment.Read(out enrolledTarget,out enrolledNonce))return new DuckyPolicyState("unavailable","Profile not ready","The enrolled device needs native setup before this control is available.");
   if(key==null)return new DuckyPolicyState("off","Hold off","Only the enrolled Ducky can be controlled.");
   using(var list=key.OpenSubKey("DenyInstanceIDs")){
    string target=list==null?null:list.GetValue("1",null) as string;
    if(target==null)return new DuckyPolicyState("off","Hold off","Reconnect the Ducky after releasing a hold.");
    string nonce=key.GetValue("SentinelOperation",null) as string;
    if(target!=enrolledTarget||nonce!=enrolledNonce||key.ValueCount!=3||key.SubKeyCount!=1||list.ValueCount!=1||list.SubKeyCount!=0||list.GetValueKind("1")!=RegistryValueKind.String||key.GetValueKind("SentinelOperation")!=RegistryValueKind.String||key.GetValueKind("DenyInstanceIDs")!=RegistryValueKind.DWord||key.GetValueKind("DenyInstanceIDsRetroactive")!=RegistryValueKind.DWord||Convert.ToInt32(key.GetValue("DenyInstanceIDsRetroactive",0))!=1)return new DuckyPolicyState("unavailable","Policy changed","Windows policy does not match the enrolled device.");
    if(!Regex.IsMatch(nonce??"",@"\A[0-9a-f]{32}\z")||!Regex.IsMatch(target,@"\AUSB\\VID_[0-9A-Fa-f]{4}&PID_[0-9A-Fa-f]{4}\\[A-Za-z0-9&_.-]{1,160}\z")||Convert.ToInt32(key.GetValue("DenyInstanceIDs",0))!=1)return new DuckyPolicyState("unavailable","Policy unavailable","Windows policy does not match this control.");
    uint node,status,problem;
    if(CM_Locate_DevNode(out node,target,0)==0&&CM_Get_DevNode_Status(out status,out problem,node,0)==0&&problem==28)return new DuckyPolicyState("driver_unavailable","Device driver unavailable","Hold is armed; Windows reports no installed driver for the enrolled device.");
    return new DuckyPolicyState("armed","Hold armed","The enrolled Ducky is restricted. Reconnect it to check installation.");
   }
  }}catch{return new DuckyPolicyState("unavailable","Status unavailable","Windows device policy could not be read.");}
 }
 public static Task<int> Execute(string action){
  if(action!="hold"&&action!="release")throw new ArgumentException("Invalid device action");
  return Task.Run(()=>{
   try{string executable=VaultApproval.ResolveExecutable(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"Sentinel.DuckyPolicy.exe"));
    using(var process=Process.Start(new ProcessStartInfo(executable,action){UseShellExecute=true,Verb="runas",WorkingDirectory=Path.GetDirectoryName(executable),WindowStyle=ProcessWindowStyle.Hidden})){
     if(!process.WaitForExit(120000))return 20;return process.ExitCode;
    }
   }catch(System.ComponentModel.Win32Exception e){return e.NativeErrorCode==1223?21:18;}catch{return 18;}
  });
 }
}
