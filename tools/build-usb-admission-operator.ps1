param([switch]$ReviewedLive,[switch]$UseExistingWorker)
$ErrorActionPreference='Stop'
if($UseExistingWorker -and !$ReviewedLive){throw 'Reusing the installed live worker requires explicit reviewed live scope'}
$root=Split-Path -Parent $PSScriptRoot
$framework=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319'
$cargo=Join-Path $env:USERPROFILE '.cargo/bin/cargo.exe'
$oldToolchain=$env:RUSTUP_TOOLCHAIN;$oldTarget=$env:CARGO_TARGET_DIR
try{
 $env:RUSTUP_TOOLCHAIN='1.98.1-x86_64-pc-windows-gnu';$env:CARGO_TARGET_DIR=Join-Path $root 'target'
 Push-Location $root
 try{& $cargo build --offline -p sentinel-usb --bin sentinel-usb-policy-plan;if($LASTEXITCODE -ne 0){throw 'Canonical USB policy compiler build failed'}}finally{Pop-Location}
}finally{$env:RUSTUP_TOOLCHAIN=$oldToolchain;$env:CARGO_TARGET_DIR=$oldTarget}
$common=@('tools/usb/UsbAdmissionWorker.cs','tools/usb/UsbAdmissionMachineGpo.cs','tools/usb/UsbAdmissionCleanupStage.cs','tools/usb/UsbSavedAdmissionEntry.cs','tools/usb/UsbAdmissionJournal.cs','tools/usb/DuckyPolicyJournal.cs','tools/usb/DuckyLocalGpo.cs','tools/usb/DuckyWorkerJob.cs','tools/usb/DuckyWorkerLease.cs','tools/usb/UsbAdmissionTransaction.cs','tools/usb/UsbEnrollmentConfig.cs','tools/usb/UsbAdmissionPolicySurvey.cs')|ForEach-Object{Join-Path $root $_}
$common+=@('tools/usb/UsbAdmissionLegacyState.cs','tools/usb/UsbLegacyReleasedBaseline.cs','apps/desktop/DuckyPolicyEnrollment.cs')|ForEach-Object{Join-Path $root $_}
$worker=Join-Path $root 'artifacts/Sentinel.UsbAdmissionWorker.exe'
$options=@('/nologo','/platform:x64',('/reference:'+(Join-Path $framework 'Microsoft.CSharp.dll')))
if($ReviewedLive){$options+='/define:SENTINEL_USB_ADMISSION_LIVE_REVIEWED'}
if(!$UseExistingWorker){& (Join-Path $root 'tools/usb/tests/build-usb-admission-worker.ps1') -ReviewedLive:$ReviewedLive}else{
 $manifest=Get-Content -LiteralPath (Join-Path $env:ProgramData 'SentinelUsbAdmission/admission-images.txt');if($manifest.Count -lt 2 -or $manifest[0] -ne ('worker-'+(Get-FileHash $worker).Hash.ToLowerInvariant()+'.exe')){throw 'Existing installed worker identity mismatch'}
}
$compiler=Join-Path $root 'target/debug/sentinel-usb-policy-plan.exe'
$operator=Join-Path $root 'artifacts/Sentinel.UsbGuard.exe'
$ui=@('apps/desktop/UsbAdmissionTabModel.cs','apps/desktop/UsbAdmissionTab.cs','apps/desktop/UsbAdmissionTabPipe.cs','apps/desktop/UsbAdmissionDeviceActions.cs','apps/desktop/UsbAdmissionWindow.cs','apps/desktop/UsbAdmissionConsoleOwner.cs','apps/desktop/UsbAdmissionDeviceRecovery.cs','tools/usb/UsbAdmissionRestartSelection.cs','apps/desktop/UsbAdmissionAuthorization.cs','apps/desktop/UsbAdmissionNativeAuthority.cs','apps/desktop/UsbOwnerVerification.cs','apps/desktop/UsbAdmissionInventory.cs','apps/desktop/UsbInternalDetection.cs','apps/desktop/UsbConnectorEvidence.cs','tools/usb/UsbAdmissionPreflight.cs','tools/usb/UsbAdmissionNativeStores.cs')|ForEach-Object{Join-Path $root $_}
$legacyResources=@(('/resource:'+(Join-Path $root 'tools/usb/DuckyPolicyEntry.cs')+',Sentinel.LegacySource.Current'),('/resource:'+(Join-Path $root 'artifacts/LegacyDuckyEntry-d0c3349.cs')+',Sentinel.LegacySource.Historical'))
$references=@('System.Web.Extensions.dll','System.Windows.Forms.dll','System.Drawing.dll','System.Runtime.WindowsRuntime.dll')|ForEach-Object{'/reference:'+(Join-Path $framework $_)}
& (Join-Path $framework 'csc.exe') @options /target:winexe /main:UsbAdmissionWindow ('/out:'+$operator) ('/win32manifest:'+(Join-Path $root 'apps/desktop/password-approval.manifest')) ('/resource:'+$worker+',Sentinel.Admission.Worker') ('/resource:'+$compiler+',Sentinel.Admission.Compiler') @legacyResources @references $common $ui
if($LASTEXITCODE -ne 0){throw 'Native USB Guard operator build failed'}
Write-Output 'Built artifacts/Sentinel.UsbGuard.exe; no deployment or USB action performed'
if(-not $ReviewedLive){Write-Output 'Live device policy remains compile-disabled; reviewed live build requires explicit -ReviewedLive'}
