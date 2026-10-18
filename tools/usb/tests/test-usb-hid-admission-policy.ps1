$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$out=Join-Path $root 'artifacts/UsbHidAdmissionPolicyTest.exe'
& "$env:WINDIR/Microsoft.NET/Framework64/v4.0.30319/csc.exe" /nologo /target:exe ("/out:"+$out) (Join-Path $root 'tools/usb/UsbExactBlockState.cs') (Join-Path $root 'tools/usb/UsbHidAdmissionPolicy.cs') (Join-Path $root 'tools/usb/tests/UsbHidAdmissionPolicyTest.cs')
if($LASTEXITCODE -ne 0){throw 'HID policy build failed'}
& $out
if($LASTEXITCODE -ne 0){throw 'HID policy tests failed'}
