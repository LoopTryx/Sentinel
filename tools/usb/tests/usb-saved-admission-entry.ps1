$ErrorActionPreference='Stop'
if(!(Test-Path "$PSScriptRoot/../UsbSavedAdmissionEntry.cs")){throw 'RED: generic saved-policy entry adapter missing'}
Add-Type -Path "$PSScriptRoot/../UsbSavedAdmissionEntry.cs"
$nonce=[guid]::NewGuid().ToString('N');$path='SOFTWARE\Sentinel\UsbAdmissionProbe\'+$nonce
$fixture='Software\SentinelAdmissionTests\'+$nonce
$key=[Microsoft.Win32.Registry]::CurrentUser.CreateSubKey($fixture)
$values=@(
 [UsbSavedAdmissionEntry+Value]::new('AllowInstanceIDs','1',1,[Text.Encoding]::Unicode.GetBytes("HID\SYNTHETIC\KEYBOARD`0")),
 [UsbSavedAdmissionEntry+Value]::new('DenyDeviceClasses','1',1,[Text.Encoding]::Unicode.GetBytes("{4d36e96b-e325-11ce-bfc1-08002be10318}`0")),
 [UsbSavedAdmissionEntry+Value]::new('DenyDeviceClasses','2',1,[Text.Encoding]::Unicode.GetBytes("{4d36e96f-e325-11ce-bfc1-08002be10318}`0")),
 [UsbSavedAdmissionEntry+Value]::new('','AllowDenyLayered',4,[BitConverter]::GetBytes([int]1)),
 [UsbSavedAdmissionEntry+Value]::new('','AllowInstanceIDs',4,[BitConverter]::GetBytes([int]1)),
 [UsbSavedAdmissionEntry+Value]::new('','DenyDeviceClassesRetroactive',4,[BitConverter]::GetBytes([int]1)),
 [UsbSavedAdmissionEntry+Value]::new('','DenyDeviceClasses',4,[BitConverter]::GetBytes([int]1)))
$count=[Collections.Generic.List[int]]::new();$save=[Action]{$count.Add(1)};$check=[Action]{}
try {
 [UsbSavedAdmissionEntry]::Edit($key,$path,$nonce,$values,$true,$save,$check,0)
 if($count.Count -ne 1){throw 'Apply did not save'}
 [UsbSavedAdmissionEntry]::Edit($key,$path,$nonce,$values,$false,$save,$check,0)
 $node=$key.OpenSubKey($path);try{if($node.GetValue('DenyDeviceClasses',$null) -ne $null -or $node.GetValue('**Del.DenyDeviceClasses',$null) -cne ''){throw 'Release did not persist exact deletion'}}finally{$node.Dispose()}
 for($step=1;$step -le $values.Count;$step++){
  $n=[guid]::NewGuid().ToString('N');$p='SOFTWARE\Sentinel\UsbAdmissionProbe\'+$n;$failed=$false
  try{[UsbSavedAdmissionEntry]::Edit($key,$p,$n,$values,$true,$save,$check,$step)}catch{$failed=$true}
  if(!$failed){throw 'Injected failure absent'}
  [UsbSavedAdmissionEntry]::Edit($key,$p,$n,$values,$false,$save,$check,0)
 }
 foreach($badId in @('HID\\EMPTY','HID\EMPTY\')){
  $bad=@($values);$bad[0]=[UsbSavedAdmissionEntry+Value]::new('AllowInstanceIDs','1',1,[Text.Encoding]::Unicode.GetBytes($badId+"`0"));$rejected=$false
  try{[UsbSavedAdmissionEntry]::Edit($key,('SOFTWARE\Sentinel\UsbAdmissionProbe\'+$nonce),$nonce,$bad,$true,$save,$check,0)}catch{$rejected=$_.Exception.ToString().Contains('Invalid exact instance')}
  if(!$rejected){throw 'RED: empty ID component accepted'}
 }
 $duplicate=@($values)+[UsbSavedAdmissionEntry+Value]::new('AllowInstanceIDs','2',1,$values[0].Data);$rejected=$false
 try{[UsbSavedAdmissionEntry]::Edit($key,$path,$nonce,$duplicate,$true,$save,$check,0)}catch{$rejected=$_.Exception.ToString().Contains('Duplicate instance')}
 if(!$rejected){throw 'RED: duplicate allow ID accepted'}
 $node=$key.OpenSubKey($path,$true);$node.SetValue('Foreign',99);$node.Dispose();$failed=$false;$before=$count.Count
 try{[UsbSavedAdmissionEntry]::Edit($key,$path,$nonce,$values,$false,$save,$check,0)}catch{$failed=$true}
 if(!$failed -or $before -ne $count.Count){throw 'Foreign edit not refused'}
 Write-Output 'PASS generic saved entry apply/release, exact deletion, interrupted edits and foreign-drift refusal; private HKCU only'
}finally{$key.Dispose();[Microsoft.Win32.Registry]::CurrentUser.DeleteSubKeyTree($fixture,$false)}
