$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
& (Join-Path $PSScriptRoot 'build-usb-hid-admission-kernel.ps1') -GenerateOnly
$framework=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319'
$sources=@('apps/desktop/UsbHidAdmissionSelection.cs','apps/desktop/UsbHidAdmissionNativeAuthority.cs','tools/usb/UsbHidAdmissionPolicy.cs','artifacts/hid-admission-kernel/UsbHidAdmissionTransaction.generated.cs','apps/desktop/UsbAdmissionTabModel.cs','apps/desktop/UsbExactBlockNativeAuthority.cs','apps/desktop/UsbAdmissionAuthorization.cs','apps/desktop/UsbOwnerVerification.cs','apps/desktop/UsbAdmissionInventory.cs','apps/desktop/UsbInternalDetection.cs','apps/desktop/UsbConnectorEvidence.cs','tools/usb/UsbAdmissionPreflight.cs','tools/usb/UsbExactBlockState.cs','tools/usb/UsbExactBlockTransaction.cs','tools/usb/tests/UsbHidAdmissionSelectionTest.cs')|ForEach-Object{Join-Path $root $_}
$out=Join-Path $root 'artifacts/UsbHidAdmissionSelectionTest.exe'
New-Item -ItemType Directory -Force (Split-Path $out) | Out-Null
& (Join-Path $framework 'csc.exe') /nologo /target:exe ('/out:'+$out) ('/reference:'+(Join-Path $framework 'System.Runtime.WindowsRuntime.dll')) $sources
if($LASTEXITCODE -ne 0){throw 'HID admission selection build failed'}
& $out
if($LASTEXITCODE -ne 0){throw 'HID admission selection test failed'}


