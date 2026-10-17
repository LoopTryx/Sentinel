$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$source=Join-Path $root 'artifacts\usb-approval-binding-test.cs'
$out=Join-Path $root 'artifacts\usb-approval-binding-test.exe'
@"
using System;using System.Threading.Tasks;
public static class Test {
 public static int Main(){return Run().GetAwaiter().GetResult();}
 static async Task<int> Run(){long now=100;var authority=new UsbApprovalBinding(()=>now);var one=authority.Attach("private-root","keyboard/mouse");var other=authority.Attach("other-root","keyboard");var permit=await authority.Verify(one,UsbApprovalBinding.Action.AllowInput,()=>Task.FromResult(true));if(permit==null||authority.Consume(permit,other,UsbApprovalBinding.Action.AllowInput))return 1;if(authority.Consume(permit,one,UsbApprovalBinding.Action.AllowInput))return 2;
 permit=await authority.Verify(one,UsbApprovalBinding.Action.AllowInput,()=>Task.FromResult(true));if(!authority.Consume(permit,one,UsbApprovalBinding.Action.AllowInput)||authority.Consume(permit,one,UsbApprovalBinding.Action.AllowInput))return 3;
 var pending=new TaskCompletionSource<bool>();var request=authority.Verify(one,UsbApprovalBinding.Action.AllowInput,()=>pending.Task);authority.Detach(one);var replacement=authority.Attach("private-root","keyboard/mouse");pending.SetResult(true);if(await request!=null)return 4;
 permit=await authority.Verify(replacement,UsbApprovalBinding.Action.Enroll,()=>Task.FromResult(true));if(authority.Consume(permit,replacement,UsbApprovalBinding.Action.AllowInput))return 5;
 permit=await authority.Verify(replacement,UsbApprovalBinding.Action.AllowInput,()=>Task.FromResult(true));now+=5000;if(authority.Consume(permit,replacement,UsbApprovalBinding.Action.AllowInput))return 6;
 pending=new TaskCompletionSource<bool>();request=authority.Verify(replacement,UsbApprovalBinding.Action.AllowInput,()=>pending.Task);now-=1;pending.SetResult(true);if(await request!=null)return 7;
 if(await authority.Verify(replacement,UsbApprovalBinding.Action.AllowInput,()=>Task.FromResult(false))!=null)return 8;
 Console.WriteLine("Wrong subject/action, single use, detach/reconnect during prompt, expiry, rollback and denied verification PASS.");return 0;
 }
}
"@ | Set-Content -LiteralPath $source
& (Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe') /nologo /target:exe ('/out:'+$out) $source (Join-Path $root 'apps\desktop\UsbApprovalBinding.cs')
if($LASTEXITCODE -ne 0){throw 'Approval binding test build failed'}
& $out
if($LASTEXITCODE -ne 0){throw 'Approval binding regressions failed'}
