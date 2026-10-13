using System;
using System.IO;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Text;
using Microsoft.Win32.SafeHandles;

// Provisioning only. No device/registry changes and no UI-callable path selector.
// Machine directory installation, inherited-handle broker wiring and startup recovery
// remain separate gates. Scratch factories are internal native-test entry points.
internal sealed class ProtectedUsbJournal : IDisposable {
 const uint Reparse=0x400,DirectoryAttribute=0x10;
 const long MaxLength=4140;
 [StructLayout(LayoutKind.Sequential)]struct Attributes {public int Length;public IntPtr Descriptor;public int Inherit;}
 [StructLayout(LayoutKind.Sequential)]struct FileInfo {public uint Attributes;public System.Runtime.InteropServices.ComTypes.FILETIME Creation,Access,Write;public uint Volume,SizeHigh,SizeLow,Links,IndexHigh,IndexLow;}
 [DllImport("kernel32.dll",EntryPoint="CreateFileW",CharSet=CharSet.Unicode,SetLastError=true)]static extern SafeFileHandle Open(string path,uint access,uint share,IntPtr security,uint creation,uint flags,IntPtr template);
 [DllImport("kernel32.dll",EntryPoint="CreateFileW",CharSet=CharSet.Unicode,SetLastError=true)]static extern SafeFileHandle Create(string path,uint access,uint share,ref Attributes security,uint creation,uint flags,IntPtr template);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern bool CreateDirectoryW(string path,ref Attributes attributes);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool GetFileInformationByHandle(SafeFileHandle file,out FileInfo information);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern uint GetFinalPathNameByHandleW(SafeFileHandle file,StringBuilder path,uint size,uint flags);
 [DllImport("advapi32.dll")]static extern uint GetSecurityInfo(SafeFileHandle handle,int type,uint information,out IntPtr owner,out IntPtr group,out IntPtr dacl,out IntPtr sacl,out IntPtr descriptor);
 [DllImport("advapi32.dll")]static extern uint GetSecurityDescriptorLength(IntPtr descriptor);
 [DllImport("kernel32.dll")]static extern IntPtr LocalFree(IntPtr memory);
 static readonly SecurityIdentifier SystemSid=new SecurityIdentifier(WellKnownSidType.LocalSystemSid,null);
 static readonly SecurityIdentifier AdminSid=new SecurityIdentifier(WellKnownSidType.BuiltinAdministratorsSid,null);
 static readonly SecurityIdentifier InstallerSid=new SecurityIdentifier("S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464");
 readonly List<SafeFileHandle> directories;
 internal FileStream Stream {get;private set;}
 ProtectedUsbJournal(FileStream stream,List<SafeFileHandle> directories){Stream=stream;this.directories=directories;}
 static IOException Refused(){return new IOException("USB recovery journal is unavailable or not private.");}
 static string LocalPath(string path){string full=Path.GetFullPath(path);if(full.Length>32700||full.Length<3||full[1]!=':'||full[2]!='\\')throw Refused();return full.TrimEnd('\\');}
 static void CheckHandle(SafeFileHandle handle,string expected,bool directory){
  FileInfo info;if(handle.IsInvalid||!GetFileInformationByHandle(handle,out info)||(info.Attributes&Reparse)!=0||((info.Attributes&DirectoryAttribute)!=0)!=directory||(!directory&&info.Links!=1))throw Refused();
  var path=new StringBuilder(32768);uint length=GetFinalPathNameByHandleW(handle,path,(uint)path.Capacity,0);if(length==0||length>=path.Capacity)throw Refused();string final=path.ToString();if(final.StartsWith(@"\\?\"))final=final.Substring(4);if(!string.Equals(final.TrimEnd('\\'),expected.TrimEnd('\\'),StringComparison.OrdinalIgnoreCase))throw Refused();
 }
 static RawSecurityDescriptor Descriptor(SafeFileHandle handle){
  IntPtr owner,group,dacl,sacl,descriptor;if(GetSecurityInfo(handle,1,5,out owner,out group,out dacl,out sacl,out descriptor)!=0)throw Refused();
  try{uint size=GetSecurityDescriptorLength(descriptor);if(size<20||size>65536)throw Refused();var bytes=new byte[size];Marshal.Copy(descriptor,bytes,0,(int)size);return new RawSecurityDescriptor(bytes,0);}finally{LocalFree(descriptor);}
 }
 static bool Contains(SecurityIdentifier[] allowed,SecurityIdentifier sid){foreach(var candidate in allowed)if(candidate.Equals(sid))return true;return false;}
 static void CheckPrivate(SafeFileHandle handle,SecurityIdentifier[] allowed){
  var security=Descriptor(handle);if(!Contains(allowed,security.Owner)||(security.ControlFlags&ControlFlags.DiscretionaryAclProtected)==0||security.DiscretionaryAcl==null||security.DiscretionaryAcl.Count!=allowed.Length)throw Refused();
  var seen=new HashSet<string>();foreach(GenericAce raw in security.DiscretionaryAcl){var ace=raw as CommonAce;if(ace==null||ace.IsCallback||ace.AceQualifier!=AceQualifier.AccessAllowed||(ace.AceFlags&(AceFlags.Inherited|AceFlags.InheritOnly))!=0||!Contains(allowed,ace.SecurityIdentifier)||ace.AccessMask!=(int)FileSystemRights.FullControl||!seen.Add(ace.SecurityIdentifier.Value))throw Refused();}
 }
 static void CheckMachineParent(SafeFileHandle handle){
  var trusted=new[]{SystemSid,AdminSid,InstallerSid};var security=Descriptor(handle);if(!Contains(trusted,security.Owner)||security.DiscretionaryAcl==null)throw Refused();
  foreach(GenericAce raw in security.DiscretionaryAcl){var ace=raw as CommonAce;if(ace==null||ace.IsCallback)throw Refused();if(ace.AceQualifier==AceQualifier.AccessDenied||(ace.AceFlags&AceFlags.InheritOnly)!=0)continue;if(ace.AceQualifier!=AceQualifier.AccessAllowed)throw Refused();if(!Contains(trusted,ace.SecurityIdentifier)&&(ace.AccessMask&(0x40|0x10000|0x40000|0x80000|0x10000000))!=0)throw Refused();}
 }
 static byte[] Security(SecurityIdentifier[] allowed,bool directory){
  FileSystemSecurity security=directory?(FileSystemSecurity)new DirectorySecurity():new FileSecurity();security.SetAccessRuleProtection(true,false);security.SetOwner(allowed[0]);foreach(var sid in allowed)security.AddAccessRule(new FileSystemAccessRule(sid,FileSystemRights.FullControl,directory?InheritanceFlags.ContainerInherit|InheritanceFlags.ObjectInherit:InheritanceFlags.None,PropagationFlags.None,AccessControlType.Allow));return security.GetSecurityDescriptorBinaryForm();
 }
 static void CreatePrivateDirectory(string path,SecurityIdentifier owner){var bytes=Security(new[]{owner},true);var pinned=GCHandle.Alloc(bytes,GCHandleType.Pinned);try{var attributes=new Attributes{Length=Marshal.SizeOf(typeof(Attributes)),Descriptor=pinned.AddrOfPinnedObject()};if(!CreateDirectoryW(path,ref attributes))throw Refused();}finally{pinned.Free();}}
 static ProtectedUsbJournal OpenCore(string root,SecurityIdentifier[] allowed,bool machine){
  root=LocalPath(root);var retained=new List<SafeFileHandle>();FileStream stream=null;SafeFileHandle file=null;
  try{
   var chain=new List<string>();for(string cursor=root;cursor!=null;cursor=Path.GetDirectoryName(cursor)){chain.Add(cursor);if(cursor.Length<=3)break;}chain.Reverse();
   foreach(string directory in chain){var handle=Open(directory,0x20080,3,IntPtr.Zero,3,0x02200000,IntPtr.Zero);retained.Add(handle);CheckHandle(handle,directory,true);if(machine&&directory!=root)CheckMachineParent(handle);}
   CheckPrivate(retained[retained.Count-1],allowed);
   string path=Path.Combine(root,"usb-policy.journal");var bytes=Security(allowed,false);var pinned=GCHandle.Alloc(bytes,GCHandleType.Pinned);
   try{var attributes=new Attributes{Length=Marshal.SizeOf(typeof(Attributes)),Descriptor=pinned.AddrOfPinnedObject()};file=Create(path,0xc0000000,0,ref attributes,1,0x80200000,IntPtr.Zero);int error=Marshal.GetLastWin32Error();if(file.IsInvalid){file.Dispose();if(error!=80&&error!=183)throw Refused();file=Open(path,0xc0000000,0,IntPtr.Zero,3,0x80200000,IntPtr.Zero);}}finally{pinned.Free();}
   CheckHandle(file,path,false);CheckPrivate(file,allowed);stream=new FileStream(file,FileAccess.ReadWrite,4096,false);if(stream.Length>MaxLength)throw Refused();return new ProtectedUsbJournal(stream,retained);
  }catch{if(stream!=null)stream.Dispose();else if(file!=null)file.Dispose();for(int i=retained.Count-1;i>=0;i--)retained[i].Dispose();throw Refused();}
 }
 static SecurityIdentifier CurrentSid(){using(var identity=WindowsIdentity.GetCurrent()){if(identity.User==null)throw Refused();return identity.User;}}
 internal static ProtectedUsbJournal OpenMachine(){using(var identity=WindowsIdentity.GetCurrent()){if(!new WindowsPrincipal(identity).IsInRole(WindowsBuiltInRole.Administrator))throw Refused();}string root=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),"SentinelUsbGuard");return OpenCore(root,new[]{AdminSid,SystemSid},true);}
 static void CheckScratchName(string root){string name=Path.GetFileName(LocalPath(root));if(!System.Text.RegularExpressions.Regex.IsMatch(name,"^usb-journal-test-[0-9a-f]{32}$"))throw Refused();}
 internal static ProtectedUsbJournal CreateScratch(string root){CheckScratchName(root);var owner=CurrentSid();CreatePrivateDirectory(LocalPath(root),owner);return OpenCore(root,new[]{owner},false);}
 internal static ProtectedUsbJournal OpenScratch(string root){CheckScratchName(root);return OpenCore(root,new[]{CurrentSid()},false);}
 public void Dispose(){if(Stream!=null){Stream.Dispose();Stream=null;}for(int i=directories.Count-1;i>=0;i--)directories[i].Dispose();directories.Clear();}
}
