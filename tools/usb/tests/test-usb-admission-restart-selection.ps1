$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$csc=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
$target=Join-Path $root 'artifacts/Sentinel.UsbAdmissionRestartSelectionTest.exe'
$sources=@('tools/usb/UsbAdmissionRestartSelection.cs','tools/usb/UsbAdmissionPreflight.cs','apps/desktop/UsbInternalDetection.cs','tools/usb/tests/UsbAdmissionRestartSelectionTest.cs')|ForEach-Object{Join-Path $root $_}
& $csc /nologo /target:exe /platform:x64 /main:UsbAdmissionRestartSelectionTest ('/out:'+$target) $sources
if($LASTEXITCODE -ne 0){throw 'Restart selection test build failed'}
& $target
if($LASTEXITCODE -ne 0){throw 'Restart selection regression failed'}
