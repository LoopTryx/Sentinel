$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$source=Join-Path $root 'artifacts\PasswordApprovalChecks.cs'
$output=Join-Path $root 'artifacts\PasswordApprovalChecks.exe'
$code=@'
using System;
using System.IO;
using System.Threading;
using System.Diagnostics;
using System.Reflection;
public static class Checks {
 public static int Main(string[] args){
  if(args.Length==1&&args[0]=="contend"){using(var held=PasswordActionLease.TryAcquire()){return held==null?0:9;}}
  if(VaultApproval.Approve("copy","bad;id")||VaultApproval.Approve("unsupported","mail"))return 1;
  using(var first=PasswordActionLease.TryAcquire()) {
   if(first==null)return 2;
   bool refused=false;var thread=new Thread(()=>{using(var second=PasswordActionLease.TryAcquire()){refused=second==null;}});thread.Start();thread.Join();if(!refused)return 3;
   using(var child=Process.Start(new ProcessStartInfo(Assembly.GetExecutingAssembly().Location,"contend"){UseShellExecute=false,CreateNoWindow=true})){if(!child.WaitForExit(10000)||child.ExitCode!=0)return 5;}
  }
  using(var next=PasswordActionLease.TryAcquire()){if(next==null)return 4;}
  string resolved=VaultApproval.ResolveExecutable(Assembly.GetExecutingAssembly().Location);if(!File.Exists(resolved)||resolved.StartsWith(@"\\?\"))return 6;
  Console.WriteLine("Physical executable path resolved; Invalid operations refused; concurrent thread/process refused; lease released.");return 0;
 }
}
'@
[IO.File]::WriteAllText($source,$code,[Text.UTF8Encoding]::new($false))
& (Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe') /nologo /target:exe ('/out:'+$output) $source (Join-Path $root 'apps\desktop\VaultApproval.cs')
if($LASTEXITCODE -ne 0){throw 'Approval regression build failed'}
& $output
if($LASTEXITCODE -ne 0){throw 'Approval regression failed'}
