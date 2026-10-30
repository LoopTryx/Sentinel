param([string]$ProtectedPrivateNonce,[switch]$BuildOnly,[switch]$ProvisionPrivate)
$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$csc=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
$target=Join-Path $root 'artifacts/UsbHidPnpFileJournalTest.exe'
$sources=@('tools/usb/UsbHidPnpFileJournal.cs','tools/usb/UsbHidPnpTransaction.cs','tools/usb/UsbHidSetupApi.cs','tools/usb/UsbExactBlockState.cs','tools/usb/DuckyPolicyJournal.cs','apps/desktop/UsbAdmissionInventory.cs','apps/desktop/UsbInternalDetection.cs','apps/desktop/UsbConnectorEvidence.cs','tools/usb/UsbAdmissionPreflight.cs','tools/usb/tests/UsbHidPnpFileJournalTest.cs')|ForEach-Object{Join-Path $root $_}
if($ProvisionPrivate){
 if($ProtectedPrivateNonce){throw 'Use either existing or new private fixture, not both'}
 $target=Join-Path $root 'artifacts/UsbHidPnpJournalQualification.exe'
 $sources+=Join-Path $root 'tools/usb/tests/UsbHidPnpJournalQualification.cs'
 & $csc /nologo /target:exe /platform:x64 /define:SENTINEL_USB_HID_JOURNAL_PRIVATE /main:UsbHidPnpJournalQualification ('/out:'+$target) $sources
}else{
 & $csc /nologo /target:exe /platform:x64 /define:SENTINEL_USB_HID_JOURNAL_PRIVATE ('/out:'+$target) $sources
}
if($LASTEXITCODE -ne 0){throw 'PnP journal test compilation failed'}
if($BuildOnly){return}
if($ProtectedPrivateNonce){
 if($ProtectedPrivateNonce -cnotmatch '\A[0-9a-f]{32}\z'){throw 'Private fixture nonce required'}
 # The elevated fixture must be explicitly provisioned with protected SY/BA
 # ownership/ACLs. This script neither grants access nor provisions a directory.
 & $target --protected-private $ProtectedPrivateNonce
}else{& $target}
if($LASTEXITCODE -ne 0){throw 'PnP journal regression failed'}
