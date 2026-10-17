param([Parameter(Mandatory=$true)][string]$InstallationPath,[switch]$Disable)
$ErrorActionPreference='Stop'
$launcher=Join-Path ([IO.Path]::GetFullPath($InstallationPath)) 'Sentinel.exe'
if(!(Test-Path -LiteralPath $launcher -PathType Leaf)-or !(Test-Path -LiteralPath (Join-Path $InstallationPath 'apps/desktop/console-build/Sentinel.Glass.exe') -PathType Leaf)){throw 'A complete installed Sentinel application is required'}
Add-Type @'
using System;using System.Text;using System.Runtime.InteropServices;using Microsoft.Win32.SafeHandles;
public static class SentinelStartupPath {
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern uint GetFinalPathNameByHandle(SafeFileHandle file,StringBuilder path,uint size,uint flags);
 public static string Resolve(SafeFileHandle file){var path=new StringBuilder(32768);uint count=GetFinalPathNameByHandle(file,path,(uint)path.Capacity,0);if(count==0||count>=path.Capacity)throw new InvalidOperationException("Installed path unavailable");string value=path.ToString();return value.StartsWith(@"\\?\")?value.Substring(4):value;}
}
'@
$pin=[IO.FileStream]::new($launcher,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
try{
 $physical=[SentinelStartupPath]::Resolve($pin.SafeFileHandle)
 $shell=New-Object -ComObject WScript.Shell
 $startup=[string]$shell.SpecialFolders.Item('Startup')
 if(!(Test-Path -LiteralPath $startup -PathType Container)){throw 'Current-user Startup folder unavailable'}
 $entry=Join-Path $startup 'Sentinel.lnk'
 if(Test-Path -LiteralPath $entry){$existing=$shell.CreateShortcut($entry);if(![string]::Equals($existing.TargetPath,$physical,[StringComparison]::OrdinalIgnoreCase)){throw 'An unrelated Sentinel startup entry already exists; preserved'}}
 if($Disable){if(Test-Path -LiteralPath $entry){Remove-Item -LiteralPath $entry};Write-Output 'Sentinel sign-in startup disabled';return}
 $shortcut=$shell.CreateShortcut($entry);$shortcut.TargetPath=$physical;$shortcut.Arguments='';$shortcut.WorkingDirectory=Split-Path -Parent $physical;$shortcut.Description='Open Sentinel when signing in';$shortcut.Save()
 $verified=$shell.CreateShortcut($entry)
 if(![string]::Equals($verified.TargetPath,$physical,[StringComparison]::OrdinalIgnoreCase)-or $verified.Arguments -ne ''){throw 'Startup entry verification failed'}
 Write-Output ('Configured current-user sign-in startup: '+$entry)
 Write-Output 'No elevation, USB policy change or reboot performed. Actual next-sign-in launch remains to be verified.'
}finally{$pin.Dispose()}
