# Local preview process jobs. These are not durable or authenticated agent jobs.
function ConvertTo-SentinelArgument([string]$Value) {
    # CommandLineToArgvW quoting: double backslashes before quotes and the closing quote.
    '"' + [regex]::Replace([regex]::Replace($Value, '(\\*)"', '$1$1\"'), '(\\+)$', '$1$1') + '"'
}
function Start-SentinelProcessJob {
    param([string]$Executable, [string[]]$Arguments, [int]$TimeoutSeconds = 120)
    if ($TimeoutSeconds -lt 1) { throw 'Timeout must be positive' }
    $info = New-Object System.Diagnostics.ProcessStartInfo
    $info.FileName = $Executable
    $info.Arguments = ($Arguments | ForEach-Object { ConvertTo-SentinelArgument $_ }) -join ' '
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    $info.StandardOutputEncoding = [Text.Encoding]::UTF8
    $info.StandardErrorEncoding = [Text.Encoding]::UTF8
    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $info
    $started = $false
    try {
        if (-not $process.Start()) { throw 'Scanner process could not start' }
        $started = $true
        # Drain both pipes concurrently; polling never waits for a live child.
        $stdout = $process.StandardOutput.ReadToEndAsync()
        $stderr = $process.StandardError.ReadToEndAsync()
        @{
            Process = $process; Stdout = $stdout; Stderr = $stderr
            Clock = [Diagnostics.Stopwatch]::StartNew(); TimeoutSeconds = $TimeoutSeconds
            State = 'Running'; StopReason = $null; Output = ''; ExitCode = $null
        }
    } catch {
        if ($started -and -not $process.HasExited) { $process.Kill() }
        $process.Dispose()
        throw
    }
}
function Stop-SentinelProcessJob {
    param($Job, [ValidateSet('Cancelled', 'TimedOut')][string]$Reason = 'Cancelled')
    if ($Job.State -ne 'Running' -or $Job.StopReason) { return }
    # A completion observed before cancellation keeps its result.
    if ($Job.Process.HasExited) { return }
    $Job.StopReason = $Reason
    try { $Job.Process.Kill() } catch {
        if (-not $Job.Process.HasExited) { throw }
    }
}
function Get-SentinelProcessJob($Job) {
    if ($Job.State -ne 'Running') { return $Job.State }
    if ($Job.Clock.Elapsed.TotalSeconds -ge $Job.TimeoutSeconds) {
        Stop-SentinelProcessJob $Job 'TimedOut'
    }
    if (-not $Job.Process.HasExited -or -not $Job.Stdout.IsCompleted -or -not $Job.Stderr.IsCompleted) {
        return 'Running'
    }
    $Job.ExitCode = $Job.Process.ExitCode
    $Job.Clock.Stop()
    if ($Job.StopReason) {
        $Job.State = $Job.StopReason
    } elseif ($Job.Stdout.IsFaulted -or $Job.Stderr.IsFaulted -or $Job.ExitCode -ne 0) {
        $Job.State = 'Failed'
    } else {
        $Job.Output = $Job.Stdout.Result
        $Job.State = 'Completed'
    }
    # Diagnostics may contain selected paths; do not expose stderr in the UI.
    $Job.State
}
function Close-SentinelProcessJob($Job) {
    if ($null -eq $Job) { return }
    if ($Job.State -eq 'Running') { Stop-SentinelProcessJob $Job }
    $Job.Process.Dispose()
}
