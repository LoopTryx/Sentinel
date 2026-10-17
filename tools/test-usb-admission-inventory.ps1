param([switch]$Live)
$ErrorActionPreference='Stop'
Add-Type -Path @((Join-Path $PSScriptRoot '../apps/desktop/UsbInternalDetection.cs'),(Join-Path $PSScriptRoot '../apps/desktop/UsbConnectorEvidence.cs'),(Join-Path $PSScriptRoot '../tools/usb/UsbAdmissionPreflight.cs'),(Join-Path $PSScriptRoot '../apps/desktop/UsbAdmissionInventory.cs'))
function Assert($ok,$label){if(!$ok){throw $label}}
function Bad($action,$label){$rejected=$false;try{& $action}catch{$rejected=$true};Assert $rejected $label}
$empty=[byte[]]@(0,0)
Assert (([UsbAdmissionInventory]::DecodeStrings($empty,2,0x2012,$true)).Length -eq 0) 'Windows empty MULTISZ single terminator'
$bytes=[Text.Encoding]::Unicode.GetBytes("USB\Class_03`0USB\Other`0`0")
$r=[UsbAdmissionInventory]::DecodeStrings($bytes,$bytes.Length,0x2012,$true)
Assert ($r.Length -eq 2 -and $r[0] -eq 'USB\Class_03') 'Stringlist decode'
Bad { [UsbAdmissionInventory]::DecodeStrings($bytes,$bytes.Length,0x12,$true) } 'Type mismatch rejected'
Bad { [UsbAdmissionInventory]::DecodeStrings($bytes,3,0x2012,$true) } 'Oddbytes rejected'
Bad { [UsbAdmissionInventory]::DecodeStrings($bytes,($bytes.Length-2),0x2012,$true) } 'Missing terminator rejected'
$ids="USB\A`0USB\B`0`0".ToCharArray()
Assert (([UsbAdmissionInventory]::DecodeEnumeration($ids,$ids.Length)).Length -eq 2) 'Enumeration decode'
Bad { [UsbAdmissionInventory]::DecodeEnumeration("HID\A`0`0".ToCharArray(),7) } 'NonUSB enumeration rejected'
$duplicate="USB\A`0USB\A`0`0".ToCharArray()
Bad { [UsbAdmissionInventory]::DecodeEnumeration($duplicate,$duplicate.Length) } 'Duplicate enumeration rejected'
Assert (([UsbAdmissionInventory]::Display("Mouse`n<script>")) -eq 'Mousescript') 'Display sanitization'
Write-Output 'PASS: native USB inventory decoders and display sanitization'
if($Live){$r=[UsbAdmissionInventory]::Collect($null);[pscustomobject]@{State=$r.Preflight.State;FailureCode=$r.FailureCode;Complete=$r.Complete;PresentUsbNodes=$r.PresentUsbNodes;SafetyCandidates=$r.Preflight.SafetyCandidates;ExternalCandidates=$r.Preflight.ExternalCandidates;Unresolved=$r.Preflight.Unresolved;PropertyQueries=$r.PropertyQueries;CanActivate=$r.Preflight.CanActivate}}
