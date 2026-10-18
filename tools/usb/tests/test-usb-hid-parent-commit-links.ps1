param([string]$ProtectedPrivateNonce,[switch]$BuildOnly)
$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$csc=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
$target=Join-Path $root 'artifacts/UsbHidParentCommitLinksTest.exe'
$sources=@('tools/usb/UsbHidParentCommitLinks.cs','tools/usb/UsbHidAdmissionPolicy.cs','tools/usb/UsbHidCommittedDisableLedger.cs','tools/usb/UsbHidPnpFileJournal.cs','tools/usb/UsbHidPnpTransaction.cs','tools/usb/UsbHidSetupApi.cs','tools/usb/UsbExactBlockState.cs','tools/usb/DuckyPolicyJournal.cs','apps/desktop/UsbAdmissionInventory.cs','apps/desktop/UsbInternalDetection.cs','apps/desktop/UsbConnectorEvidence.cs','tools/usb/UsbAdmissionPreflight.cs','tools/usb/tests/UsbHidParentCommitLinksTest.cs')|ForEach-Object{Join-Path $root $_}
& $csc /nologo /target:exe /platform:x64 /define:SENTINEL_USB_HID_LINK_PRIVATE ('/out:'+$target) $sources
if($LASTEXITCODE -ne 0){throw 'Parent commit links build failed'}
if($BuildOnly){return}
if($ProtectedPrivateNonce){if($ProtectedPrivateNonce -cnotmatch '\A[0-9a-f]{32}\z'){throw 'Private fixture nonce required'};& $target --protected-private $ProtectedPrivateNonce}else{& $target}
if($LASTEXITCODE -ne 0){throw 'Parent commit links regression failed'}
