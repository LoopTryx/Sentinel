using System;
using System.Runtime.InteropServices;
using System.Text.RegularExpressions;
using Microsoft.Win32;
using Microsoft.Win32.SafeHandles;

// Private qualification adapter. Live device policy remains disabled in this build.
public static class SentinelDuckyEntry {
 [DllImport("advapi32.dll",CharSet=CharSet.Unicode)] static extern int RegCreateKeyEx(IntPtr root,string path,int reserved,string cls,int options,int access,IntPtr security,out IntPtr key,out int disposition);
 static void Validate(string path,string target,string nonce){
  if(nonce==null || !Regex.IsMatch(nonce,@"\A[0-9a-f]{32}\z"))throw new ArgumentException("Invalid nonce");
  if(target==null || !Regex.IsMatch(target,@"\AUSB\\VID_[0-9A-Fa-f]{4}&PID_[0-9A-Fa-f]{4}\\[A-Za-z0-9&_.-]{1,160}\z"))throw new ArgumentException("Invalid exact target");
  bool permitted=path=="SOFTWARE\\Sentinel\\DuckyPolicyProbe\\"+nonce;
#if SENTINEL_DUCKY_POLICY_LAB
  permitted=permitted || path=="SOFTWARE\\Policies\\Microsoft\\Windows\\DeviceInstall\\Restrictions";
#endif
  if(!permitted)throw new InvalidOperationException("Live policy unqualified; private probe only");
 }
 static RegistryKey Base(bool machine){return RegistryKey.OpenBaseKey(machine?RegistryHive.LocalMachine:RegistryHive.CurrentUser,RegistryView.Registry64);}
 static void Fault(int fail,int step){if(fail==step)throw new InvalidOperationException("Injected entry stage "+step);}
 public static void Apply(string path,string target,string nonce,bool machine,int fail){
  Validate(path,target,nonce);if(fail<0 || fail>5)throw new ArgumentException("Invalid failure stage");
  if(path.StartsWith("SOFTWARE\\Policies\\",StringComparison.Ordinal) && !machine)throw new InvalidOperationException("Machine hive required");
  using(RegistryKey hive=Base(machine)){
   IntPtr handle;int disposition;
   int code=RegCreateKeyEx(new IntPtr(machine ? unchecked((int)0x80000002) : unchecked((int)0x80000001)),path,0,null,0,0x2001f|0x100,IntPtr.Zero,out handle,out disposition);
   if(code!=0)throw new System.ComponentModel.Win32Exception(code,"Private probe create failed");
   using(RegistryKey key=RegistryKey.FromHandle(new SafeRegistryHandle(handle,true),RegistryView.Registry64)){
    if(disposition!=1)throw new InvalidOperationException("Existing namespace; apply refused");
    Fault(fail,1);
    key.SetValue("SentinelOperation",nonce,RegistryValueKind.String);key.Flush();Fault(fail,2);
    using(RegistryKey list=key.CreateSubKey("DenyInstanceIDs",true)){
     list.SetValue("1",target,RegistryValueKind.String);list.Flush();Fault(fail,3);
    }
    key.SetValue("DenyInstanceIDsRetroactive",1,RegistryValueKind.DWord);key.Flush();Fault(fail,4);
    key.SetValue("DenyInstanceIDs",1,RegistryValueKind.DWord);key.Flush();Fault(fail,5);
   }
  }
 }
 public static void Restore(string path,string target,string nonce,bool machine){
  Validate(path,target,nonce);
  if(path.StartsWith("SOFTWARE\\Policies\\",StringComparison.Ordinal) && !machine)throw new InvalidOperationException("Machine hive required");
  using(RegistryKey hive=Base(machine))using(RegistryKey key=hive.OpenSubKey(path,true)){
   if(key==null)return;
   using(RegistryKey list=key.OpenSubKey("DenyInstanceIDs",true)){
    if(list==null || list.GetValue("1",null)==null)return;
    if(key.GetValueKind("SentinelOperation")!=RegistryValueKind.String || (string)key.GetValue("SentinelOperation")!=nonce)throw new InvalidOperationException("Ownership drift; recovery uncertain");
    if(list.GetValueKind("1")!=RegistryValueKind.String || (string)list.GetValue("1")!=target)throw new InvalidOperationException("Target drift; recovery uncertain");
    // Delete exactly the owned entry. Never delete a key or change global flags.
    list.DeleteValue("1",true);list.Flush();
    if(list.GetValue("1",null)!=null)throw new InvalidOperationException("Owned entry reappeared; recovery uncertain");
   }
  }
 }
 public static void Arm(string path,string target,string nonce,bool machine,DateTime deadline){
  Validate(path,target,nonce);
  if(path.StartsWith("SOFTWARE\\Policies\\",StringComparison.Ordinal) && !machine)throw new InvalidOperationException("Machine hive required");
  if(deadline.Kind!=DateTimeKind.Utc || deadline<=DateTime.UtcNow || deadline>DateTime.UtcNow.AddMinutes(6))throw new InvalidOperationException("Invalid arm deadline");
  using(RegistryKey hive=Base(machine))using(RegistryKey key=hive.OpenSubKey(path,true)){
   if(key==null || key.GetValueNames().Length!=3 || key.SubKeyCount!=1 || key.GetValueKind("SentinelOperation")!=RegistryValueKind.String || (string)key.GetValue("SentinelOperation")!=nonce || key.GetValueKind("DenyInstanceIDs")!=RegistryValueKind.DWord || (int)key.GetValue("DenyInstanceIDs")!=1 || key.GetValueKind("DenyInstanceIDsRetroactive")!=RegistryValueKind.DWord || (int)key.GetValue("DenyInstanceIDsRetroactive")!=1)throw new InvalidOperationException("Profile policy changed; arm refused");
   using(RegistryKey list=key.OpenSubKey("DenyInstanceIDs",true)){
    if(list==null || list.ValueCount!=0 || list.SubKeyCount!=0)throw new InvalidOperationException("Existing deny entries; arm refused");
    if(deadline<=DateTime.UtcNow)throw new InvalidOperationException("Invalid arm deadline");
    list.SetValue("1",target,RegistryValueKind.String);list.Flush();
   }
  }
  if(deadline<=DateTime.UtcNow){Restore(path,target,nonce,machine);throw new InvalidOperationException("Arm deadline elapsed");}
 }
}
