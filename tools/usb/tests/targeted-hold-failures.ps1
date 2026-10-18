$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../targeted-hold-core.ps1')
foreach($case in @('Expired','PersistFailure','DisableFailure','WrongDisabledState','PostPersistDrift','PostPersistExpiry')){
 $script:calls=[Collections.Generic.List[string]]::new();$script:problem=0;$script:drift=$false
 $ticket=@{keyboard='keyboard';root='board';nonce='0123456789abcdef0123456789abcdef';restoreDeadline=$(if($case -eq 'Expired'){[datetime]::UtcNow.AddSeconds(-1)}else{[datetime]::UtcNow.AddMinutes(2)})}
 $provider=@{
  Read={param($id) @{id=$id;class='Keyboard';root=$(if($script:drift){'other'}else{'board'});problem=$script:problem}}
  Persist={param($r) $script:calls.Add('persist');if($case -eq 'PersistFailure'){throw 'disk failed'};if($case -eq 'PostPersistDrift'){$script:drift=$true};if($case -eq 'PostPersistExpiry'){$ticket.restoreDeadline=[datetime]::UtcNow.AddSeconds(-1)}}
  Disable={param($id) $script:calls.Add('disable');if($case -eq 'DisableFailure'){throw 'native disable failed'};if($case -ne 'WrongDisabledState'){$script:problem=22}}
  Enable={param($id) $script:calls.Add('enable');$script:problem=0}
 }
 try{Invoke-SentinelTargetHold $ticket $provider;throw 'Unexpected hold success'}catch{if($_.Exception.Message -eq 'Unexpected hold success'){throw}}
 if($case -eq 'Expired' -and $script:calls.Count){throw 'Expired ticket mutated state'}
 if($case -in @('PersistFailure','PostPersistDrift','PostPersistExpiry') -and $script:calls.Contains('disable')){throw 'Uncommitted or changed target disabled'}
 if($case -in @('DisableFailure','WrongDisabledState') -and -not $script:calls.Contains('enable')){throw 'Failed native operation did not attempt reversal'}
 Write-Output "Targeted hold $case PASS (fixture; no device mutation)"
}
