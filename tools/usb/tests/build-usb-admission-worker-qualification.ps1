param([switch]$UseExistingWorker)
$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
if(!$UseExistingWorker){& "$PSScriptRoot/build-usb-admission-worker.ps1" -PrivateQualification}
$compiler=Join-Path $root 'target/debug/sentinel-usb-policy-plan.exe'
if(!(Test-Path $compiler)){throw 'Build canonical Rust compiler first'}
$csc=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
$sources=@('UsbAdmissionWorker.cs','UsbAdmissionMachineGpo.cs','UsbAdmissionCleanupStage.cs','UsbSavedAdmissionEntry.cs','UsbAdmissionJournal.cs','DuckyPolicyJournal.cs','DuckyLocalGpo.cs','DuckyWorkerJob.cs','DuckyWorkerLease.cs','UsbAdmissionTransaction.cs','UsbEnrollmentConfig.cs','UsbAdmissionPolicySurvey.cs','UsbAdmissionNativeStores.cs')|ForEach-Object{Join-Path $root ('tools/usb/'+$_)}
$sources+=@('tools/usb/UsbAdmissionLegacyState.cs','tools/usb/UsbLegacyReleasedBaseline.cs','apps/desktop/DuckyPolicyEnrollment.cs')|ForEach-Object{Join-Path $root $_}
$legacyResources=@(('/resource:'+(Join-Path $root 'tools/usb/DuckyPolicyEntry.cs')+',Sentinel.LegacySource.Current'))
$historical=Join-Path $root 'artifacts/LegacyDuckyEntry-d0c3349.cs'
$info=[Diagnostics.ProcessStartInfo]::new('git','show d0c3349:tools/usb/DuckyPolicyEntry.cs');$info.WorkingDirectory=$root;$info.UseShellExecute=$false;$info.RedirectStandardOutput=$true;$info.RedirectStandardError=$true;$info.CreateNoWindow=$true
$process=[Diagnostics.Process]::Start($info)
try{$bytes=[IO.MemoryStream]::new();$process.StandardOutput.BaseStream.CopyTo($bytes);$errorText=$process.StandardError.ReadToEnd();$process.WaitForExit();if($process.ExitCode -eq 0){[IO.File]::WriteAllBytes($historical,$bytes.ToArray());$legacyResources+=('/resource:'+$historical+',Sentinel.LegacySource.Historical')}}finally{$process.Dispose();if($bytes){$bytes.Dispose()}}

$target=Join-Path $root 'artifacts/Sentinel.UsbAdmissionWorkerQualification.exe'
$worker=Join-Path $root 'artifacts/Sentinel.UsbAdmissionWorker.Private.exe'
& $csc /nologo /target:exe /platform:x64 /main:UsbAdmissionWorkerQualification /reference:Microsoft.CSharp.dll /reference:System.Web.Extensions.dll @legacyResources /define:SENTINEL_USB_ADMISSION_PRIVATE_QUALIFICATION ('/resource:'+$worker+',Sentinel.Admission.Worker') ('/resource:'+$compiler+',Sentinel.Admission.Compiler') ('/win32manifest:'+(Join-Path $root 'apps/desktop/password-approval.manifest')) ('/out:'+$target) (Join-Path $PSScriptRoot 'UsbAdmissionWorkerQualification.cs') $sources
if($LASTEXITCODE -ne 0){throw 'Native private backend qualification build failed'}
Write-Output 'Built private actual backend qualification; not executed, no task registration'
