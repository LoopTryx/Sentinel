$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$source=Join-Path $root 'tools/usb/DuckyLocalGpo.cs'
if(-not (Test-Path -LiteralPath $source)){throw 'RED: saved-policy adapter is missing'}
Add-Type -Path $source
$nonce=[guid]::NewGuid().ToString('N')
$path='SOFTWARE\Sentinel\DuckyGpoProbe\'+$nonce
$target='USB\VID_0001&PID_0001\TEST'
$fixture='Software\SentinelGpoTests\'+$nonce
$key=[Microsoft.Win32.Registry]::CurrentUser.CreateSubKey($fixture)
$saves=[Collections.Generic.List[string]]::new()
$save=[Action]{ $saves.Add('saved') }
$check=[Action]{}
try {
 $key.SetValue('Unrelated','preserve')
 [SentinelDuckyGpoEntry]::Edit($key,$path,$target,$nonce,$true,$save,$check,0)
 $list=$key.OpenSubKey($path+'\DenyInstanceIDs')
 if($list.GetValue('1') -cne $target -or $saves.Count -ne 1){throw 'Arm must save exact entry once'}
 $list.Dispose()
 [SentinelDuckyGpoEntry]::Edit($key,$path,$target,$nonce,$false,$save,$check,0)
 $list=$key.OpenSubKey($path+'\DenyInstanceIDs')
 if($null -ne $list.GetValue('1') -or $list.GetValueKind('**Del.1') -ne [Microsoft.Win32.RegistryValueKind]::String){throw 'Release must save exact deletion instruction'}
 $list.Dispose()
 [SentinelDuckyGpoEntry]::Edit($key,$path,$target,$nonce,$false,$save,$check,0)
 if($saves.Count -ne 3 -or $key.GetValue('Unrelated') -cne 'preserve'){throw 'Repeat release or unrelated policy changed'}
 # Target/nonce drift must never save or erase foreign data.
 $list=$key.OpenSubKey($path+'\DenyInstanceIDs',$true);$list.DeleteValue('**Del.1');$list.SetValue('1','USB\VID_0002&PID_0002\FOREIGN');$list.Dispose()
 $before=$saves.Count;$refused=$false
 try {[SentinelDuckyGpoEntry]::Edit($key,$path,$target,$nonce,$false,$save,$check,0)}catch{$refused=$_.Exception.ToString().Contains('Foreign saved target')}
 if(-not $refused -or $saves.Count -ne $before){throw 'Foreign target was not refused before save'}
 # No commit if external policy fingerprint changes.
 $other=[guid]::NewGuid().ToString('N');$refused=$false
 try {[SentinelDuckyGpoEntry]::Edit($key,('SOFTWARE\Sentinel\DuckyGpoProbe\'+$other),$target,$other,$true,$save,[Action]{throw 'external policy changed'},0)}catch{$refused=$_.Exception.ToString().Contains('external policy changed')}
 if(-not $refused -or $saves.Count -ne $before){throw 'Changed policy was saved'}
 # A throwing save must surface; a subsequent recovery must remove the entry.
 $other=[guid]::NewGuid().ToString('N');$otherPath='SOFTWARE\Sentinel\DuckyGpoProbe\'+$other;$refused=$false
 try {[SentinelDuckyGpoEntry]::Edit($key,$otherPath,$target,$other,$true,[Action]{throw 'uncertain save'},$check,0)}catch{$refused=$_.Exception.ToString().Contains('uncertain save')}
 if(-not $refused){throw 'Save error swallowed'}
 [SentinelDuckyGpoEntry]::Edit($key,$otherPath,$target,$other,$false,$save,$check,0)
 for($step=1;$step -le 5;$step++){
  $n=[guid]::NewGuid().ToString('N');$p='SOFTWARE\Sentinel\DuckyGpoProbe\'+$n;$before=$saves.Count;$refused=$false
  try {[SentinelDuckyGpoEntry]::Edit($key,$p,$target,$n,$true,$save,$check,$step)}catch{$refused=$_.Exception.ToString().Contains('Injected saved edit failure')}
  if(-not $refused){throw "Missing injected failure $step"}
  [SentinelDuckyGpoEntry]::Edit($key,$p,$target,$n,$false,$save,$check,0)
  $l=$key.OpenSubKey($p+'\DenyInstanceIDs');if($l -and $null -ne $l.GetValue('1')){throw 'Interrupted edit recovery retained target'};if($l){$l.Dispose()}
 }
 $refused=$false
 try {[SentinelDuckyGpoEntry]::Edit($key,'SOFTWARE\Policies\Microsoft\Windows\DeviceInstall\Restrictions',$target,$nonce,$true,$save,$check,0)}catch{$refused=$_.Exception.ToString().Contains('Saved device policy is not qualified')}
 if(-not $refused){throw 'Default adapter exposed live device policy'}
 Write-Output 'Saved-policy exact target, deletion, preservation, drift, save failure and interrupted edit regressions PASS; private HKCU only'
} finally {
 $key.Dispose()
 # Exactly this random test fixture, never a machine policy key.
 [Microsoft.Win32.Registry]::CurrentUser.DeleteSubKeyTree($fixture,$false)
}
