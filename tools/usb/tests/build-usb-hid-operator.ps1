$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'build-usb-hid-controller.ps1')
$sources+=@('apps/desktop/UsbAdmissionTab.cs','apps/desktop/UsbHidAdmissionTab.cs','apps/desktop/UsbAdmissionTabPipe.cs','apps/desktop/UsbAdmissionDeviceActions.cs','apps/desktop/UsbAdmissionWindow.cs','apps/desktop/UsbAdmissionConsoleOwner.cs','apps/desktop/UsbAdmissionDeviceRecovery.cs','tools/usb/UsbAdmissionRestartSelection.cs','tools/usb/UsbAdmissionNativeStores.cs','apps/desktop/UsbAdmissionNativeAuthority.cs')|ForEach-Object{Join-Path $root $_}
$operator=Join-Path $root 'artifacts/hid-admission-live-linked/Sentinel.UsbGuard.exe'
$options=$options|Where-Object{$_ -ne '/target:library'}
$options+='/target:winexe'
& $csc @options /main:UsbAdmissionWindow ('/out:'+$operator) ('/win32manifest:'+(Join-Path $root 'apps/desktop/password-approval.manifest')) $sources
if($LASTEXITCODE -ne 0){throw 'HID linked console operator compilation failed'}
Write-Output ('Built '+$operator+'; not installed or activated')
