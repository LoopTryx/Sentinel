param([ValidateSet('Probe')][string]$Mode='Probe',[Parameter(Mandatory)][string]$ResultPath,[switch]$CrashPreparation)
$ErrorActionPreference='Stop'
if(-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){throw 'Windows administrator approval required'}
$source="#define SENTINEL_DUCKY_POLICY_LAB`n"+[IO.File]::ReadAllText((Join-Path $PSScriptRoot 'DuckyPolicyEntry.cs'))
$sha=[Security.Cryptography.SHA256]::Create();try{$sourceHash=([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($source)))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}
Add-Type -TypeDefinition $source
$nonce=[Guid]::NewGuid().ToString('N');$path='SOFTWARE\Sentinel\DuckyPolicyProbe\'+$nonce;$target='USB\VID_0001&PID_0001\TEST'
$task='Sentinel-Ducky-Policy-Probe-'+$nonce
$source64=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($source))
$params64=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes((@{path=$path;target=$target;nonce=$nonce}|ConvertTo-Json -Compress)))
$payload='try{Add-Type -TypeDefinition ([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("'+$source64+'")));$p=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("'+$params64+'"))|ConvertFrom-Json;[SentinelDuckyEntry]::Restore($p.path,$p.target,$p.nonce,$true);exit 0}catch{exit 18}'
$encoded=[Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($payload))
if($encoded.Length -gt 28000){throw 'Immutable recovery payload exceeds limit'}
$hostPath=Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/powershell.exe'
$action=New-ScheduledTaskAction -Execute $hostPath -Argument ('-NoProfile -NonInteractive -WindowStyle Hidden -EncodedCommand '+$encoded)
$trigger=New-ScheduledTaskTrigger -Once -At ([datetime]::Now.AddSeconds(15)) -RepetitionInterval (New-TimeSpan -Minutes 1)
$principal=New-ScheduledTaskPrincipal -UserId SYSTEM -LogonType ServiceAccount -RunLevel Highest
$settings=New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 1)
$stage='register';$verified=$false
try {
 Register-ScheduledTask -TaskName $task -Action $action -Trigger $trigger -Principal $principal -Settings $settings|Out-Null
 $stage='private-apply'
 if($CrashPreparation){
  $childPayload='try{Add-Type -TypeDefinition ([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("'+$source64+'")));$p=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("'+$params64+'"))|ConvertFrom-Json;[SentinelDuckyEntry]::Apply($p.path,$p.target,$p.nonce,$true,3);exit 74}catch{$e=$_.Exception;while($e.InnerException){$e=$e.InnerException};if($e.Message -eq "Injected entry stage 3"){exit 73}else{exit 74}}'
  $childEncoded=[Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($childPayload))
  $child=Start-Process $hostPath -ArgumentList @('-NoProfile','-NonInteractive','-EncodedCommand',$childEncoded) -PassThru -WindowStyle Hidden
  if(-not $child.WaitForExit(15000) -or $child.ExitCode -ne 73){throw 'Interrupted preparation qualification failed'}
 }else{[SentinelDuckyEntry]::Apply($path,$target,$nonce,$true,0)}
 $stage='system-recovery';Start-ScheduledTask -TaskName $task
 $watch=[Diagnostics.Stopwatch]::StartNew()
 while($watch.Elapsed.TotalSeconds -lt 35){
  $info=Get-ScheduledTaskInfo -TaskName $task
  if($info.LastRunTime -gt [datetime]::Now.AddMinutes(-1) -and $info.LastTaskResult -eq 0){$verified=$true;break}
  Start-Sleep -Milliseconds 250
 }
 if(-not $verified){throw 'Independent SYSTEM recovery failed'}
 $stage='recovery-readback'
 $hive=[Microsoft.Win32.RegistryKey]::OpenBaseKey([Microsoft.Win32.RegistryHive]::LocalMachine,[Microsoft.Win32.RegistryView]::Registry64)
 try{$list=$hive.OpenSubKey($path+'\DenyInstanceIDs');try{if($list -and $list.GetValue('1',$null) -ne $null){throw 'SYSTEM recovery left owned entry'}}finally{if($list){$list.Dispose()}}}finally{$hive.Dispose()}
 Unregister-ScheduledTask -TaskName $task -Confirm:$false
 @{success=$true;mode='private_probe';systemRecovery=$true;ownedEntryAbsent=$true;devicePolicyChanged=$false;sourceHash=$sourceHash;preparationProcessExited=[bool]$CrashPreparation}|ConvertTo-Json|Set-Content -LiteralPath $ResultPath
}catch{
 # Leave repeating recovery armed if the independent path has not passed.
 try{[SentinelDuckyEntry]::Restore($path,$target,$nonce,$true)}catch{}
 @{success=$false;stage=$stage;devicePolicyChanged=$false;recoveryTask=$task}|ConvertTo-Json|Set-Content -LiteralPath $ResultPath
 throw
}
