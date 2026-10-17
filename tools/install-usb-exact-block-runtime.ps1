#Requires -RunAsAdministrator
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$source=Join-Path $root 'artifacts/Sentinel.UsbExactBlockWorker.Live.exe'
if(!(Test-Path -LiteralPath $source -PathType Leaf)){throw 'Build the reviewed live exact worker with tools/usb/tests/build-usb-exact-block-worker.ps1 -ReviewedLive first.'}
# Compile the same read-only discovery checks used by the desktop. This installer
# provisions code/state directories only: no policy, task, journal or device API.
$installer=@'
using System;
using System.IO;
using System.Text;
using System.Security.AccessControl;
using System.Security.Principal;

public static class SentinelExactRuntimeInstaller {
 static void Require(bool value){if(!value)throw new InvalidOperationException("Exact USB runtime installation refused");}
 static FileSecurity FileAcl(){var acl=new FileSecurity();acl.SetOwner(new SecurityIdentifier("S-1-5-32-544"));acl.SetAccessRuleProtection(true,false);foreach(string sid in new[]{"S-1-5-18","S-1-5-32-544"})acl.AddAccessRule(new FileSystemAccessRule(new SecurityIdentifier(sid),FileSystemRights.FullControl,AccessControlType.Allow));acl.AddAccessRule(new FileSystemAccessRule(new SecurityIdentifier("S-1-5-32-545"),FileSystemRights.ReadAndExecute,AccessControlType.Allow));return acl;}
 static void Publish(string temporary,string destination){Require(!File.Exists(destination)&&!Directory.Exists(destination));File.Move(temporary,destination);}
 static void VerifyImage(string path,string hash){using(var image=UsbExactBlockCapability.OpenProtected(path)){Require(image.Length>0&&image.Length<=33554432&&UsbExactBlockCapability.Hash(image)==hash);}}
 public static void Install(string source){
  source=Path.GetFullPath(source);Require((File.GetAttributes(source)&FileAttributes.ReparsePoint)==0);
  using(var input=new FileStream(source,FileMode.Open,FileAccess.Read,FileShare.Read)){
   UsbExactBlockCapability.CheckPhysical(input,source);Require(input.Length>0&&input.Length<=33554432);string hash=UsbExactBlockCapability.Hash(input);
   string root=UsbExactBlockCapability.Root;var parentPins=UsbExactBlockCapability.PinDirectories(Path.GetDirectoryName(root),false);try{bool exists=Directory.Exists(root);
   if(!exists)SentinelPolicyDirectory.Provision(root);
   var pins=UsbExactBlockCapability.PinDirectories(root,false);try{
    UsbExactBlockCapability.CheckSecurity(Directory.GetAccessControl(root),!exists);
    if(!exists){var acl=Directory.GetAccessControl(root);acl.AddAccessRule(new FileSystemAccessRule(new SecurityIdentifier("S-1-5-32-545"),FileSystemRights.ReadAndExecute,InheritanceFlags.ContainerInherit|InheritanceFlags.ObjectInherit,PropagationFlags.None,AccessControlType.Allow));Directory.SetAccessControl(root,acl);}
    UsbExactBlockCapability.CheckSecurity(Directory.GetAccessControl(root),false);
    string state=Path.Combine(root,"State");if(!Directory.Exists(state))SentinelPolicyDirectory.Provision(state);
    using(var statePin=new SentinelPolicyDirectory(state)){
     UsbExactBlockCapability.CheckSecurity(Directory.GetAccessControl(state),true);
     string manifest=Path.Combine(root,"exact-worker.manifest");
     if(File.Exists(manifest)){Require(UsbExactBlockCapability.ReadWorkerHash()==hash);Console.WriteLine("Exact USB runtime already installed and verified; no policy or device change.");return;}
     string target=Path.Combine(root,"exact-recovery-"+hash+".exe");
     if(File.Exists(target))VerifyImage(target,hash);
     else{
      string staged=Path.Combine(root,"exact-image-"+Guid.NewGuid().ToString("N")+".incoming");
      using(var output=new FileStream(staged,FileMode.CreateNew,FileSystemRights.Read|FileSystemRights.Write,FileShare.None,4096,FileOptions.WriteThrough,FileAcl())){UsbExactBlockCapability.CheckPhysical(output,staged);input.Position=0;input.CopyTo(output);output.Flush(true);Require(UsbExactBlockCapability.Hash(output)==hash);}
      VerifyImage(staged,hash);Publish(staged,target);VerifyImage(target,hash);
     }
     byte[] data=Encoding.ASCII.GetBytes("SNTEXW01\n"+hash+"\n"+Guid.NewGuid().ToString("N")+"\n");Require(data.Length==107);
     string incoming=Path.Combine(root,"exact-manifest-"+Guid.NewGuid().ToString("N")+".incoming");
     using(var output=new FileStream(incoming,FileMode.CreateNew,FileSystemRights.Read|FileSystemRights.Write,FileShare.None,4096,FileOptions.WriteThrough,FileAcl())){UsbExactBlockCapability.CheckPhysical(output,incoming);output.Write(data,0,data.Length);output.Flush(true);output.Position=0;for(int i=0;i<data.Length;i++)Require(output.ReadByte()==data[i]);Require(output.ReadByte()==-1);}
     Publish(incoming,manifest);Require(UsbExactBlockCapability.ReadWorkerHash()==hash);
     Console.WriteLine("Exact USB runtime installed and pinned. No policy, task or device action; enforcement qualification remains separate.");
    }
   }finally{UsbExactBlockCapability.DisposePins(pins);}
   }finally{UsbExactBlockCapability.DisposePins(parentPins);}
  }
 }
}
'@
# Each compilation unit retains its own using declarations in a namespace.
$directorySource=[IO.File]::ReadAllText((Join-Path $root 'tools/usb/DuckyPolicyJournal.cs'))
$capabilitySource=[IO.File]::ReadAllText((Join-Path $root 'apps/desktop/UsbExactBlockCapability.cs'))
$combined="namespace SentinelExactInstall {`n"+$directorySource+"`n}`nnamespace SentinelExactInstall {`n"+$capabilitySource+"`n}`nnamespace SentinelExactInstall {`n"+$installer+"`n}"
Add-Type -TypeDefinition $combined -Language CSharp
[SentinelExactInstall.SentinelExactRuntimeInstaller]::Install($source)
