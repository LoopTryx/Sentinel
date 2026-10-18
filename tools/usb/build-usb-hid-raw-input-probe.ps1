$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$out=Join-Path $root 'artifacts/UsbHidRawInputProbe.exe'
$sources=@('tools/usb/UsbHidRawInputProbe.cs','tools/usb/UsbAdmissionPreflight.cs','apps/desktop/UsbAdmissionInventory.cs','apps/desktop/UsbConnectorEvidence.cs','apps/desktop/UsbInternalDetection.cs')|ForEach-Object {Join-Path $root $_}
& "$env:WINDIR/Microsoft.NET/Framework64/v4.0.30319/csc.exe" /nologo /target:exe ("/out:"+$out) /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Web.Extensions.dll $sources
if($LASTEXITCODE -ne 0){throw 'Metadata probe build failed'}
& $out --self-test
if($LASTEXITCODE -ne 0){throw 'Metadata probe self-test failed'}
Write-Output 'Probe built and pure tests passed. UI was not launched; run artifacts/UsbHidRawInputProbe.exe explicitly.'

