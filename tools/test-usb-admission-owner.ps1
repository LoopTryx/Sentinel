$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$framework=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319'
$output=Join-Path $root 'artifacts/Sentinel.UsbAdmissionOwnerQualification.exe'
& (Join-Path $framework 'csc.exe') /nologo /target:winexe /platform:x64 /main:UsbAdmissionOwnerQualification ('/out:'+$output) ('/win32manifest:'+(Join-Path $root 'apps/desktop/password-approval.manifest')) /reference:System.Windows.Forms.dll /reference:System.Drawing.dll ('/reference:'+(Join-Path $framework 'System.Runtime.WindowsRuntime.dll')) (Join-Path $root 'apps/desktop/UsbAdmissionOwnerQualification.cs') (Join-Path $root 'apps/desktop/UsbOwnerVerification.cs') (Join-Path $root 'apps/desktop/UsbAdmissionAuthorization.cs')
if($LASTEXITCODE -ne 0){throw 'USB owner qualification build failed'}
$regression=Join-Path $root 'artifacts/UsbAdmissionOwnerPendingTest.cs'
@'
using System;
internal static class UsbAdmissionOwnerPendingTest {
 static int Main(){
  if(UsbOwnerVerification.HasPending)return 1;
  if(UsbOwnerVerification.Verify(IntPtr.Zero,"test").GetAwaiter().GetResult())return 2;
  if(UsbOwnerVerification.HasPending)return 3;
  Console.WriteLine("Read-only pending state and invalid-window refusal PASS");return 0;
 }
}
'@ | Set-Content -LiteralPath $regression
$regressionExe=Join-Path $root 'artifacts/UsbAdmissionOwnerPendingTest.exe'
& (Join-Path $framework 'csc.exe') /nologo /target:exe ('/out:'+$regressionExe) ('/reference:'+(Join-Path $framework 'System.Runtime.WindowsRuntime.dll')) $regression (Join-Path $root 'apps/desktop/UsbOwnerVerification.cs')
if($LASTEXITCODE -ne 0){throw 'USB owner pending regression build failed'}
& $regressionExe
if($LASTEXITCODE -ne 0){throw 'USB owner pending regression failed'}
& (Join-Path $PSScriptRoot 'test-usb-owner-verification.ps1')
Write-Output 'Built native owner qualification; interactive Windows Hello test not launched'
