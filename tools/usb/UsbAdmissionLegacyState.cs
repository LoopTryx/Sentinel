using System;
using System.IO;
using System.Security.AccessControl;
using System.Security.Principal;
using Microsoft.Win32;

// Protected read-only legacy baseline binding. This never removes old policy.
internal static class UsbAdmissionLegacyState {
 const string Policy=@"SOFTWARE\Policies\Microsoft\Windows\DeviceInstall\Restrictions";
 static bool Trusted(IdentityReference sid){return sid.Value=="S-1-5-18"||sid.Value=="S-1-5-32-544";}
 static void Check(FileSystemSecurity acl){if(!acl.AreAccessRulesProtected||!Trusted(acl.GetOwner(typeof(SecurityIdentifier))))throw new InvalidOperationException("Legacy baseline access refused");foreach(FileSystemAccessRule rule in acl.GetAccessRules(true,true,typeof(SecurityIdentifier)))if(rule.AccessControlType==AccessControlType.Allow&&!Trusted(rule.IdentityReference))throw new InvalidOperationException("Legacy baseline access refused");}
 internal static UsbLegacyReleasedBaseline.Lease Acquire(string directory,bool mayCapture){
#if SENTINEL_USB_ADMISSION_PRIVATE_QUALIFICATION
  return null;
#else
  using(var pin=new SentinelPolicyDirectory(directory)){
   Check(Directory.GetAccessControl(directory));string path=Path.Combine(directory,"legacy-baseline.bin");
   if(File.Exists(path)){
    if((File.GetAttributes(path)&FileAttributes.ReparsePoint)!=0)throw new InvalidOperationException("Legacy baseline reparse refused");
    using(var file=new FileStream(path,FileMode.Open,FileAccess.Read,FileShare.Read)){Check(file.GetAccessControl());if(file.Length!=104)throw new InvalidOperationException("Legacy baseline length refused");var bytes=new byte[104];int offset=0;while(offset<bytes.Length){int count=file.Read(bytes,offset,bytes.Length-offset);if(count==0)throw new IOException("Legacy baseline read failed");offset+=count;}return UsbLegacyReleasedBaseline.Acquire(bytes);}
   }
   using(var key=Registry.LocalMachine.OpenSubKey(Policy))if(key==null||key.GetValue("SentinelOperation",null)==null)return null;
   if(!mayCapture)throw new InvalidOperationException("Legacy baseline binding missing");
   var lease=UsbLegacyReleasedBaseline.Acquire(null);try{
    UsbLegacyReleasedBaseline.ValidateReleasedValues(Registry.LocalMachine,Policy,lease.Nonce);
    var security=new FileSecurity();security.SetOwner(new SecurityIdentifier(WellKnownSidType.BuiltinAdministratorsSid,null));security.SetAccessRuleProtection(true,false);foreach(var kind in new[]{WellKnownSidType.BuiltinAdministratorsSid,WellKnownSidType.LocalSystemSid})security.AddAccessRule(new FileSystemAccessRule(new SecurityIdentifier(kind,null),FileSystemRights.FullControl,AccessControlType.Allow));
    byte[] binding=lease.Binding;using(var file=new FileStream(path,FileMode.CreateNew,FileSystemRights.Read|FileSystemRights.Write,FileShare.None,4096,FileOptions.WriteThrough,security)){Check(file.GetAccessControl());file.Write(binding,0,binding.Length);file.Flush(true);}
    lease.Check();return lease;
   }catch{lease.Dispose();throw;}
  }
#endif
 }
}
