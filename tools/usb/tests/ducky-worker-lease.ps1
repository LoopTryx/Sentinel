$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$source=Join-Path $root 'tools/usb/DuckyWorkerLease.cs'
if(-not (Test-Path -LiteralPath $source)){throw 'RED: deadline-bound worker lease is missing'}
Add-Type -Path $source
$now=[datetime]::SpecifyKind([datetime]'2026-10-15T08:30:00',[DateTimeKind]::Utc)
$deadline=$now.AddMinutes(5)
$lease=[DuckyWorkerLease]::Create($now,$deadline,$null)
$restored=[DuckyWorkerLease]::Rehydrate($lease.Seconds,$lease.LatestStartUtc,$lease.RecoveryDeadlineUtc)
if($restored.CanStart($lease.LatestStartUtc.AddTicks(1))){throw 'Persisted worker accepted delayed dispatch'}
if($lease.LatestStartUtc.AddSeconds($lease.Seconds) -gt $deadline.AddSeconds(-15)){throw 'Worker can overlap recovery'}
if(-not $lease.CanStart($now) -or $lease.CanStart($lease.LatestStartUtc.AddTicks(1))){throw 'Delayed dispatch guard failed'}
# Release arriving shortly before an existing hold expires must use THAT earlier deadline.
$earlier=$now.AddSeconds(30)
$release=[DuckyWorkerLease]::Create($now,$deadline,$earlier)
if($release.LatestStartUtc.AddSeconds($release.Seconds) -gt $earlier.AddSeconds(-15)){throw 'Release ignored outstanding recovery'}
$refused=$false
try{[void][DuckyWorkerLease]::Create($now,$deadline,$now.AddSeconds(24))}catch{$refused=$_.Exception.ToString().Contains('Insufficient recovery time')}
if(-not $refused){throw 'Insufficient time must refuse before dispatch'}
$refused=$false
try{[void][DuckyWorkerLease]::Create([datetime]::SpecifyKind($now,[DateTimeKind]::Unspecified),$deadline,$null)}catch{$refused=$_.Exception.ToString().Contains('UTC timestamps required')}
if(-not $refused){throw 'Ambiguous clock accepted'}
# Re-evaluate each dispatch; reuse of an old duration after queueing is forbidden.
for($offset=0;$offset -lt 275;$offset+=7){
 $at=$now.AddSeconds($offset)
 try{$x=[DuckyWorkerLease]::Create($at,$deadline,$null)}catch{if($_.Exception.ToString().Contains('Insufficient recovery time')){continue};throw}
 if($x.Seconds -lt 5 -or $x.Seconds -gt 180 -or $x.LatestStartUtc.AddSeconds($x.Seconds) -gt $deadline.AddSeconds(-15)){throw 'Deadline sweep failed'}
}
Write-Output 'Worker deadline, late dispatch, earlier release deadline and UTC regressions PASS; no tasks/devices changed'
