$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$framework=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319'
$sources=@('apps/desktop/UsbExactBlockSelection.cs','apps/desktop/UsbAdmissionTabModel.cs','apps/desktop/UsbExactBlockNativeAuthority.cs','apps/desktop/UsbAdmissionAuthorization.cs','apps/desktop/UsbOwnerVerification.cs','apps/desktop/UsbAdmissionInventory.cs','apps/desktop/UsbInternalDetection.cs','apps/desktop/UsbConnectorEvidence.cs','tools/usb/UsbAdmissionPreflight.cs','tools/usb/UsbExactBlockState.cs','tools/usb/UsbExactBlockTransaction.cs','tools/usb/tests/UsbExactBlockSelectionTest.cs')|ForEach-Object{Join-Path $root $_}
$out=Join-Path $root 'artifacts/UsbExactBlockSelectionTest.exe'
New-Item -ItemType Directory -Force (Split-Path $out) | Out-Null
& (Join-Path $framework 'csc.exe') /nologo /target:exe ('/out:'+$out) ('/reference:'+(Join-Path $framework 'System.Runtime.WindowsRuntime.dll')) $sources
if($LASTEXITCODE -ne 0){throw 'Exact selection build failed'}
& $out
if($LASTEXITCODE -ne 0){throw 'Exact selection test failed'}
