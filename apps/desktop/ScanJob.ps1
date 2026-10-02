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

function ConvertFrom-SentinelScanReport {
    param([string]$Json, [ValidateSet('file', 'directory')][string]$Kind)
    if ([Text.Encoding]::UTF8.GetByteCount($Json) -gt 1048576) { throw 'Report exceeds display limit' }
    $report = $Json | ConvertFrom-Json -ErrorAction Stop
    $profile = if ($Kind -eq 'file') { 'single_file' } else { 'custom_directory' }
    if ($report.mode -ne 'local_read_only_preview' -or $report.coverage -ne 'partial' -or $report.profile -ne $profile) {
        throw 'Unexpected preview envelope'
    }
    $result = $report.result
    if ($null -eq $result -or $result -is [array]) { throw 'Missing scan result' }
    foreach ($field in @('bytesRead', 'filesVisited', 'filesChecked', 'filesSkipped', 'accessErrors', 'engineFailures')) {
        $value = $result.$field
        if (($value -isnot [int] -and $value -isnot [long]) -or $value -lt 0) { throw 'Invalid scan count' }
    }
    if ($result.filesChecked -gt $result.filesVisited -or $result.fullSignatureEngineActive -isnot [bool] -or $result.fullSignatureEngineActive) {
        throw 'Contradictory scan result'
    }
    $states = @('no_known_finding', 'test_signature_found', 'skipped_limit', 'skipped_unsupported', 'access_error', 'changed_during_scan', 'cancelled')
    if ($Kind -eq 'file') {
        if ($result.state -notin $states -or 'sha256' -notin $result.PSObject.Properties.Name) { throw 'Invalid file result' }
        if ($null -ne $result.sha256 -and ($result.sha256 -isnot [string] -or $result.sha256 -cnotmatch '^[a-f0-9]{64}$')) {
            throw 'Invalid digest'
        }
        if ($result.filesVisited -ne 1 -or $result.engineFailures -ne 0) { throw 'Invalid single-file counts' }
        if ($result.state -in @('no_known_finding', 'test_signature_found')) {
            if ($result.filesChecked -ne 1 -or $result.filesSkipped -ne 0 -or $result.accessErrors -ne 0 -or $null -eq $result.sha256) {
                throw 'Contradictory checked file result'
            }
        } elseif ($result.state -eq 'access_error') {
            if ($result.filesChecked -ne 0 -or $result.filesSkipped -ne 0 -or $result.accessErrors -ne 1 -or $null -ne $result.sha256) {
                throw 'Contradictory access error result'
            }
        } else {
            if ($result.filesChecked -ne 0 -or $result.filesSkipped -ne 1 -or $result.accessErrors -ne 0 -or $null -ne $result.sha256) {
                throw 'Contradictory skipped file result'
            }
        }
    } else {
        foreach ($field in @('complete', 'cancelled', 'limitReached')) {
            if ($result.$field -isnot [bool]) { throw 'Missing traversal state' }
        }
        if ($result.entriesVisited -isnot [int] -and $result.entriesVisited -isnot [long]) { throw 'Invalid entry count' }
        if ($result.entriesVisited -lt 0 -or $result.findings -isnot [array] -or $result.findings.Count -gt 1000) { throw 'Invalid findings' }
        foreach ($finding in $result.findings) {
            if ($finding.state -notin $states -or $finding.relativePath -isnot [string] -or $finding.relativePath.Length -gt 32768) {
                throw 'Invalid finding entry'
            }
        }
    }
    $report
}
