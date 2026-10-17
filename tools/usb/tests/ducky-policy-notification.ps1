$ErrorActionPreference='Stop'
Add-Type -Path (Join-Path $PSScriptRoot '../DuckyPolicyEntry.cs')
Add-Type @'
using System;using System.Threading;using System.Runtime.InteropServices;using Microsoft.Win32;
public static class DuckyNotificationProbe{
 [DllImport("advapi32.dll")]static extern int RegNotifyChangeKeyValue(IntPtr key,bool subtree,uint filter,IntPtr signal,bool asynchronous);
 public static bool ParentChanged(RegistryKey key,Action mutation){using(var signal=new EventWaitHandle(false,EventResetMode.AutoReset)){
  int code=RegNotifyChangeKeyValue(key.Handle.DangerousGetHandle(),false,4,signal.SafeWaitHandle.DangerousGetHandle(),true);if(code!=0)throw new InvalidOperationException("Notification registration failed");
  mutation();return signal.WaitOne(500);
 }}
}
'@
$nonce=[Guid]::NewGuid().ToString('N')
$path='SOFTWARE\Sentinel\DuckyPolicyProbe\'+$nonce
$target='USB\VID_0001&PID_0001\TEST'
[SentinelDuckyEntry]::Apply($path,$target,$nonce,$false,0)
[SentinelDuckyEntry]::Restore($path,$target,$nonce,$false)
$base=[Microsoft.Win32.RegistryKey]::OpenBaseKey([Microsoft.Win32.RegistryHive]::CurrentUser,[Microsoft.Win32.RegistryView]::Registry64)
$key=$base.OpenSubKey($path,$true)
try{
 $observed=[DuckyNotificationProbe]::ParentChanged($key,[Action]{[SentinelDuckyEntry]::Arm($path,$target,$nonce,$false,[DateTime]::UtcNow.AddMinutes(5))})
 $released=[DuckyNotificationProbe]::ParentChanged($key,[Action]{[SentinelDuckyEntry]::Restore($path,$target,$nonce,$false)})
 $positive=[DuckyNotificationProbe]::ParentChanged($key,[Action]{$key.SetValue('DenyInstanceIDs',0,[Microsoft.Win32.RegistryValueKind]::DWord);$key.Flush();$key.SetValue('DenyInstanceIDs',1,[Microsoft.Win32.RegistryValueKind]::DWord);$key.Flush()})
 if(!$positive){throw 'Notification positive control failed'}
 if(!$observed -or !$released){throw 'Repeated arm/release did not notify the policy parent'}
 Write-Output 'Private repeated-arm/release parent notifications PASS; enforcement not established'
}finally{[SentinelDuckyEntry]::Restore($path,$target,$nonce,$false);$key.Dispose();$base.Dispose()}
foreach($cut in 1..3){
 $nonce=[Guid]::NewGuid().ToString('N');$path='SOFTWARE\Sentinel\DuckyPolicyProbe\'+$nonce;$target='USB\VID_0001&PID_0001\TEST'
 [SentinelDuckyEntry]::Apply($path,$target,$nonce,$false,0);[SentinelDuckyEntry]::Restore($path,$target,$nonce,$false)
 try{[SentinelDuckyEntry]::Arm($path,$target,$nonce,$false,[DateTime]::UtcNow.AddMinutes(5),$cut);throw 'Missing injected interruption'}catch{$errorValue=$_.Exception;while($errorValue.InnerException){$errorValue=$errorValue.InnerException};if($errorValue.Message -ne ('Injected entry stage '+$cut)){throw}}
 [SentinelDuckyEntry]::Restore($path,$target,$nonce,$false)
 $hive=[Microsoft.Win32.RegistryKey]::OpenBaseKey([Microsoft.Win32.RegistryHive]::CurrentUser,[Microsoft.Win32.RegistryView]::Registry64);$parentKey=$hive.OpenSubKey($path);$listKey=$parentKey.OpenSubKey('DenyInstanceIDs')
 try{if($listKey.GetValue('1',$null) -ne $null -or $parentKey.GetValue('DenyInstanceIDs') -ne 1){throw 'Interrupted reassertion did not recover original flag/empty list'}}finally{$listKey.Dispose();$parentKey.Dispose();$hive.Dispose()}
 [SentinelDuckyEntry]::Restore($path,$target,$nonce,$false)
}
Write-Output 'Private reassertion interruption recovery PASS: before flag change, flag zero and flag restored; no live device changes'
