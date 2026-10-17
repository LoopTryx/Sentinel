$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$csc=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
$target=Join-Path $root 'artifacts/Sentinel.UsbAdmissionTabModelTest.exe'
$sources=@('apps/desktop/UsbAdmissionTabModel.cs','apps/desktop/UsbAdmissionInventory.cs','apps/desktop/UsbConnectorEvidence.cs','apps/desktop/UsbInternalDetection.cs','tools/usb/UsbAdmissionPreflight.cs','tools/usb/tests/UsbAdmissionTabModelTest.cs')|ForEach-Object{Join-Path $root $_}
& $csc /nologo /target:exe /platform:x64 /reference:System.Web.Extensions.dll /main:UsbAdmissionTabModelTest ('/out:'+$target) $sources
if($LASTEXITCODE -ne 0){throw 'USB tab model test build failed'}
& $target
if($LASTEXITCODE -ne 0){throw 'USB tab model regression failed'}
