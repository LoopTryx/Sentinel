param([switch]$Native)
$ErrorActionPreference='Stop'
Add-Type -Path (Join-Path $PSScriptRoot '../DuckyPolicyEntry.cs')
if(-not $Native){
 try{[SentinelDuckyEntry]::Apply('SOFTWARE\Policies\Microsoft\Windows\DeviceInstall\Restrictions','USB\VID_0001&PID_0001\TEST',[Guid]::NewGuid().ToString('N'),$false,0);throw 'Live path accepted'}catch{if($_.Exception.Message -eq 'Live path accepted'){throw}}
 Write-Output 'Entry adapter live activation refusal PASS';return
}
$base=[Microsoft.Win32.RegistryKey]::OpenBaseKey([Microsoft.Win32.RegistryHive]::CurrentUser,[Microsoft.Win32.RegistryView]::Registry64)
foreach($step in 1..5){
 $n=[Guid]::NewGuid().ToString('N');$p='SOFTWARE\Sentinel\DuckyPolicyProbe\'+$n;$t='USB\VID_0001&PID_0001\TEST'
 try{[SentinelDuckyEntry]::Apply($p,$t,$n,$false,$step);throw 'Expected failure missing'}catch{$e=$_.Exception;while($e.InnerException){$e=$e.InnerException};if($e.Message -ne 'Injected entry stage '+$step){throw}}
 [SentinelDuckyEntry]::Restore($p,$t,$n,$false)
 $k=$base.OpenSubKey($p+'\DenyInstanceIDs');if($k){if($k.GetValue('1',$null) -ne $null){throw 'Owned deny entry remains'};$k.Dispose()}
 [SentinelDuckyEntry]::Restore($p,$t,$n,$false)
}
$n=[Guid]::NewGuid().ToString('N');$p='SOFTWARE\Sentinel\DuckyPolicyProbe\'+$n
[SentinelDuckyEntry]::Apply($p,$t,$n,$false,0)
$k=$base.OpenSubKey($p+'\DenyInstanceIDs',$true);$k.SetValue('Foreign','USB\VID_0002&PID_0002\OTHER');$k.Dispose()
[SentinelDuckyEntry]::Restore($p,$t,$n,$false)
$k=$base.OpenSubKey($p+'\DenyInstanceIDs');if($k.GetValue('Foreign') -ne 'USB\VID_0002&PID_0002\OTHER'){throw 'Foreign entry removed'};$k.Dispose()
foreach($drift in @('owner','target')){
 $n=[Guid]::NewGuid().ToString('N');$p='SOFTWARE\Sentinel\DuckyPolicyProbe\'+$n
 [SentinelDuckyEntry]::Apply($p,$t,$n,$false,0)
 if($drift -eq 'owner'){$k=$base.OpenSubKey($p,$true);$k.SetValue('SentinelOperation','foreign');$k.Dispose()}
 else{$k=$base.OpenSubKey($p+'\DenyInstanceIDs',$true);$k.SetValue('1','USB\VID_0002&PID_0002\OTHER');$k.Dispose()}
 try{[SentinelDuckyEntry]::Restore($p,$t,$n,$false);throw 'Drift accepted'}catch{$e=$_.Exception;while($e.InnerException){$e=$e.InnerException};if($e.Message -notlike '*drift; recovery uncertain'){throw}}
 $k=$base.OpenSubKey($p+'\DenyInstanceIDs');if($null -eq $k.GetValue('1',$null)){throw 'Changed entry deleted'};$k.Dispose()
}
$base.Dispose()
 $n=[Guid]::NewGuid().ToString('N');$p='SOFTWARE\Sentinel\DuckyPolicyProbe\'+$n
 [SentinelDuckyEntry]::Apply($p,$t,$n,$false,0);[SentinelDuckyEntry]::Restore($p,$t,$n,$false)
 try{[SentinelDuckyEntry]::Arm($p,$t,$n,$false,[DateTime]::UtcNow.AddSeconds(-1));throw 'Expired arm accepted'}catch{$e=$_.Exception;while($e.InnerException){$e=$e.InnerException};if($e.Message -ne 'Invalid arm deadline'){throw}}
 [SentinelDuckyEntry]::Arm($p,$t,$n,$false,[DateTime]::UtcNow.AddMinutes(5))
 [SentinelDuckyEntry]::Restore($p,$t,$n,$false)
Write-Output 'Private HKCU entry recovery PASS: five interrupted prefixes, repeat recovery, foreign preservation and ownership/target drift refusal'
