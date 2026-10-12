param(
 [ValidateSet('List','Hold','Restore')][string]$Mode='List',
 [string]$LabComputerName,
 [string]$DailyComputerName,
 [string]$InstanceId,
 [string]$ReceiptPath
)
$ErrorActionPreference='Stop'
if($Mode -eq 'List'){
 Get-PnpDevice -PresentOnly -Class Keyboard | Select-Object Status,FriendlyName,InstanceId
 exit
}
if(-not $LabComputerName -or -not $DailyComputerName -or $LabComputerName -eq $DailyComputerName -or $env:COMPUTERNAME -ne $LabComputerName -or $env:COMPUTERNAME -eq $DailyComputerName){throw 'Only the explicitly named secondary lab computer may change input state.'}
if(-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){throw 'Run this lab tool as Administrator on the secondary computer.'}
if(-not $InstanceId -or $InstanceId -notmatch '^HID\\VID_[0-9A-F]{4}&PID_[0-9A-F]{4}' -or $InstanceId -match '[*?\[\]]'){throw 'Select one exact USB HID keyboard instance; wildcards and other devices are refused.'}
$device=@(Get-PnpDevice -PresentOnly -InstanceId $InstanceId)
if($device.Count -ne 1 -or $device[0].Class -ne 'Keyboard'){throw 'The exact selected keyboard is not present.'}
# A HID identifier alone does not prove USB transport. Require a USB ancestor.
$ancestor=$InstanceId
$usbAncestor=$false
for($depth=0;$depth -lt 8;$depth++){
 $parent=(Get-PnpDeviceProperty -InstanceId $ancestor -KeyName DEVPKEY_Device_Parent).Data
 if(-not $parent -or $parent -eq $ancestor){break}
 if($parent -match '^USB\\VID_[0-9A-F]{4}&PID_[0-9A-F]{4}'){$usbAncestor=$true;break}
 $ancestor=$parent
}
if(-not $usbAncestor){throw 'USB ancestry could not be verified; no device state changed.'}
$receipt=if($ReceiptPath){[IO.Path]::GetFullPath($ReceiptPath)}else{Join-Path $PSScriptRoot 'hold-receipt.json'}
if($receipt -match '^(?i:E:|\\\\)'){throw 'Select local lab receipt storage.'}
if($Mode -eq 'Hold'){
 if(Test-Path -LiteralPath $receipt){throw 'Existing recovery receipt must be resolved first.'}
 $before=(Get-PnpDeviceProperty -InstanceId $InstanceId -KeyName DEVPKEY_Device_ProblemCode).Data
 if($before -ne 0){throw 'Device was already unhealthy or disabled; refusing to take ownership.'}
 $record=[pscustomobject]@{version=1;machine=$env:COMPUTERNAME;instanceId=$InstanceId;createdAt=[datetime]::UtcNow.ToString('o')}
 # Persist before changing exactly one device. This does not modify install policy.
 $record | ConvertTo-Json | Set-Content -LiteralPath $receipt -Encoding UTF8
 Disable-PnpDevice -InstanceId $InstanceId -Confirm:$false
 $problem=(Get-PnpDeviceProperty -InstanceId $InstanceId -KeyName DEVPKEY_Device_ProblemCode).Data
 if($problem -ne 22){throw 'Disabled state not verified. Keep the receipt and restore the device.'}
 'Selected keyboard disabled (Windows problem code22). Perform the controlled typing test; no universal pre-input claim.'
} else {
 $record=Get-Content -LiteralPath $receipt -Raw | ConvertFrom-Json
 if($record.version -ne 1 -or $record.machine -ne $env:COMPUTERNAME -or $record.instanceId -ne $InstanceId){throw 'Recovery receipt does not match this device and computer.'}
 Enable-PnpDevice -InstanceId $InstanceId -Confirm:$false
 if((Get-PnpDeviceProperty -InstanceId $InstanceId -KeyName DEVPKEY_Device_ProblemCode).Data -ne 0){throw 'Restore was not verified; retain recovery receipt.'}
 Move-Item -LiteralPath $receipt -Destination ($receipt+'.restored-'+[DateTime]::UtcNow.ToString('yyyyMMddHHmmss'))
 'Selected keyboard restored and verified.'
}
