$ErrorActionPreference='Stop'
. "$PSScriptRoot/../rp2040-target.ps1"
$root='USB\VID_0001&PID_0001\BOARD'
$parents=@{'HID\A'='USB\INTERFACE';'USB\INTERFACE'=$root;'HID\B'='USB\OTHER'}
$read={param($id) $parents[$id]}.GetNewClosure()
$a=[pscustomobject]@{InstanceId='HID\A';Class='Keyboard'}
$b=[pscustomobject]@{InstanceId='HID\B';Class='Keyboard'}
if((Resolve-Rp2040Keyboard $root @($a,$b) $read) -cne 'HID\A'){throw 'Wrong target'}
foreach($items in @(@($b),@($a,$a))){$refused=$false;try{Resolve-Rp2040Keyboard $root $items $read}catch{$refused=$true};if(!$refused){throw 'Unsafe selection accepted'}}
Write-Output 'PASS: exact ancestry selection; absent and ambiguous targets refused. No devices changed.'
