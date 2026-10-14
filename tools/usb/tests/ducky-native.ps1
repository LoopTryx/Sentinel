$ErrorActionPreference='Stop'
$source=Join-Path $PSScriptRoot '../DuckyNativeBackend.cs'
Add-Type -Path $source
foreach($bad in @('','HID\*','ACPI\keyboard','HID\bad"argument')){
 try{[SentinelDuckyNative]::Read($bad,'USB\VID_0000&PID_0000\test');throw 'Invalid ID accepted'}catch{if($_.Exception.Message -eq 'Invalid ID accepted'){throw}}
}
Write-Output 'Native Ducky rejects invalid targets PASS; no device mutation'
