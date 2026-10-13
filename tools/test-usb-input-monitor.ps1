$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$out=Join-Path $root 'artifacts\usb-input-monitor-test.exe'
$source=Join-Path $root 'artifacts\usb-input-monitor-test.cs'
@'
using System;using System.Web.Script.Serialization;
public static class Test{public static int Main(){var monitor=new UsbInputMonitor();monitor.Record(new IntPtr(1),"keyboard",0x5B,false,0);monitor.Record(new IntPtr(1),"keyboard",0x52,false,1);monitor.Record(new IntPtr(1),"keyboard",0x5B,true,2);monitor.Record(new IntPtr(1),"keyboard",0x52,false,3);var json=new JavaScriptSerializer();string first=json.Serialize(monitor.SnapshotAt(59999));if(!first.Contains("\"launcherShortcuts\":1")||!first.Contains("\"initialObservationComplete\":false")||first.Contains("password"))return 1;string next=json.Serialize(monitor.SnapshotAt(60000));if(!next.Contains("\"initialObservationComplete\":true")||!next.Contains("\"held\":false"))return 2;monitor.Removed(new IntPtr(1));if(!json.Serialize(monitor.SnapshotAt(60000)).Contains("\"devices\":[]"))return 3;for(int i=1;i<=65;i++)monitor.Record(new IntPtr(i),"mouse",0,false,0);string bounded=json.Serialize(monitor.SnapshotAt(1000));if(!bounded.Contains("\"omitted\":1"))return 4;Console.WriteLine("Aggregate counts, modifier release, 60-second boundary, removal, bounds and no invented hold passed.");return 0;}}
'@ | Set-Content -LiteralPath $source
& (Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe') /nologo /target:exe ('/out:'+$out) /reference:System.Web.Extensions.dll $source (Join-Path $root 'apps\desktop\UsbInputMonitor.cs')
if($LASTEXITCODE -ne 0){throw 'Build failed'}
& $out
if($LASTEXITCODE -ne 0){throw 'Monitor test failed'}
