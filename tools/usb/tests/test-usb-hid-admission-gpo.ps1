param([switch]$Hkcu)
$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$csc=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
$target=Join-Path $root 'artifacts/UsbHidAdmissionGpoTest.exe'
$sources=@('tools/usb/UsbHidAdmissionGpo.cs','tools/usb/UsbHidAdmissionPolicy.cs','tools/usb/UsbExactBlockState.cs','tools/usb/UsbSavedAdmissionEntry.cs','tools/usb/DuckyLocalGpo.cs','tools/usb/tests/UsbHidAdmissionGpoTest.cs')|ForEach-Object{Join-Path $root $_}
& $csc /nologo /target:exe /platform:x64 /main:UsbHidAdmissionGpoTest ('/out:'+$target) $sources
if($LASTEXITCODE -ne 0){throw 'HID admission GPO test build failed'}
if($Hkcu){& $target --hkcu}else{& $target}
if($LASTEXITCODE -ne 0){throw 'HID admission GPO regression failed'}
