$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$csc=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
$target=Join-Path $root 'artifacts/Sentinel.UsbAdmissionDeviceRecoveryTest.exe'
$sources=@('apps/desktop/UsbAdmissionDeviceRecovery.cs','apps/desktop/UsbAdmissionInventory.cs','apps/desktop/UsbConnectorEvidence.cs','apps/desktop/UsbInternalDetection.cs','tools/usb/UsbAdmissionRestartSelection.cs','tools/usb/UsbAdmissionPreflight.cs','tools/usb/tests/UsbAdmissionDeviceRecoveryTest.cs')|ForEach-Object{Join-Path $root $_}
& $csc /nologo /target:exe /platform:x64 /main:UsbAdmissionDeviceRecoveryTest ('/out:'+$target) $sources
if($LASTEXITCODE -ne 0){throw 'Device recovery pure test build failed'}
& $target
if($LASTEXITCODE -ne 0){throw 'Device recovery pure regression failed'}
