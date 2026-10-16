$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '..\ScanJob.ps1')
function Assert($Value, $Message) { if (-not $Value) { throw $Message } }
$exe = (Get-Command powershell.exe).Source
function Launch([string]$Code) {
    $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($Code))
    Start-SentinelProcessJob -Executable $exe -Arguments @('-NoProfile', '-EncodedCommand', $encoded) -TimeoutSeconds 5
}
function Finish($Job) {
    $deadline = [DateTime]::UtcNow.AddSeconds(7)
    do {
        $state = Get-SentinelProcessJob $Job
        if ($state -ne 'Running') { return $state }
        Start-Sleep -Milliseconds 10
    } while ([DateTime]::UtcNow -lt $deadline)
    throw 'Output job exceeded test deadline'
}
$jobs = @()
try {
    foreach ($code in @(
        '[Console]::Out.Write("x" * 1048577)',
        '[Console]::Error.Write("e" * 65537)',
        'while ($true) { [Console]::Out.Write("x" * 8192) }'
    )) {
        $job = Launch $code
        $jobs += $job
        Assert ((Finish $job) -eq 'Failed') 'Excess output must fail, never complete or time out'
        Assert ($job.Output -eq '') 'Failed output was published'
        Assert ($job.Process.HasExited) 'Output breach did not terminate the child'
    }
    $job = Launch 'Start-Sleep -Seconds 20'
    $jobs += $job
    $clock = [Diagnostics.Stopwatch]::StartNew()
    Close-SentinelProcessJob $job
    Assert ($clock.Elapsed.TotalSeconds -lt 3) 'Close exceeded its bounded wait'
    Assert ($job.State -eq 'Cancelled') 'Closed live job was not cancelled'
    Assert ($job.Closed) 'Close did not record disposal'
    Close-SentinelProcessJob $job

    # A controlled failure probes exception safety; the kill/reap paths above
    # use real processes. Failure is recorded rather than claimed as cleanup.
    $fake = New-Object PSObject -Property @{HasExited=$false;Disposed=$false}
    $fake | Add-Member ScriptMethod Kill { throw 'controlled kill failure' }
    $fake | Add-Member ScriptMethod WaitForExit { param($Milliseconds) $false }
    $fake | Add-Member ScriptMethod Dispose { $this.Disposed = $true }
    $failedClose = @{Process=$fake;State='Running';StopReason=$null;Clock=[Diagnostics.Stopwatch]::StartNew()}
    Close-SentinelProcessJob $failedClose
    Assert ($failedClose.CleanupFailed) 'Kill failure was not recorded'
    Assert $fake.Disposed 'Dispose was skipped after kill failure'
    Assert ($failedClose.State -eq 'Failed') 'Failed cleanup was misreported as cancellation'

    $pending = New-Object 'Threading.Tasks.TaskCompletionSource[string]'
    $drainProcess = New-Object PSObject -Property @{HasExited=$true;Disposed=$false}
    $drainProcess | Add-Member ScriptMethod WaitForExit { param($Milliseconds) $true }
    $drainProcess | Add-Member ScriptMethod Dispose { $this.Disposed = $true }
    $drainJob = @{Process=$drainProcess;State='Running';StopReason=$null;Stdout=$pending.Task;Clock=[Diagnostics.Stopwatch]::StartNew()}
    $clock.Restart()
    Close-SentinelProcessJob $drainJob
    Assert ($clock.Elapsed.TotalSeconds -lt 3) 'Incomplete drain exceeded bounded close'
    Assert ($drainJob.DrainIncomplete -and $drainJob.State -eq 'Failed') 'Incomplete drain was misreported as successful cleanup'
    $pending.SetResult('')
    Write-Host 'Desktop bounded output and close tests passed.'
} finally {
    foreach ($job in $jobs) { Close-SentinelProcessJob $job }
}
