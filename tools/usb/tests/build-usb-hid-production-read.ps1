$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'build-usb-hid-controller.ps1')
$entry=@'
using System;
internal static class HidProductionRead {
 [STAThread]public static int Main(){try{var state=UsbHidAdmissionOperations.ReadVerified().GetAwaiter().GetResult();Console.WriteLine("PASS protected installed worker/baseline readback; active="+state.Active+" generation="+state.Generation+" internalExceptions="+state.InternalSafety.Length+" externalApprovals="+state.ExternalApprovals.Length+"; no device/policy action");return 0;}catch(Exception error){for(int n=0;error!=null&&n<8;n++,error=error.InnerException)Console.WriteLine("FAIL "+error.GetType().Name+" HRESULT "+error.HResult.ToString("X8")+" "+error.Message+" at "+(error.TargetSite==null?"none":error.TargetSite.Name));return 1;}}
}
'@
$entryPath=Join-Path $out 'HidProductionRead.generated.cs'
[IO.File]::WriteAllText($entryPath,$entry)
$target=Join-Path $out 'Sentinel.HidProductionRead.exe'
$options=$options|Where-Object{$_ -ne '/target:library'}
& $csc @options /target:exe /main:HidProductionRead ('/out:'+$target) $sources $entryPath
if($LASTEXITCODE -ne 0){throw 'HID production read compilation failed'}
Write-Output ('Built '+$target+'; not executed')
