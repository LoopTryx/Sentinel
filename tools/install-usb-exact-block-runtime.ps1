#Requires -RunAsAdministrator
param([switch]$UpgradeReleasedRuntime)
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
using System.Diagnostics;
using System.Runtime.InteropServices;

public static class SentinelExactRuntimeInstaller {
 static void Require(bool value){if(!value)throw new InvalidOperationException("Exact USB runtime installation refused");}
 static FileSecurity FileAcl(){var acl=new FileSecurity();acl.SetOwner(new SecurityIdentifier("S-1-5-32-544"));acl.SetAccessRuleProtection(true,false);foreach(string sid in new[]{"S-1-5-18","S-1-5-32-544"})acl.AddAccessRule(new FileSystemAccessRule(new SecurityIdentifier(sid),FileSystemRights.FullControl,AccessControlType.Allow));acl.AddAccessRule(new FileSystemAccessRule(new SecurityIdentifier("S-1-5-32-545"),FileSystemRights.ReadAndExecute,AccessControlType.Allow));return acl;}
 static void Publish(string temporary,string destination){Require(!File.Exists(destination)&&!Directory.Exists(destination));File.Move(temporary,destination);}
 static void VerifyImage(string path,string hash){using(var image=UsbExactBlockCapability.OpenProtected(path)){Require(image.Length>0&&image.Length<=33554432&&UsbExactBlockCapability.Hash(image)==hash);}}
 static void ReleaseCom(object value){if(value!=null&&Marshal.IsComObject(value))Marshal.FinalReleaseComObject(value);}
 static void RequireQuiescent(string previousHash){
  dynamic service=null,folder=null,tasks=null,running=null;try{
   service=Activator.CreateInstance(Type.GetTypeFromProgID("Schedule.Service",true));service.Connect();folder=service.GetFolder("\\");tasks=folder.GetTasks(1);Require((int)tasks.Count<=4096);
   foreach(dynamic task in tasks)try{Require(!((string)task.Name).StartsWith("Sentinel-UsbExact-Recover-",StringComparison.OrdinalIgnoreCase));}finally{ReleaseCom(task);}
   running=service.GetRunningTasks(1);Require((int)running.Count<=4096);
   foreach(dynamic task in running)try{Require(!((string)task.Path).StartsWith("\\Sentinel-UsbExact-Recover-",StringComparison.OrdinalIgnoreCase));}finally{ReleaseCom(task);}
  }finally{ReleaseCom(running);ReleaseCom(tasks);ReleaseCom(folder);ReleaseCom(service);}
  if(previousHash!=null){var processes=Process.GetProcessesByName("exact-recovery-"+previousHash);try{Require(processes.Length==0);}finally{foreach(var process in processes)process.Dispose();}}
 }
 static string PreviousScope(string manifest,string hash){using(var file=UsbExactBlockCapability.OpenProtected(manifest)){Require(file.Length==107);byte[] bytes=new byte[107];int offset=0;while(offset<bytes.Length){int count=file.Read(bytes,offset,bytes.Length-offset);Require(count>0);offset+=count;}string text=Encoding.ASCII.GetString(bytes);Require(System.Text.RegularExpressions.Regex.IsMatch(text,@"\ASNTEXW01\n"+hash+@"\n[0-9a-f]{32}\n\z"));return text.Split('\n')[2];}}
 public static void Install(string source,bool upgradeReleasedRuntime){
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
     string previousHash=File.Exists(manifest)?UsbExactBlockCapability.ReadWorkerHash():null;
     if(previousHash==hash){Console.WriteLine("Exact USB runtime already installed and verified; no policy or device change.");return;}
     Require(previousHash==null||upgradeReleasedRuntime);
     using(var store=new UsbExactBlockFileStore(state))store.WithReadFence((committed,pending,fence)=>{
     Require(pending==null&&(committed==null||committed.Blocked.Length==0));fence();
     Require(previousHash==null?!File.Exists(manifest):UsbExactBlockCapability.ReadWorkerHash()==previousHash);
     RequireQuiescent(previousHash);
     string scope=previousHash==null?Guid.NewGuid().ToString("N"):PreviousScope(manifest,previousHash);
     string target=Path.Combine(root,"exact-recovery-"+hash+".exe");
     if(File.Exists(target))VerifyImage(target,hash);
     else{
      string staged=Path.Combine(root,"exact-image-"+Guid.NewGuid().ToString("N")+".incoming");
      using(var output=new FileStream(staged,FileMode.CreateNew,FileSystemRights.Read|FileSystemRights.Write,FileShare.None,4096,FileOptions.WriteThrough,FileAcl())){UsbExactBlockCapability.CheckPhysical(output,staged);input.Position=0;input.CopyTo(output);output.Flush(true);Require(UsbExactBlockCapability.Hash(output)==hash);}
      VerifyImage(staged,hash);Publish(staged,target);VerifyImage(target,hash);
     }
     byte[] data=Encoding.ASCII.GetBytes("SNTEXW01\n"+hash+"\n"+scope+"\n");Require(data.Length==107);
     string incoming=Path.Combine(root,"exact-manifest-"+Guid.NewGuid().ToString("N")+".incoming");
     using(var output=new FileStream(incoming,FileMode.CreateNew,FileSystemRights.Read|FileSystemRights.Write,FileShare.None,4096,FileOptions.WriteThrough,FileAcl())){UsbExactBlockCapability.CheckPhysical(output,incoming);output.Write(data,0,data.Length);output.Flush(true);output.Position=0;for(int i=0;i<data.Length;i++)Require(output.ReadByte()==data[i]);Require(output.ReadByte()==-1);}
     fence();RequireQuiescent(previousHash);
     if(previousHash==null)Publish(incoming,manifest);
     else{
      // Do not retain our manifest read pin during Replace. Another backend's
      // existing non-delete-shared pin intentionally prevents an unsafe upgrade.
      Require(UsbExactBlockCapability.ReadWorkerHash()==previousHash&&PreviousScope(manifest,previousHash)==scope);
      string backup=Path.Combine(root,"exact-worker.previous-"+Guid.NewGuid().ToString("N")+".manifest");
      File.Replace(incoming,manifest,backup);
     }
     Require(UsbExactBlockCapability.ReadWorkerHash()==hash);fence();
     Console.WriteLine(previousHash==null?"Exact USB runtime installed and pinned. No policy, task or device action; enforcement qualification remains separate.":"Released exact USB runtime upgraded atomically. Original image and manifest backup retained; no policy, task or device action.");
     });
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
foreach($file in @('UsbExactBlockState.cs','UsbExactBlockTransaction.cs','UsbExactBlockFileStore.cs')){$combined+="`nnamespace SentinelExactInstall {`n"+[IO.File]::ReadAllText((Join-Path $root ('tools/usb/'+$file)))+"`n}"}
Add-Type -TypeDefinition $combined -Language CSharp -ReferencedAssemblies 'System.dll','System.Core.dll','Microsoft.CSharp.dll'
[SentinelExactInstall.SentinelExactRuntimeInstaller]::Install($source,[bool]$UpgradeReleasedRuntime)
