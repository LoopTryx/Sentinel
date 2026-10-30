param([switch]$Native)
$ErrorActionPreference='Stop'
$source=Join-Path $PSScriptRoot '../DuckyPolicyTransaction.cs'
Add-Type -Path $source
$nonce=[Guid]::NewGuid().ToString('N');$target='USB\VID_0001&PID_0001\TEST'
$path='SOFTWARE\Sentinel\DuckyPolicyProbe\'+$nonce
if(-not $Native){
 foreach($bad in @('USB\*','HID\VID_0001&PID_0001\TEST','USB\VID_0001&PID_0001&MI_01\TEST')){
  try{[SentinelDuckyPolicy]::Validate($path,$bad,$nonce);throw 'Invalid target accepted'}catch{if($_.Exception.Message -eq 'Invalid target accepted'){throw}}
 }
 Write-Output 'Transactional policy validation PASS; no registry changes';return
}
$base=[Microsoft.Win32.RegistryKey]::OpenBaseKey([Microsoft.Win32.RegistryHive]::CurrentUser,[Microsoft.Win32.RegistryView]::Registry64)
try {
 $parent=$base.CreateSubKey('SOFTWARE\Sentinel\DuckyPolicyProbe');$parent.Dispose()
 foreach($step in 1..4){
  try{[SentinelDuckyPolicy]::Apply($path,$target,$nonce,$false,$step);throw 'Injected failure missing'}catch{
   $failure=$_.Exception;while($failure.InnerException){$failure=$failure.InnerException}
   if($failure.Message -ne 'Injected transaction abort'){throw}
  }
  $key=$base.OpenSubKey($path);if($key){$key.Dispose();throw 'Partial policy escaped aborted transaction'}
 }
 [SentinelDuckyPolicy]::Apply($path,$target,$nonce,$false,0)
 try{[SentinelDuckyPolicy]::Apply($path,$target,$nonce,$false,0);throw 'Existing policy overwritten'}catch{if($_.Exception.Message -eq 'Existing policy overwritten'){throw}}
 $key=$base.OpenSubKey($path,$true);$key.SetValue('Foreign',7);$key.Dispose()
 try{[SentinelDuckyPolicy]::Restore($path,$target,$nonce,$false);throw 'Foreign policy accepted'}catch{if($_.Exception.Message -eq 'Foreign policy accepted'){throw}}
 $key=$base.OpenSubKey($path,$true);if($key.GetValue('DenyInstanceIDs') -ne 1){throw 'Failed restore changed policy'};$key.DeleteValue('Foreign');$key.Dispose()
 [SentinelDuckyPolicy]::Restore($path,$target,$nonce,$false)
 $key=$base.OpenSubKey($path);if($key){$key.Dispose();throw 'Restored probe remains'}
 [SentinelDuckyPolicy]::Restore($path,$target,$nonce,$false)
 Write-Output 'Native HKCU transactions PASS: four abort stages, existing-policy refusal, foreign-state preservation, atomic restore, idempotence'
}finally{$base.Dispose()}
