# Pure planning only. This file never installs or changes a device policy.
function New-SentinelDuckyPolicyPlan {
 param([string]$Root,[string]$Nonce,[ValidateSet('Probe','Live')][string]$Mode)
 if($Root -notmatch '^USB\\VID_[0-9A-Fa-f]{4}&PID_[0-9A-Fa-f]{4}\\[A-Za-z0-9&_.-]{1,160}\z'){throw 'Invalid exact physical device instance'}
 if($Nonce -notmatch '^[0-9a-f]{32}\z'){throw 'Invalid operation nonce'}
 $subkey=if($Mode -eq 'Probe'){'SOFTWARE\Sentinel\DuckyPolicyProbe\'+$Nonce}else{'SOFTWARE\Policies\Microsoft\Windows\DeviceInstall\Restrictions'}
 # The future installer must refuse an existing namespace. Rollback only accepts
 # the entire expected owned schema, including the nonce and exact target.
 $script=@'
$ErrorActionPreference='Stop'
throw 'unqualified_rollback: journaled partial-write recovery and SYSTEM probe required'
$base=[Microsoft.Win32.RegistryKey]::OpenBaseKey([Microsoft.Win32.RegistryHive]::LocalMachine,[Microsoft.Win32.RegistryView]::Registry64)
$path='__PATH__';$nonce='__NONCE__';$target='__ROOT__'
try {
 $key=$base.OpenSubKey($path,$true)
 if($null -eq $key){exit 0}
 try {
  $names=@($key.GetValueNames()|Sort-Object)
  if(($names -join '|') -ne 'DenyInstanceIDs|DenyInstanceIDsRetroactive|SentinelOperation'){throw 'Foreign policy values; rollback refused'}
  foreach($name in @('DenyInstanceIDs','DenyInstanceIDsRetroactive')){
   if($key.GetValueKind($name) -ne [Microsoft.Win32.RegistryValueKind]::DWord -or $key.GetValue($name) -ne 1){throw 'Policy drift; rollback refused'}
  }
  if($key.GetValueKind('SentinelOperation') -ne [Microsoft.Win32.RegistryValueKind]::String -or $key.GetValue('SentinelOperation') -cne $nonce){throw 'Ownership mismatch; rollback refused'}
  if((@($key.GetSubKeyNames()) -join '|') -ne 'DenyInstanceIDs'){throw 'Foreign policy subkeys; rollback refused'}
  $list=$key.OpenSubKey('DenyInstanceIDs',$true)
  try {
   if(@($list.GetSubKeyNames()).Count -ne 0 -or (@($list.GetValueNames()) -join '|') -ne '1'){throw 'Foreign device entries; rollback refused'}
   if($list.GetValueKind('1') -ne [Microsoft.Win32.RegistryValueKind]::String -or $list.GetValue('1') -cne $target){throw 'Target mismatch; rollback refused'}
   $list.DeleteValue('1',$true)
  }finally{if($list){$list.Dispose()}}
  foreach($name in @('DenyInstanceIDs','DenyInstanceIDsRetroactive','SentinelOperation')){$key.DeleteValue($name,$true)}
 }finally{$key.Dispose()}
 # Retain empty namespaces: deleting keys could erase concurrent foreign values.
}finally{$base.Dispose()}
'@
 $script=$script.Replace('__PATH__',$subkey).Replace('__NONCE__',$Nonce).Replace('__ROOT__',$Root)
 [pscustomobject]@{subkey=$subkey;root=$Root;nonce=$Nonce;mode=$Mode;rollback=[Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($script));activationAvailable=$false}
}
