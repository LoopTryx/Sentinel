param([Parameter(Mandatory)][ValidateSet('Prepare','Restore')][string]$Mode,[Parameter(Mandatory)][string]$ResultPath)
# Controlled lab entry point; must be reviewed and private SYSTEM recovery qualified first.
$ErrorActionPreference='Stop'
if(-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){throw 'Windows administrator approval required'}
$probe=Get-Content (Join-Path $PSScriptRoot '../../artifacts/ducky-policy-system-probe-numbered.json') -Raw|ConvertFrom-Json
if(-not $probe.success -or -not $probe.systemRecovery -or -not $probe.ownedEntryAbsent){throw 'Independent recovery not qualified'}
$source="#define SENTINEL_DUCKY_POLICY_LAB`n"+[IO.File]::ReadAllText((Join-Path $PSScriptRoot 'DuckyPolicyEntry.cs'))
$sha=[Security.Cryptography.SHA256]::Create();try{$sourceHash=([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($source)))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}
if($probe.sourceHash -cne $sourceHash){throw 'Recovery adapter changed since independent probe'}
$crashProbe=Get-Content (Join-Path $PSScriptRoot '../../artifacts/ducky-policy-system-probe-crash.json') -Raw|ConvertFrom-Json
if(-not $crashProbe.success -or -not $crashProbe.preparationProcessExited -or -not $crashProbe.systemRecovery -or -not $crashProbe.ownedEntryAbsent -or $crashProbe.sourceHash -cne $sourceHash){throw 'Interrupted preparation recovery not qualified'}
Add-Type -TypeDefinition $source
Add-Type -Path (Join-Path $PSScriptRoot 'DuckyPolicyJournal.cs')
$anchors=[Collections.Generic.List[IDisposable]]::new()
try {
 $ancestors=[Collections.Generic.List[string]]::new();$cursor=[IO.DirectoryInfo]::new($env:ProgramData)
 while($cursor){$ancestors.Insert(0,$cursor.FullName);$cursor=$cursor.Parent}
 foreach($ancestor in $ancestors){
  $anchors.Add([SentinelPolicyDirectory]::new($ancestor))
  $acl=Get-Acl -LiteralPath $ancestor
  if($acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -notin @('S-1-5-18','S-1-5-32-544','S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464')){throw 'Untrusted recovery ancestor owner'}
  foreach($rule in $acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])){
   if($rule.AccessControlType -eq 'Allow' -and $rule.IdentityReference.Value -notin @('S-1-5-18','S-1-5-32-544','S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464') -and -not ($rule.PropagationFlags -band [Security.AccessControl.PropagationFlags]::InheritOnly) -and ($rule.FileSystemRights -band ([Security.AccessControl.FileSystemRights]::DeleteSubdirectoriesAndFiles -bor [Security.AccessControl.FileSystemRights]::ChangePermissions -bor [Security.AccessControl.FileSystemRights]::TakeOwnership))){throw 'Recovery ancestor permits replacement'}
  }
 }
 $directory=Join-Path $env:ProgramData 'SentinelDuckyPolicy'
 [SentinelPolicyDirectory]::Provision($directory);$anchors.Add([SentinelPolicyDirectory]::new($directory))
 $acl=Get-Acl -LiteralPath $directory
 if(-not $acl.AreAccessRulesProtected -or $acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -notin @('S-1-5-18','S-1-5-32-544')){throw 'Unsafe journal owner or inheritance'}
 foreach($rule in $acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])){if($rule.AccessControlType -eq 'Allow' -and $rule.IdentityReference.Value -notin @('S-1-5-18','S-1-5-32-544')){throw 'Unsafe journal access'}}
 $lock=[IO.FileStream]::new((Join-Path $directory '.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None);$anchors.Add($lock)
 $receiptPath=Join-Path $directory 'trial.json'
 $path='SOFTWARE\Policies\Microsoft\Windows\DeviceInstall\Restrictions'
 if($Mode -eq 'Restore'){
  $r=Get-Content -LiteralPath $receiptPath -Raw|ConvertFrom-Json
  [SentinelDuckyEntry]::Restore($path,$r.target,$r.nonce,$true)
  @{success=$true;state='deny_entry_removed';inputRestoration='unverified';task=$r.task}|ConvertTo-Json|Set-Content -LiteralPath $ResultPath
  return
 }
 if(Test-Path -LiteralPath $receiptPath){throw 'Previous trial needs resolution'}
 if(Test-Path 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\DeviceInstall\Restrictions'){throw 'Existing device policy; nothing changed'}
 $t=Get-Content (Join-Path $PSScriptRoot '../../artifacts/ducky-target-private.json') -Raw|ConvertFrom-Json
 $nonce=[Guid]::NewGuid().ToString('N')
 if($t.root -notmatch '\AUSB\\VID_[0-9A-Fa-f]{4}&PID_[0-9A-Fa-f]{4}\\[A-Za-z0-9&_.-]{1,160}\z'){throw 'Invalid previously selected exact device'}
 if(Get-PnpDevice -InstanceId $t.root -PresentOnly -ErrorAction SilentlyContinue){throw 'Unplug selected Ducky before preparation'}
 $deadline=[datetime]::UtcNow.AddMinutes(5);$task='Sentinel-Ducky-Policy-Recovery-'+$nonce
 $params64=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes((@{target=$t.root;nonce=$nonce;path=$path}|ConvertTo-Json -Compress)))
 $source64=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($source))
 $payload='try{Add-Type -TypeDefinition ([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("'+$source64+'")));$p=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("'+$params64+'"))|ConvertFrom-Json;[SentinelDuckyEntry]::Restore($p.path,$p.target,$p.nonce,$true);exit 0}catch{exit 18}'
 $encoded=[Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($payload));if($encoded.Length -gt 28000){throw 'Recovery payload too large'}
 $action=New-ScheduledTaskAction -Execute (Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/powershell.exe') -Argument ('-NoProfile -NonInteractive -WindowStyle Hidden -EncodedCommand '+$encoded)
 $trigger=New-ScheduledTaskTrigger -Once -At $deadline.ToLocalTime() -RepetitionInterval (New-TimeSpan -Minutes 1)
 $principal=New-ScheduledTaskPrincipal -UserId SYSTEM -LogonType ServiceAccount -RunLevel Highest
 $settings=New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 1)
 Register-ScheduledTask -TaskName $task -Action $action -Trigger $trigger -Principal $principal -Settings $settings|Out-Null
 $receipt=@{target=$t.root;nonce=$nonce;deadline=$deadline.ToString('o');task=$task;priorState='namespace_absent';sourceHash=$sourceHash}|ConvertTo-Json -Compress
 $bytes=[Text.Encoding]::UTF8.GetBytes($receipt)
 $journal=[IO.FileStream]::new($receiptPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
 try{$journal.Write($bytes,0,$bytes.Length);$journal.Flush($true)}finally{$journal.Dispose()}
 if([datetime]::UtcNow -ge $deadline){throw 'Recovery deadline passed; no apply'}
 try{[SentinelDuckyEntry]::Apply($path,$t.root,$nonce,$true,0)}catch{try{[SentinelDuckyEntry]::Restore($path,$t.root,$nonce,$true)}catch{};throw}
 @{success=$true;state='exact_policy_prepared';device='RP2040-Zero';deadline=$deadline.ToString('o');blocking='awaiting_live_evidence'}|ConvertTo-Json|Set-Content -LiteralPath $ResultPath
}finally{for($i=$anchors.Count-1;$i -ge 0;$i--){$anchors[$i].Dispose()}}
