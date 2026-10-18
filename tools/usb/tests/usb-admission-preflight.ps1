param([switch]$Collect,[switch]$CollectUsbHid)
$ErrorActionPreference='Stop'
Add-Type -Path @((Join-Path $PSScriptRoot '../../..//apps/desktop/UsbInternalDetection.cs'),(Join-Path $PSScriptRoot '../../..//apps/desktop/UsbConnectorEvidence.cs'),(Join-Path $PSScriptRoot '../UsbAdmissionPreflight.cs'))
function Item($id,$class,$chain,$service,$connector,$usage=$false){
 $i=[UsbAdmissionPreflight+Input]::new();$i.Instance=$id;$i.DeviceClass=$class;$i.ParentChain=$chain;$i.Complete=$true;$i.TransportService=$service;$i.ConnectorState=$connector;$i.TouchpadUsage=$usage;$i.ConnectorMatches=1;$i.LocationPaths=@("PCIROOT(0)#USBROOT(0)#USB(1)");return $i
}
function Assert($ok,$message){if(!$ok){throw $message}}
$internal=Item 'HID\INTERNAL' Keyboard @('HID\INTERNAL','USB\VID_TEST','ACPI\HOST','HTREE\ROOT\0') '' internal_port_candidate
$r=[UsbAdmissionPreflight]::Evaluate(@($internal),$true,$null)
Assert ($r.State -eq 'review_required' -and $r.SafetyCandidates -eq 1 -and !$r.CanActivate) 'Internal USB connector proof must remain approval-required candidate'
$ps2=Item 'ACPI\KEY' Keyboard @('ACPI\KEY','HTREE\ROOT\0') i8042prt ''
$i2c=Item 'HID\PAD' HIDClass @('HID\PAD','ACPI\I2C','HTREE\ROOT\0') hidi2c '' $true
$r=[UsbAdmissionPreflight]::Evaluate(@($ps2,$i2c),$true,$null)
Assert ($r.SafetyCandidates -eq 2 -and $r.UserApprovalRequired) 'NonUSB transport candidates'
$external=Item 'HID\EXTERNAL' Keyboard @('HID\EXTERNAL','USB\VID_OTHER','ACPI\HOST','HTREE\ROOT\0') '' user_connectable
$r=[UsbAdmissionPreflight]::Evaluate(@($external),$true,$null)
Assert ($r.ExternalCandidates -eq 1 -and $r.Candidates[0].UserApprovalRequired -and !$r.Candidates[0].ExemptionVerified) 'External input cannot auto-trust'
$external.ConnectorMatches=2
Assert (([UsbAdmissionPreflight]::Evaluate(@($external),$true,$null)).State -eq 'refused_ambiguous') 'Ambiguous connector'
$external.ConnectorMatches=1
$token=([UsbAdmissionPreflight]::Evaluate(@($external),$true,$null)).TopologyToken
$external.ParentChain=@('HID\EXTERNAL','USB\CHANGED','ACPI\HOST','HTREE\ROOT\0')
Assert (([UsbAdmissionPreflight]::Evaluate(@($external),$true,$token)).State -eq 'refused_topology_changed') 'Changed topology'
$external.Complete=$false
Assert (([UsbAdmissionPreflight]::Evaluate(@($external),$true,$null)).State -eq 'refused_incomplete') 'Incomplete chain'
$wide=Item 'HID\GENERAL' HIDClass @('HID\GENERAL','ACPI\HOST','HTREE\ROOT\0') '' ''
Assert (([UsbAdmissionPreflight]::Evaluate(@($wide),$true,$null)).State -eq 'refused_incomplete') 'No HIDClass-wide restriction'
Assert (([UsbAdmissionPreflight]::Evaluate(@($internal),$false,$null)).State -eq 'refused_incomplete') 'Partial enumeration'
$unknown=Item 'HID\UNKNOWN' Keyboard @('HID\UNKNOWN','USB\VID_X','ACPI\HOST','HTREE\ROOT\0') '' unresolved
Assert (([UsbAdmissionPreflight]::Evaluate(@($unknown),$true,$null)).State -eq 'refused_ambiguous') 'ACPI ancestor cannot prove internal USB'
$internal.ConnectorPartial=$true
Assert (([UsbAdmissionPreflight]::Evaluate(@($internal),$true,$null)).State -eq 'refused_ambiguous') 'Partial connector cannot classify internal'
$internal.ConnectorPartial=$false
$token=([UsbAdmissionPreflight]::Evaluate(@($internal),$true,$null)).TopologyToken
$internal.LocationPaths=@('PCIROOT(0)#USBROOT(0)#USB(2)')
Assert (([UsbAdmissionPreflight]::Evaluate(@($internal),$true,$token)).State -eq 'refused_topology_changed') 'Same-identity port change'
Assert (([UsbAdmissionPreflight]::Evaluate(@($internal,$internal),$true,$null)).State -eq 'refused_incomplete') 'Duplicate enumeration'
$usbInterface=Item 'USB\VID_X&PID_Y&MI_03\A' HIDClass @('USB\VID_X&PID_Y&MI_03\A','USB\VID_X&PID_Y\A','USB\ROOT_HUB\A','PCI\HOST','HTREE\ROOT\0') '' user_connectable
$usbInterface.CompatibleIds=@('USB\Class_03&SubClass_01&Prot_01','USB\Class_03&SubClass_01','USB\Class_03')
$r=[UsbAdmissionPreflight]::EvaluateUsbHid(@($usbInterface,$ps2,$i2c),$true,$null)
Assert ($r.State -eq 'review_required' -and $r.Candidates.Length -eq 1 -and $r.ExternalCandidates -eq 1 -and !$r.CanActivate) 'USB HID interface scoped target, nonUSB excluded'
$usbInterface.ConnectorState='internal_port_candidate'
Assert (([UsbAdmissionPreflight]::EvaluateUsbHid(@($usbInterface),$true,$null)).SafetyCandidates -eq 1) 'Internal USB interface candidate'
$usbStorage=Item 'USB\VID_STORAGE\A' USB @('USB\VID_STORAGE\A','PCI\HOST','HTREE\ROOT\0') '' user_connectable
$usbStorage.CompatibleIds=@('USB\Class_08')
$usbNetwork=Item 'USB\VID_NET\A' Net @('USB\VID_NET\A','PCI\HOST','HTREE\ROOT\0') '' user_connectable
$usbNetwork.CompatibleIds=@('USB\Class_02')
$r=[UsbAdmissionPreflight]::EvaluateUsbHid(@($usbInterface,$usbStorage,$usbNetwork,$i2c),$true,$null)
Assert ($r.Candidates.Length -eq 1) 'Composite nonHID functions not targeted'
$usbInterface.CompatibleIds=@('USB\Class_03&SubClass_01')
Assert (([UsbAdmissionPreflight]::EvaluateUsbHid(@($usbInterface),$true,$null)).State -eq 'refused_no_usb_hid') 'Exact compatibleID must exist'
$usbInterface.CompatibleIds=@('USB\Class_03')
$usbInterface.Instance='HID\CHILD';$usbInterface.ParentChain=@('HID\CHILD','USB\VID_X','HTREE\ROOT\0')
Assert (([UsbAdmissionPreflight]::EvaluateUsbHid(@($usbInterface),$true,$null)).State -eq 'refused_incomplete') 'HID child cannot impersonate policy target'
Write-Output 'PASS: admission preflight candidate selection; no policy/device writes'
if($Collect -or $CollectUsbHid){
 $complete=$true;$items=[System.Collections.Generic.List[UsbAdmissionPreflight+Input]]::new()
 $clock=[Diagnostics.Stopwatch]::StartNew();$cache=@{};$connectors=@{};$budget=@{Queries=0}
 function Read-Properties([string]$instance){
  if($clock.Elapsed.TotalSeconds -ge 60){throw 'collection_budget_exhausted'}
  if(!$cache.ContainsKey($instance)){
   if($cache.Count -ge 256 -or $budget.Queries -ge 512){throw 'collection_budget_exhausted'}
   $budget.Queries++
   $cache[$instance]=@(Get-PnpDeviceProperty -InstanceId $instance -KeyName @('DEVPKEY_Device_Service','DEVPKEY_Device_HardwareIds','DEVPKEY_Device_CompatibleIds','DEVPKEY_Device_Parent','DEVPKEY_Device_LocationPaths') -ErrorAction Stop)
  }
  if($clock.Elapsed.TotalSeconds -ge 60){throw 'collection_budget_exhausted'}
  return $cache[$instance]
 }
 try{$devices=@(Get-PnpDevice -PresentOnly -ErrorAction Stop)}catch{$devices=@();$complete=$false}
 foreach($device in $devices){
  if($clock.Elapsed.TotalSeconds -ge 60){$complete=$false;break}
  if($device.Class -notin @('Keyboard','Mouse','HIDClass')){continue}
  $i=[UsbAdmissionPreflight+Input]::new();$i.Instance=$device.InstanceId;$i.DeviceClass=$device.Class;$i.TransportService=''
  $chain=[System.Collections.Generic.List[string]]::new();$seen=[System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase);$locations=[System.Collections.Generic.List[string]]::new();$current=$i.Instance
  try{
   # Non-touchpad HID collections never enter parent/connector traversal.
   $leaf=@(Read-Properties $current)
   $i.CompatibleIds=@(($leaf|Where-Object KeyName -eq 'DEVPKEY_Device_CompatibleIds').Data)
   if($CollectUsbHid -and $i.CompatibleIds -notcontains 'USB\Class_03'){continue}
   foreach($key in @('DEVPKEY_Device_HardwareIds','DEVPKEY_Device_CompatibleIds')){if([UsbInternalDetection]::HasTouchpadUsage((($leaf|Where-Object KeyName -eq $key).Data -join "`0"))){$i.TouchpadUsage=$true}}
   if(!$CollectUsbHid -and $i.DeviceClass -eq 'HIDClass' -and !$i.TouchpadUsage){continue}
   for($depth=0;$depth -lt 12;$depth++){
    if($clock.Elapsed.TotalSeconds -ge 60){throw 'collection_budget_exhausted'}
    if(!$seen.Add($current)){break};$chain.Add($current)
    if($current.StartsWith('HTREE\',[StringComparison]::OrdinalIgnoreCase)){$i.Complete=$true;break}
    $props=@(Read-Properties $current)
    foreach($location in ($props|Where-Object KeyName -eq 'DEVPKEY_Device_LocationPaths').Data){if($location){$locations.Add($location)}}
    $service=($props|Where-Object KeyName -eq 'DEVPKEY_Device_Service').Data
    if($service -in @('hidi2c','i8042prt')){if($i.TransportService -and $i.TransportService -ne $service){throw 'conflicting_transport'};$i.TransportService=$service}
    # A composite &MI interface is not the physical port child.
    if($current.StartsWith('USB\VID_',[StringComparison]::OrdinalIgnoreCase) -and $current -notmatch '&MI_[0-9A-F]{2}(?:\\|&)'){
     if(!$connectors.ContainsKey($current)){$connectors[$current]=[UsbConnectorEvidence]::ForUsbParent($current)}
     if($clock.Elapsed.TotalSeconds -ge 60){throw 'collection_budget_exhausted'}
     $c=$connectors[$current];$i.ConnectorState=$c.state;$i.ConnectorMatches=$c.matches;$i.ConnectorPartial=$c.enumerationPartial
    }
    $current=($props|Where-Object KeyName -eq 'DEVPKEY_Device_Parent').Data;if(!$current){break}
   }
  }catch{$i.Complete=$false;$complete=$false}
  $i.ParentChain=$chain.ToArray();$i.LocationPaths=$locations.ToArray();$items.Add($i)
 }
 if($clock.Elapsed.TotalSeconds -ge 60){$complete=$false}
 if($CollectUsbHid){$result=[UsbAdmissionPreflight]::EvaluateUsbHid($items.ToArray(),$complete,$null)}else{$result=[UsbAdmissionPreflight]::Evaluate($items.ToArray(),$complete,$null)}
 [pscustomobject]@{State=$result.State;SafetyCandidates=$result.SafetyCandidates;ExternalCandidates=$result.ExternalCandidates;Unresolved=$result.Unresolved;UserApprovalRequired=$result.UserApprovalRequired;CanActivate=$result.CanActivate;PropertyQueries=$budget.Queries;ElapsedSeconds=[Math]::Round($clock.Elapsed.TotalSeconds,1)}
}
