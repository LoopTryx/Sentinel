param([ValidateSet('Healthy','Mismatch','PreDisabled','RestoreFailure')][string]$Scenario='Healthy')
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../targeted-hold-core.ps1')
$script:calls=[Collections.Generic.List[string]]::new()
$script:problem=if($Scenario -eq 'PreDisabled'){22}else{0}
$provider=@{
 Read={param($id) @{id=$id;class='Keyboard';root=$(if($Scenario -eq 'Mismatch'){'other'}else{'board'});problem=$script:problem}}
 Persist={param($record) $script:calls.Add('persist')}
 Disable={param($id) $script:calls.Add('disable');$script:problem=22}
 Enable={param($id) $script:calls.Add('enable');if($Scenario -ne 'RestoreFailure'){$script:problem=0}}
 Complete={param($record) $script:calls.Add('complete')}
}
$ticket=@{keyboard='keyboard';root='board';nonce='0123456789abcdef0123456789abcdef';restoreDeadline=[datetime]::UtcNow.AddMinutes(2)}
if($Scenario -in @('Mismatch','PreDisabled')){
 try{Invoke-SentinelTargetHold $ticket $provider;throw 'Unsafe target accepted'}catch{if($_.Exception.Message -eq 'Unsafe target accepted'){throw}}
 if($script:calls.Count){throw 'Rejected target was mutated'}
}else{
 $receipt=Invoke-SentinelTargetHold $ticket $provider
 if(($script:calls -join ',') -ne 'persist,disable'){throw 'Durable receipt must precede disable'}
 if($receipt.state -ne 'held'){throw 'Held state unverified'}
 if($Scenario -eq 'RestoreFailure'){
  try{Invoke-SentinelTargetRestore $receipt $provider;throw 'False restore success'}catch{if($_.Exception.Message -eq 'False restore success'){throw}}
  if($script:calls.Contains('complete')){throw 'Failed restore retired receipt'}
 }else{
  $result=Invoke-SentinelTargetRestore $receipt $provider
  if($result.state -ne 'restored' -or ($script:calls -join ',') -ne 'persist,disable,enable,complete'){throw 'Restore sequence wrong'}
 }
}
Write-Output "Targeted hold $Scenario PASS (fixture; no device mutation)"
