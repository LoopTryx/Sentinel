param([switch]$Live)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$source=Join-Path $root 'artifacts\usb-owner-verification-test.cs'
$out=Join-Path $root 'artifacts\usb-owner-verification-test.exe'
@"
using System;using System.Windows.Forms;
public static class Test {
 [STAThread]public static int Main(string[] args){if(args.Length>0){bool started=false;Application.EnableVisualStyles();var form=new Form{Text="Sentinel device approval verification test",Width=490,Height=170,StartPosition=FormStartPosition.CenterScreen};form.Controls.Add(new Label{Dock=DockStyle.Fill,Padding=new Padding(20),Text="Verify in Windows Hello. This checks the approval adapter; no USB device or policy will change."});form.Activated+=delegate{if(started)return;started=true;form.BeginInvoke(new System.Action(async delegate{var authority=new UsbApprovalBinding();var connection=authority.Attach("synthetic-private-subject","keyboard");var permit=await authority.Verify(connection,UsbApprovalBinding.Action.AllowInput,()=>UsbOwnerVerification.Verify(form.Handle,"Sentinel: verify the USB approval adapter. No device settings will change."));bool consumed=authority.Consume(permit,connection,UsbApprovalBinding.Action.AllowInput);Console.WriteLine("ownerVerified="+consumed+"; replayRefused="+!authority.Consume(permit,connection,UsbApprovalBinding.Action.AllowInput));form.Close();}));};Application.Run(form);return 0;}
 if(UsbOwnerVerification.Verify(IntPtr.Zero,"test").GetAwaiter().GetResult())return 1;
 bool closed=false;if(UsbOwnerVerification.TryFinish(false,()=>{throw new Exception();},()=>0,()=>closed=true)||closed)return 2;
 if(UsbOwnerVerification.TryFinish(false,()=>{},()=>{throw new Exception();},()=>closed=true)||closed)return 3;
 if(!UsbOwnerVerification.TryFinish(false,()=>{},()=>2,()=>closed=true)||!closed)return 4;
 if(!UsbOwnerVerification.TryFinish(true,()=>{throw new Exception();},()=>{throw new Exception();},()=>{throw new Exception();}))return 5;
 Console.WriteLine("Invalid HWND, running/unknown prompt latch, canceled completion and completed close failure PASS.");return 0;
 }
}
"@ | Set-Content -LiteralPath $source
$framework=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319'
& (Join-Path $framework 'csc.exe') /nologo /target:exe ('/out:'+$out) /reference:System.Windows.Forms.dll /reference:System.Drawing.dll ('/reference:'+(Join-Path $framework 'System.Runtime.WindowsRuntime.dll')) $source (Join-Path $root 'apps\desktop\UsbOwnerVerification.cs') (Join-Path $root 'apps\desktop\UsbApprovalBinding.cs')
if($LASTEXITCODE -ne 0){throw 'Owner verifier test build failed'}
& $out
if($LASTEXITCODE -ne 0){throw 'Owner verifier regressions failed'}
if($Live){& $out --live;if($LASTEXITCODE -ne 0){throw 'Owner verifier live test failed'}}
