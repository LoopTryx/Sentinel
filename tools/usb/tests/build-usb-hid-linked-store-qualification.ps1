$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
& (Join-Path $PSScriptRoot 'build-usb-hid-admission-kernel.ps1') -GenerateOnly|Out-Null
$sources=@('artifacts/hid-admission-kernel/UsbHidAdmissionTransaction.generated.cs','artifacts/hid-admission-kernel/UsbHidAdmissionFileStore.generated.cs','tools/usb/UsbHidParentCommitLinks.cs','tools/usb/UsbHidAdmissionPolicy.cs','tools/usb/UsbHidCommittedDisableLedger.cs','tools/usb/UsbHidPnpFileJournal.cs','tools/usb/UsbHidPnpTransaction.cs','tools/usb/UsbHidSetupApi.cs','tools/usb/UsbExactBlockState.cs','tools/usb/DuckyPolicyJournal.cs','apps/desktop/UsbAdmissionInventory.cs','apps/desktop/UsbInternalDetection.cs','apps/desktop/UsbConnectorEvidence.cs','tools/usb/UsbAdmissionPreflight.cs','tools/usb/tests/UsbHidLinkedStoreQualification.cs')|ForEach-Object{Join-Path $root $_}
$csc=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
$target=Join-Path $root 'artifacts/UsbHidLinkedStoreQualification.exe'
& $csc /nologo /target:exe /platform:x64 /define:SENTINEL_USB_HID_LINK_PRIVATE,SENTINEL_USB_HID_JOURNAL_PRIVATE,SENTINEL_USB_HID_PNP_LINKED ('/out:'+$target) $sources
if($LASTEXITCODE -ne 0){throw 'Protected linked store qualifier build failed'}
Write-Output ('Built '+$target+' --protected-private-linked; explicit elevation required; no test executed')
