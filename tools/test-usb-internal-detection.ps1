$ErrorActionPreference='Stop'
$repo=Split-Path -Parent $PSScriptRoot
Add-Type -Path (Join-Path $repo 'apps\desktop\UsbInternalDetection.cs')
function Check($expected,$chain,$service,$deviceClass,$touchpad,$complete=$true){$r=[UsbInternalDetection]::Classify($chain,$service,$deviceClass,$touchpad,$complete);if($r.State -ne $expected -or $r.ExemptionVerified){throw 'Internal candidate classification failed'}}
Check 'internal_candidate' @('ACPI','PCI','ACPI','ROOT','HTREE') 'i8042prt' 'Keyboard' $false
Check 'internal_candidate' @('HID','ACPI','PCI','ROOT','HTREE') 'hidi2c' 'HIDClass' $true
Check 'unresolved_usb' @('HID','USB','ACPI','ROOT','HTREE') 'i8042prt' 'Keyboard' $false
Check 'external_bluetooth' @('HID','BTHLEDEVICE','ACPI','ROOT','HTREE') 'mouhid' 'HIDClass' $true
Check 'unresolved' @('HID','ROOT','HTREE') 'i8042prt' 'Keyboard' $false
Check 'unresolved' @('ACPI','ROOT','HTREE') 'unknown' 'Keyboard' $false
Check 'unresolved' @('ACPI','ROOT','HTREE') 'i8042prt' 'Keyboard' $false $false
Check 'unresolved' (@('HID')*13) 'i8042prt' 'Keyboard' $false
if(-not [UsbInternalDetection]::HasTouchpadUsage("HID\VENDOR&UP:000D_U:0005`0") -or [UsbInternalDetection]::HasTouchpadUsage('HID_DEVICE_UP:000D_U:0050')){throw 'HID touchpad usage parsing failed'}
Write-Output 'Internal candidate bus/service/usage/bounds/conflict regressions PASS; no exemption asserted.'
