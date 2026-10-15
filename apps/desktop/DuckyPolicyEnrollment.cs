using System;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Text.RegularExpressions;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;
using Microsoft.Win32;

// Machine metadata is readable, never writable, by the normal desktop process.
public static class DuckyPolicyEnrollment {
 const string Path=@"SOFTWARE\Sentinel\DuckyProfile";
 [StructLayout(LayoutKind.Sequential)]struct Security{public int size;public IntPtr descriptor;public int inherit;}
 [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern bool ConvertStringSecurityDescriptorToSecurityDescriptor(string s,uint revision,out IntPtr descriptor,out uint size);
 [DllImport("kernel32.dll")]static extern IntPtr LocalFree(IntPtr pointer);
 [DllImport("advapi32.dll",CharSet=CharSet.Unicode)]static extern int RegCreateKeyEx(IntPtr root,string path,int reserved,string cls,int options,int access,ref Security security,out IntPtr key,out int disposition);
 static void Access(RegistryKey key){
  var acl=key.GetAccessControl();string owner=acl.GetOwner(typeof(SecurityIdentifier)).Value;
  if(owner!="S-1-5-18"&&owner!="S-1-5-32-544")throw new InvalidOperationException("Untrusted profile owner");
  foreach(RegistryAccessRule rule in acl.GetAccessRules(true,true,typeof(SecurityIdentifier))){
   if(rule.AccessControlType==AccessControlType.Allow && rule.IdentityReference.Value!="S-1-5-18"&&rule.IdentityReference.Value!="S-1-5-32-544"&&(rule.RegistryRights&(RegistryRights.SetValue|RegistryRights.CreateSubKey|RegistryRights.Delete|RegistryRights.ChangePermissions|RegistryRights.TakeOwnership))!=0)throw new InvalidOperationException("Writable profile metadata");
  }
 }
 public static bool Read(out string target,out string nonce){
  target=null;nonce=null;
  using(var key=Registry.LocalMachine.OpenSubKey(Path)){
   if(key==null)return false;Access(key);
   if(key.ValueCount!=2||key.SubKeyCount!=0||key.GetValueKind("Target")!=RegistryValueKind.String||key.GetValueKind("Nonce")!=RegistryValueKind.String)return false;
   target=key.GetValue("Target") as string;nonce=key.GetValue("Nonce") as string;
   return Regex.IsMatch(target??"",@"\AUSB\\VID_[0-9A-Fa-f]{4}&PID_[0-9A-Fa-f]{4}\\[A-Za-z0-9&_.-]{1,160}\z")&&Regex.IsMatch(nonce??"",@"\A[0-9a-f]{32}\z");
  }
 }
 public static void Publish(string target,string nonce){
  string oldTarget,oldNonce;
  using(var existing=Registry.LocalMachine.OpenSubKey(Path)){if(existing!=null){Access(existing);if(!Read(out oldTarget,out oldNonce)||oldTarget!=target||oldNonce!=nonce)throw new InvalidOperationException("Profile metadata changed");return;}}
  IntPtr descriptor;uint size;if(!ConvertStringSecurityDescriptorToSecurityDescriptor("O:BAG:BAD:P(A;CI;KA;;;SY)(A;CI;KA;;;BA)(A;CI;KR;;;BU)",1,out descriptor,out size))throw new InvalidOperationException("Profile security unavailable");
  try{
   Security security=new Security{size=Marshal.SizeOf(typeof(Security)),descriptor=descriptor,inherit=0};IntPtr handle;int disposition;
   int code=RegCreateKeyEx(new IntPtr(unchecked((int)0x80000002)),Path,0,null,0,0x2001f|0x100,ref security,out handle,out disposition);
   if(code!=0)throw new System.ComponentModel.Win32Exception(code,"Profile creation failed");
   using(var key=RegistryKey.FromHandle(new SafeRegistryHandle(handle,true),RegistryView.Registry64)){
   if(disposition!=1)throw new InvalidOperationException("Profile namespace raced; no changes allowed");
   if(key.ValueCount!=0||key.SubKeyCount!=0)throw new InvalidOperationException("Profile namespace occupied");
   key.SetValue("Target",target,RegistryValueKind.String);key.SetValue("Nonce",nonce,RegistryValueKind.String);key.Flush();
   }
  }finally{LocalFree(descriptor);}
 }
}
