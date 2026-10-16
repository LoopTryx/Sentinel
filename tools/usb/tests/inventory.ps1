$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../read-inventory.ps1')
function Assert($condition,$message){if(-not $condition){throw $message}}
$at=[datetime]::SpecifyKind([datetime]'2026-10-10T12:00:00',[DateTimeKind]::Utc)
$rows=@(
    [pscustomobject]@{Id='USB\root-secret';Parent='';Container='11111111-1111-1111-1111-111111111111';Class='USB'},
    [pscustomobject]@{Id='USBSTOR\serial-secret';Parent='USB\root-secret';Container='11111111-1111-1111-1111-111111111111';Class='DiskDrive'},
    [pscustomobject]@{Id='HID\serial-secret';Parent='USB\root-secret';Container='11111111-1111-1111-1111-111111111111';Class='Keyboard'},
    [pscustomobject]@{Id='HID\bluetooth';Parent='BTH\parent';Container='22222222-2222-2222-2222-222222222222';Class='Mouse'},
    [pscustomobject]@{Id='BTH\parent';Parent='';Container='';Class='Bluetooth'}
)
$snapshot=ConvertTo-SentinelUsbSnapshot -Rows $rows -ObservedAt $at
Assert ($snapshot.devices.Count -eq 1) 'Bluetooth HID must not be reported as proven USB.'
Assert ($snapshot.devices[0].interfaces -contains 'storage') 'Storage interface missing.'
Assert ($snapshot.devices[0].interfaces -contains 'hid_keyboard') 'Composite HID interface missing.'
$json=ConvertTo-Json -InputObject $snapshot -Depth 6 -Compress
Assert (-not $json.Contains('serial-secret') -and -not $json.Contains('root-secret')) 'Device IDs leaked.'
$unknown=ConvertTo-SentinelUsbSnapshot -Rows @([pscustomobject]@{Id='HID\unknown';Parent='';Container='';Class='Keyboard'}) -ObservedAt $at
Assert ($unknown.state -eq 'partial' -and $unknown.devices[0].usbEvidence -eq 'unresolved') 'Unresolved HID ancestry must be partial.'
$empty=ConvertTo-SentinelUsbSnapshot -Rows @() -ObservedAt $at
Assert ($empty.state -eq 'observed' -and $empty.devices.Count -eq 0) 'Empty snapshot must remain an observation.'
$wide=@(1..100|ForEach-Object{[pscustomobject]@{Id="USB\$_";Parent='';Container='';Class='USB'}})
$bounded=ConvertTo-SentinelUsbSnapshot -Rows $wide -ObservedAt $at
Assert ($bounded.devices.Count -eq 64 -and $bounded.state -eq 'partial' -and $bounded.omitted -ge 36) 'Device output must be bounded before retention.'
$cycle=ConvertTo-SentinelUsbSnapshot -Rows @([pscustomobject]@{Id='HID\loop';Parent='HID\loop';Container='';Class='Keyboard'}) -ObservedAt $at
Assert ($cycle.state -eq 'partial') 'Parent cycle must not prove USB ancestry.'
Assert (($snapshot.PSObject.Properties.Name -join ',') -notmatch 'blocked|approved|safe') 'Inventory must carry no action authority.'
Write-Output 'USB inventory regressions PASS: composite, Bluetooth, redaction, unresolved, empty, bounds, cycle, no authority.'
$rows[0] | Add-Member -NotePropertyName DisplayName -NotePropertyValue 'Example USB board'
$named=ConvertTo-SentinelUsbSnapshot -Rows $rows -ObservedAt $at
Assert ($named.devices[0].name -eq 'Example USB board') 'Reported USB parent name should be displayed.'
$rows[0].DisplayName='USB Input Device'
$generic=ConvertTo-SentinelUsbSnapshot -Rows $rows -ObservedAt $at
Assert (-not $generic.devices[0].PSObject.Properties['name']) 'Generic descriptors should remain unnamed.'

$wild=ConvertTo-SentinelUsbSnapshot -Rows @([pscustomobject]@{Id='USB\*';Parent='';Container='';Class='USB'}) -ObservedAt $at
Assert ($wild.state -eq 'partial' -and $wild.devices.Count -eq 0) 'Wildcard identifiers must not reach device queries or reports.'
