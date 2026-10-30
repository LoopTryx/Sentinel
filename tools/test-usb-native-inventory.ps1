$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$source=Join-Path $root 'artifacts\usb-native-inventory-test.cs'
$out=Join-Path $root 'artifacts\usb-native-inventory-test.exe'
@"
using System;using System.Web.Script.Serialization;using System.Collections.Generic;
public static class Test {public static int Main(string[] args){var json=new JavaScriptSerializer();if(args.Length==1&&args[0]=="--policy-counts"){Console.WriteLine(json.Serialize(UsbDeviceInventory.PolicyCandidateCounts()));return 0;}if(args.Length==1&&args[0]=="--live"){Console.WriteLine(json.Serialize(UsbDeviceInventory.Snapshot()));return 0;}var same=new[]{new UsbDeviceInventory.Node{Id="kbd-secret",Root="root-secret",Placement="usb_placement_unverified",Kind="hid_keyboard",Name="Example board"},new UsbDeviceInventory.Node{Id="mouse-secret",Root="root-secret",Placement="usb_placement_unverified",Kind="hid_mouse"},new UsbDeviceInventory.Node{Id="internal-secret",Placement="platform_input",Kind="hid_keyboard"}};var value=json.Serialize(UsbDeviceInventory.Aggregate(same,false,0));if(value.Contains("secret")||value.Contains("trusted")||value.Contains("device-2")||!value.Contains("hid_keyboard")||!value.Contains("hid_mouse"))return 1;var unresolved=new[]{new UsbDeviceInventory.Node{Id="one",Placement="unverified",Kind="hid_other"},new UsbDeviceInventory.Node{Id="two",Placement="unverified",Kind="hid_other"}};value=json.Serialize(UsbDeviceInventory.Aggregate(unresolved,false,0));if(!value.Contains("partial")||!value.Contains("device-2"))return 2;var wide=new List<UsbDeviceInventory.Node>();for(int i=0;i<65;i++)wide.Add(new UsbDeviceInventory.Node{Id="node"+i,Root="root"+i,Placement="usb_placement_unverified",Kind="hid_mouse"});value=json.Serialize(UsbDeviceInventory.Aggregate(wide,false,0));if(value.Contains("device-65")||!value.Contains("\"omitted\":1"))return 3;Console.WriteLine("Native USB grouping/redaction/platform exclusion/unresolved/bounds PASS.");return 0;}}
"@ | Set-Content -LiteralPath $source
& (Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe') /nologo /target:exe ('/out:'+$out) /reference:System.Web.Extensions.dll $source (Join-Path $root 'apps\desktop\UsbDeviceInventory.cs') (Join-Path $root 'apps\desktop\UsbInputIdentity.cs')
if($LASTEXITCODE -ne 0){throw 'Native inventory test build failed'}
& $out
if($LASTEXITCODE -ne 0){throw 'Native inventory regressions failed'}

