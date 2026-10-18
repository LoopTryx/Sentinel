$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
# Reuse the exact live worker source/resource profile; this only builds code.
. (Join-Path $PSScriptRoot 'build-usb-hid-admission-backend.ps1') -ReviewedLiveLinked
$sources+=@('tools/usb/UsbAdmissionWorker.cs','tools/usb/UsbAdmissionMachineGpo.cs','tools/usb/UsbAdmissionCleanupStage.cs','tools/usb/UsbAdmissionJournal.cs','tools/usb/DuckyWorkerLease.cs','tools/usb/UsbAdmissionTransaction.cs','tools/usb/UsbEnrollmentConfig.cs','tools/usb/UsbAdmissionPolicySurvey.cs','tools/usb/UsbAdmissionLegacyState.cs','tools/usb/UsbLegacyReleasedBaseline.cs','apps/desktop/UsbHidAdmissionOperations.cs','apps/desktop/UsbHidAdmissionCapability.cs','apps/desktop/UsbHidAdmissionSelection.cs','apps/desktop/UsbHidAdmissionNativeAuthority.cs','apps/desktop/UsbAdmissionAuthorization.cs','apps/desktop/UsbOwnerVerification.cs','apps/desktop/UsbAdmissionTabModel.cs')|ForEach-Object{Join-Path $root $_}
$sources=$sources|Select-Object -Unique
$controller=Join-Path $root 'artifacts/hid-admission-live-linked/Sentinel.HidAdmission.Controller.dll'
$options=$options|Where-Object{$_ -ne '/target:exe'}
$options+=@('/target:library','/reference:System.Runtime.WindowsRuntime.dll','/reference:System.Windows.Forms.dll','/reference:System.Drawing.dll')
& $csc @options ('/out:'+$controller) $sources
if($LASTEXITCODE -ne 0){throw 'HID linked native controller compilation failed'}
Write-Output ('Built '+$controller+'; compile only, no installation or device access change')
