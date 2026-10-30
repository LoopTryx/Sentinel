using System;
using System.IO;
using System.Text;
using System.Collections.Generic;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Security.Cryptography;
using System.Runtime.InteropServices;

// Read-only discovery. Installation presence is not enforcement qualification.
internal static class UsbHidAdmissionCapability {
 internal static string Root{get{return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),"SentinelHidAdmission");}}
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern uint GetFinalPathNameByHandle(IntPtr handle,StringBuilder path,uint size,uint flags);
 [StructLayout(LayoutKind.Sequential)]struct FileInfoNative{public uint Attributes;public System.Runtime.InteropServices.ComTypes.FILETIME Creation,Access,Write;public uint Volume,SizeHigh,SizeLow,Links,IndexHigh,IndexLow;}
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool GetFileInformationByHandle(IntPtr handle,out FileInfoNative info);
 static void Require(bool value){if(!value)throw new InvalidOperationException("Protected exact USB runtime refused");}
 static bool Trusted(string sid){return sid=="S-1-5-18"||sid=="S-1-5-32-544";}
 internal static void CheckSecurity(FileSystemSecurity security,bool isolated){
  Require(security.AreAccessRulesProtected&&Trusted(security.GetOwner(typeof(SecurityIdentifier)).Value));bool sy=false,ba=false,bu=false;
  foreach(FileSystemAccessRule rule in security.GetAccessRules(true,true,typeof(SecurityIdentifier))){
   Require(rule.AccessControlType==AccessControlType.Allow);string sid=rule.IdentityReference.Value;
   if(Trusted(sid)){bool full=(rule.FileSystemRights&FileSystemRights.FullControl)==FileSystemRights.FullControl;if(sid=="S-1-5-18")sy|=full;else ba|=full;}
   else{Require(!isolated&&sid=="S-1-5-32-545"&&(rule.FileSystemRights&~(FileSystemRights.ReadAndExecute|FileSystemRights.Synchronize))==0);bu|=(rule.FileSystemRights&FileSystemRights.ReadAndExecute)==FileSystemRights.ReadAndExecute;}
  }Require(sy&&ba&&(isolated||bu));
 }
 internal static List<IDisposable> PinDirectories(string directory){
  return PinDirectories(directory,true);
 }
 internal static List<IDisposable> PinDirectories(string directory,bool validateFinal){
  var pins=new List<IDisposable>();try{var ancestors=new List<string>();for(var p=new DirectoryInfo(directory);p!=null;p=p.Parent)ancestors.Insert(0,p.FullName);
   foreach(string path in ancestors){pins.Add(new SentinelPolicyDirectory(path));var acl=Directory.GetAccessControl(path);string owner=acl.GetOwner(typeof(SecurityIdentifier)).Value;Require(Trusted(owner)||owner=="S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464");
    foreach(FileSystemAccessRule rule in acl.GetAccessRules(true,true,typeof(SecurityIdentifier))){if(rule.AccessControlType!=AccessControlType.Allow||Trusted(rule.IdentityReference.Value)||rule.IdentityReference.Value=="S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464"||(rule.PropagationFlags&PropagationFlags.InheritOnly)!=0)continue;Require((rule.FileSystemRights&(FileSystemRights.Delete|FileSystemRights.DeleteSubdirectoriesAndFiles|FileSystemRights.ChangePermissions|FileSystemRights.TakeOwnership))==0);}
   }if(validateFinal)CheckSecurity(Directory.GetAccessControl(directory),false);return pins;
  }catch{DisposePins(pins);throw;}
 }
 internal static void DisposePins(List<IDisposable> pins){for(int i=pins.Count-1;i>=0;i--)pins[i].Dispose();}
 internal static void CheckPhysical(FileStream file,string expected){
  var buffer=new StringBuilder(32768);uint count=GetFinalPathNameByHandle(file.SafeFileHandle.DangerousGetHandle(),buffer,(uint)buffer.Capacity,0);Require(count>0&&count<buffer.Capacity);string actual=buffer.ToString();if(actual.StartsWith(@"\\?\",StringComparison.Ordinal))actual=actual.Substring(4);
  Require(string.Equals(actual,Path.GetFullPath(expected),StringComparison.OrdinalIgnoreCase));FileInfoNative info;Require(GetFileInformationByHandle(file.SafeFileHandle.DangerousGetHandle(),out info)&&info.Links==1&&(info.Attributes&0x410)==0);
 }
 internal static FileStream OpenProtected(string path){Require((File.GetAttributes(path)&FileAttributes.ReparsePoint)==0);var file=new FileStream(path,FileMode.Open,FileAccess.Read,FileShare.Read);try{CheckPhysical(file,path);CheckSecurity(file.GetAccessControl(),false);return file;}catch{file.Dispose();throw;}}
 internal static string Hash(FileStream file){file.Position=0;using(var sha=SHA256.Create())return BitConverter.ToString(sha.ComputeHash(file)).Replace("-","").ToLowerInvariant();}
 internal static string ReadWorkerHash(){
  var pins=PinDirectories(Root);try{using(var manifest=OpenProtected(Path.Combine(Root,"hid-admission-worker.manifest"))){Require(manifest.Length==107);var bytes=new byte[107];int offset=0;while(offset<bytes.Length){int count=manifest.Read(bytes,offset,bytes.Length-offset);Require(count>0);offset+=count;}string text=Encoding.ASCII.GetString(bytes);Require(System.Text.RegularExpressions.Regex.IsMatch(text,@"\ASNTHIW01\n[0-9a-f]{64}\n[0-9a-f]{32}\n\z"));string hash=text.Split('\n')[1];string image=Path.Combine(Root,"hid-admission-recovery-"+hash+".exe");using(var file=OpenProtected(image)){Require(file.Length>0&&file.Length<=33554432&&Hash(file)==hash);}return hash;}}finally{DisposePins(pins);}
 }
 internal static bool IsInstalled(){try{ReadWorkerHash();return true;}catch{return false;}}
}
