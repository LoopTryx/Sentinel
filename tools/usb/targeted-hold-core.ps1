# Internal orchestration. Provider callbacks perform native operations; never expose them as IPC.
function Assert-SentinelTarget($Ticket,$Provider,[int]$ExpectedProblem){
 if(-not $Ticket.keyboard -or -not $Ticket.root -or $Ticket.nonce -notmatch '^[0-9a-f]{32}$'){throw 'Invalid target receipt'}
 $current=& $Provider.Read $Ticket.keyboard
 if($current.id -cne $Ticket.keyboard -or $current.class -ne 'Keyboard' -or $current.root -cne $Ticket.root -or $current.problem -ne $ExpectedProblem){throw 'Target identity or state changed'}
}
function Invoke-SentinelTargetHold($Ticket,$Provider){
 Assert-SentinelTarget $Ticket $Provider 0
 $deadline=[datetime]$Ticket.restoreDeadline
 if($deadline -le [datetime]::UtcNow -or $deadline -gt [datetime]::UtcNow.AddMinutes(3)){throw 'Restore deadline invalid'}
 & $Provider.Persist $Ticket | Out-Null
 try{
  Assert-SentinelTarget $Ticket $Provider 0
  if([datetime]$Ticket.restoreDeadline -le [datetime]::UtcNow){throw 'Restore deadline elapsed before disable'}
  & $Provider.Disable $Ticket.keyboard | Out-Null
  Assert-SentinelTarget $Ticket $Provider 22
 }catch{
  try{& $Provider.Enable $Ticket.keyboard|Out-Null}catch{}
  throw
 }
 $result=@{};foreach($key in $Ticket.Keys){$result[$key]=$Ticket[$key]};$result.state='held';return $result
}
function Invoke-SentinelTargetRestore($Receipt,$Provider){
 $current=& $Provider.Read $Receipt.keyboard
 if($current.id -cne $Receipt.keyboard -or $current.class -ne 'Keyboard' -or $current.root -cne $Receipt.root -or $current.problem -notin @(0,22)){throw 'Restore target identity or state changed'}
 & $Provider.Enable $Receipt.keyboard | Out-Null
 Assert-SentinelTarget $Receipt $Provider 0
 & $Provider.Complete $Receipt | Out-Null
 $result=@{};foreach($key in $Receipt.Keys){$result[$key]=$Receipt[$key]};$result.state='restored';return $result
}


