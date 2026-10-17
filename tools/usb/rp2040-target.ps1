function Resolve-Rp2040Keyboard {
 param([string]$Root,[object[]]$Candidates,[scriptblock]$ReadParent)
 if($Root -notmatch '\AUSB\\VID_[0-9A-Fa-f]{4}&PID_[0-9A-Fa-f]{4}\\[A-Za-z0-9&_.-]{1,160}\z'){throw 'Invalid physical enrollment'}
 $matches=@(foreach($candidate in $Candidates){
  if($candidate.Class -ne 'Keyboard' -or $candidate.InstanceId -notmatch '\AHID\\[A-Za-z0-9_&\\{}#.-]+\z'){continue}
  $cursor=$candidate.InstanceId
  $seen=@{}
  for($i=0;$i -lt 8;$i++){
   if($seen.ContainsKey($cursor)){break};$seen[$cursor]=$true
   $cursor=& $ReadParent $cursor
   if([string]::IsNullOrEmpty($cursor)){break}
   if($cursor -ieq $Root){$candidate.InstanceId;break}
  }
 })
 if($matches.Count -ne 1){throw 'Expected exactly one enrolled Ducky keyboard interface. No device changed.'}
 return $matches[0]
}
