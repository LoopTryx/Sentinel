$ErrorActionPreference = 'Stop'
$helper = Join-Path $PSScriptRoot '..\ScanJob.ps1'
if (-not (Test-Path $helper)) { throw 'Missing asynchronous desktop scan job implementation' }
. $helper
function Assert($Condition, $Message) { if (-not $Condition) { throw $Message } }
function Finish($Job) {
    $deadline = [DateTime]::UtcNow.AddSeconds(10)
    do {
        $state = Get-SentinelProcessJob $Job
        if ($state -ne 'Running') { return $state }
        Start-Sleep -Milliseconds 25
    } while ([DateTime]::UtcNow -lt $deadline)
    throw 'Job did not settle within the test deadline'
}
$exe = (Get-Command powershell.exe).Source
function Launch([string]$Code, [int]$TimeoutSeconds = 5) {
    $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($Code))
    Start-SentinelProcessJob -Executable $exe -Arguments @('-NoProfile', '-EncodedCommand', $encoded) -TimeoutSeconds $TimeoutSeconds
}
$jobs = @()
try {
    $job = Launch 'Start-Sleep -Milliseconds 400; [Console]::Out.Write("finished")'
    $jobs += $job
    Assert ((Get-SentinelProcessJob $job) -eq 'Running') 'Starting a job blocked until completion'
    Assert ((Finish $job) -eq 'Completed') 'Successful process was not completed'
    Assert ($job.Output -eq 'finished') 'Captured stdout differs'

    $job = Launch '[Console]::Error.Write("private diagnostic"); exit 7'
    $jobs += $job
    Assert ((Finish $job) -eq 'Failed') 'Nonzero exit was accepted'
    Assert ($job.ExitCode -eq 7) 'Exit code not retained'

    $job = Launch 'Start-Sleep -Seconds 30'
    $jobs += $job
    Stop-SentinelProcessJob $job
    Assert ((Finish $job) -eq 'Cancelled') 'Cancelled process was accepted as completed'
    Assert ($job.Process.HasExited) 'Cancelled process still running'

    $job = Launch 'Start-Sleep -Seconds 30' 1
    $jobs += $job
    Assert ((Finish $job) -eq 'TimedOut') 'Hung process did not time out'
    Assert ($job.Process.HasExited) 'Timed out process still running'

    # Windows command-line quoting must preserve a spaced path and trailing slash.
    $path = Join-Path ([IO.Path]::GetTempPath()) ('Sentinel job ' + [Guid]::NewGuid())
    New-Item -ItemType Directory -Path $path | Out-Null
    $scriptPath = Join-Path $path 'echo argument.ps1'
    Set-Content -LiteralPath $scriptPath -Value 'param([string]$Value); [Console]::Out.Write($Value)' -Encoding utf8
    try {
        $value = 'space and trailing\'
        $job = Start-SentinelProcessJob -Executable $exe -Arguments @('-NoProfile', '-File', $scriptPath, $value) -TimeoutSeconds 5
        $jobs += $job
        Assert ((Finish $job) -eq 'Completed') 'Quoted argument process failed'
        Assert ($job.Output -eq $value) 'Windows argument quoting changed the value'
    } finally { Remove-Item -LiteralPath $scriptPath; Remove-Item -LiteralPath $path }
    $unavailable = $false
    try { Start-SentinelProcessJob -Executable 'Z:\sentinel-does-not-exist.exe' -Arguments @() | Out-Null }
    catch { $unavailable = $true }
    Assert $unavailable 'Missing executable did not fail safely'

    $cli = Join-Path $PSScriptRoot '..\..\..\target\debug\sentinel-cli.exe'
    if (-not (Test-Path -LiteralPath $cli)) { throw 'Build sentinel-cli before desktop integration tests' }
    $sample = Join-Path ([IO.Path]::GetTempPath()) ('Sentinel scan ' + [Guid]::NewGuid())
    New-Item -ItemType Directory -Path $sample | Out-Null
    $sampleFile = Join-Path $sample 'harmless sample.txt'
    [IO.File]::WriteAllText($sampleFile, 'Harmless Sentinel desktop integration sample.')
    try {
        foreach ($kind in @('file', 'directory')) {
            $selected = if ($kind -eq 'file') { $sampleFile } else { $sample }
            $job = Start-SentinelProcessJob -Executable $cli -Arguments @('scan', $kind, $selected)
            $jobs += $job
            Assert ((Finish $job) -eq 'Completed') "CLI $kind scan failed"
            $report = $job.Output | ConvertFrom-Json
            Assert ($report.mode -eq 'local_read_only_preview') 'Scan preview mode missing'
            Assert ($report.coverage -eq 'partial') 'Scan coverage was falsely complete'
            Assert ($report.result.filesChecked -eq 1) "CLI $kind did not check the selected sample"
            Assert (-not $report.result.fullSignatureEngineActive) 'Signature engine falsely active'
        }
    } finally { Remove-Item -LiteralPath $sampleFile; Remove-Item -LiteralPath $sample }
    Write-Host 'Desktop process job tests passed: running, success, failure, cancellation, timeout, argument quoting.'
} finally {
    foreach ($job in $jobs) { Close-SentinelProcessJob $job }
}
