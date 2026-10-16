# Local preview process jobs. These are not durable or authenticated agent jobs.
if (-not ('SentinelBoundedOutput' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Text;
using System.Threading.Tasks;
public static class SentinelBoundedOutput {
    public static async Task<string> Capture(Stream stream, int limit) {
        using (var output = new MemoryStream()) {
            var buffer = new byte[4096];
            while (true) {
                var count = await stream.ReadAsync(buffer, 0, buffer.Length).ConfigureAwait(false);
                if (count == 0) break;
                if (output.Length + count > limit) throw new InvalidDataException("Output limit exceeded");
                output.Write(buffer, 0, count);
            }
            return new UTF8Encoding(false, true).GetString(output.ToArray());
        }
    }
}
'@
}
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
        $stdout = [SentinelBoundedOutput]::Capture($process.StandardOutput.BaseStream, 1048576)
        $stderr = [SentinelBoundedOutput]::Capture($process.StandardError.BaseStream, 65536)
        @{
            Process = $process; Stdout = $stdout; Stderr = $stderr
            Clock = [Diagnostics.Stopwatch]::StartNew(); TimeoutSeconds = $TimeoutSeconds
            State = 'Running'; StopReason = $null; Output = ''; ExitCode = $null
            Closed = $false; CleanupFailed = $false; DrainIncomplete = $false
        }
    } catch {
        try {
            if ($started -and -not $process.HasExited) { $process.Kill(); [void]$process.WaitForExit(1000) }
        } catch { } finally { $process.Dispose() }
        throw
    }
}
function Stop-SentinelProcessJob {
    param($Job, [ValidateSet('Cancelled', 'TimedOut', 'Failed')][string]$Reason = 'Cancelled')
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
    if ($Job.Stdout.IsFaulted -or $Job.Stderr.IsFaulted) {
        Stop-SentinelProcessJob $Job 'Failed'
    }
    if ($Job.Clock.Elapsed.TotalSeconds -ge $Job.TimeoutSeconds) {
        Stop-SentinelProcessJob $Job 'TimedOut'
        if (-not $Job.Process.HasExited -or -not $Job.Stdout.IsCompleted -or -not $Job.Stderr.IsCompleted) {
            $Job.State = if ($Job.StopReason) { $Job.StopReason } else { 'TimedOut' }
            $Job.Clock.Stop()
            return $Job.State
        }
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
    if ($null -eq $Job -or $Job.Closed) { return }
    $clock = [Diagnostics.Stopwatch]::StartNew()
    try {
        if (-not $Job.Process.HasExited) {
            if (-not $Job.StopReason) { $Job.StopReason = 'Cancelled' }
            $Job.Process.Kill()
        }
        if (-not $Job.Process.WaitForExit(1000)) { $Job.CleanupFailed = $true }
        $tasks = @($Job.Stdout, $Job.Stderr) | Where-Object { $null -ne $_ }
        $remaining = [Math]::Max(0, 1000 - [int]$clock.ElapsedMilliseconds)
        if ($tasks.Count -gt 0) {
            try {
                if (-not [Threading.Tasks.Task]::WaitAll([Threading.Tasks.Task[]]$tasks, $remaining)) {
                    $Job.DrainIncomplete = $true
                    $Job.CleanupFailed = $true
                }
            }
            catch { } # Faulted bounded captures are expected on rejected output.
        }
    } catch {
        $Job.CleanupFailed = $true
    } finally {
        if ($Job.CleanupFailed) { $Job.State = 'Failed' }
        elseif ($Job.State -eq 'Running' -and $Job.StopReason) { $Job.State = $Job.StopReason }
        $Job.Clock.Stop()
        try { $Job.Process.Dispose() } catch { $Job.CleanupFailed = $true; $Job.State = 'Failed' }
        $Job.Closed = $true
    }
}
