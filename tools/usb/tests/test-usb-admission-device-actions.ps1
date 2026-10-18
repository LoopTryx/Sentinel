$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
& "$env:WINDIR/Microsoft.NET/Framework64/v4.0.30319/csc.exe" /nologo /target:exe ("/out:"+(Join-Path $root 'artifacts/DeviceActionsTest.exe')) (Join-Path $root 'apps/desktop/UsbAdmissionDeviceActions.cs') (Join-Path $root 'tools/usb/tests/UsbAdmissionDeviceActionsTest.cs')
if($LASTEXITCODE -ne 0){throw 'Card test build failed'}
& (Join-Path $root 'artifacts/DeviceActionsTest.exe')
if($LASTEXITCODE -ne 0){throw 'Card test failed'}
