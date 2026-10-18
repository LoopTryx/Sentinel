param([switch]$PrivateQualification,[switch]$ReviewedLive)
$ErrorActionPreference='Stop'
if($PrivateQualification -and $ReviewedLive){throw 'Choose one worker build scope'}
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$csc=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
$sources=@('UsbAdmissionWorker.cs','UsbAdmissionMachineGpo.cs','UsbAdmissionCleanupStage.cs','UsbSavedAdmissionEntry.cs','UsbAdmissionJournal.cs','DuckyPolicyJournal.cs','DuckyLocalGpo.cs','DuckyWorkerJob.cs','DuckyWorkerLease.cs','UsbAdmissionTransaction.cs','UsbEnrollmentConfig.cs','UsbAdmissionPolicySurvey.cs')|ForEach-Object{Join-Path $root ('tools/usb/'+$_)}
$sources+=@('tools/usb/UsbAdmissionLegacyState.cs','tools/usb/UsbLegacyReleasedBaseline.cs','apps/desktop/DuckyPolicyEnrollment.cs')|ForEach-Object{Join-Path $root $_}
$legacyResources=@(('/resource:'+(Join-Path $root 'tools/usb/DuckyPolicyEntry.cs')+',Sentinel.LegacySource.Current'))
$historical=Join-Path $root 'artifacts/LegacyDuckyEntry-d0c3349.cs'
$info=[Diagnostics.ProcessStartInfo]::new('git','show d0c3349:tools/usb/DuckyPolicyEntry.cs');$info.WorkingDirectory=$root;$info.UseShellExecute=$false;$info.RedirectStandardOutput=$true;$info.RedirectStandardError=$true;$info.CreateNoWindow=$true
$process=[Diagnostics.Process]::Start($info)
try{$bytes=[IO.MemoryStream]::new();$process.StandardOutput.BaseStream.CopyTo($bytes);$errorText=$process.StandardError.ReadToEnd();$process.WaitForExit();if($process.ExitCode -eq 0){[IO.File]::WriteAllBytes($historical,$bytes.ToArray());$legacyResources+=('/resource:'+$historical+',Sentinel.LegacySource.Historical')}}finally{$process.Dispose();if($bytes){$bytes.Dispose()}}

$target=Join-Path $root ('artifacts/Sentinel.UsbAdmissionWorker'+$(if($PrivateQualification){'.Private'}else{''})+'.exe')
$flags=@();if($PrivateQualification){$flags+='/define:SENTINEL_USB_ADMISSION_PRIVATE_QUALIFICATION'}elseif($ReviewedLive){$flags+='/define:SENTINEL_USB_ADMISSION_LIVE_REVIEWED'}
& $csc /nologo /target:exe /platform:x64 /main:UsbAdmissionWorkerBackend /reference:Microsoft.CSharp.dll /reference:System.Web.Extensions.dll @legacyResources @flags ('/out:'+$target) $sources
if($LASTEXITCODE -ne 0){throw 'Native admission worker build failed'}
Write-Output 'Built native admission worker only; no deployment, task registration or device changes'
