$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$framework=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319'
$sources=@('tools/usb/UsbHidSetupApi.cs','apps/desktop/UsbAdmissionInventory.cs','apps/desktop/UsbInternalDetection.cs','apps/desktop/UsbConnectorEvidence.cs','tools/usb/UsbAdmissionPreflight.cs','tools/usb/UsbHidPnpTransaction.cs','tools/usb/UsbHidPnpFileJournal.cs','tools/usb/UsbHidCommittedDisableLedger.cs','tools/usb/UsbExactBlockState.cs','tools/usb/DuckyPolicyJournal.cs','tools/usb/tests/UsbHidCommittedDisableLedgerTest.cs')|ForEach-Object{Join-Path $root $_}
$out=Join-Path $root 'artifacts/UsbHidCommittedDisableLedgerTest.exe'
& (Join-Path $framework 'csc.exe') /nologo /target:exe ('/out:'+$out) $sources
if($LASTEXITCODE -ne 0){throw 'SetupAPI tests build failed'}
& $out
if($LASTEXITCODE -ne 0){throw 'SetupAPI tests failed'}



