$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '..\ScanJob.ps1')
if (-not (Get-Command ConvertFrom-SentinelScanReport -ErrorAction SilentlyContinue)) {
    throw 'Missing report validation before completed UI presentation'
}
$valid = @{
    mode = 'local_read_only_preview'; profile = 'single_file'; coverage = 'partial'
    result = @{ state = 'no_known_finding'; bytesRead = 4; sha256 = ('a' * 64)
        filesVisited = 1; filesChecked = 1; filesSkipped = 0; accessErrors = 0
        engineFailures = 0; fullSignatureEngineActive = $false }
}
function Reject($Value, $Kind = 'file') {
    $rejected = $false
    try { ConvertFrom-SentinelScanReport ($Value | ConvertTo-Json -Depth 8 -Compress) $Kind | Out-Null }
    catch { $rejected = $true }
    if (-not $rejected) { throw 'Malformed report accepted for completed display' }
}
$report = ConvertFrom-SentinelScanReport ($valid | ConvertTo-Json -Depth 8) 'file'
if ($report.result.filesChecked -ne 1) { throw 'Valid scan rejected or changed' }
Reject @{mode='local_read_only_preview';profile='single_file';coverage='partial';result=@{}}
foreach ($case in @('coverage','profile','missing','negative','string','fraction','boolean','hash','state','contradiction')) {
    $copy = $valid | ConvertTo-Json -Depth 8 | ConvertFrom-Json
    switch ($case) {
        'coverage' { $copy.coverage = 'complete' }
        'profile' { $copy.profile = 'custom_directory' }
        'missing' { $copy.result.PSObject.Properties.Remove('filesSkipped') }
        'negative' { $copy.result.filesChecked = -1 }
        'string' { $copy.result.filesChecked = '1' }
        'fraction' { $copy.result.filesChecked = 1.5 }
        'boolean' { $copy.result.fullSignatureEngineActive = 'false' }
        'hash' { $copy.result.sha256 = 'not a digest' }
        'state' { $copy.result.state = 'safe' }
        'contradiction' { $copy.result.filesChecked = 2 }
    }
    Reject $copy
}
try { ConvertFrom-SentinelScanReport ('x' * (1048576 + 1)) 'file'; throw 'Oversized report accepted' }
catch { if ($_.Exception.Message -eq 'Oversized report accepted') { throw } }
Write-Host 'Desktop report validation tests passed.'

$accessError = $valid | ConvertTo-Json -Depth 8 | ConvertFrom-Json
$accessError.result.state = 'access_error'
$accessError.result.filesChecked = 0
$accessError.result.accessErrors = 1
$accessError.result.sha256 = $null
$acceptedError = ConvertFrom-SentinelScanReport ($accessError | ConvertTo-Json -Depth 8) 'file'
if ($acceptedError.result.accessErrors -ne 1) { throw 'Access error lost during validation' }

foreach ($case in @('missingDigest', 'errorAsChecked', 'skippedAsChecked', 'checkedAsSkipped', 'inactiveEngine')) {
    $copy = $valid | ConvertTo-Json -Depth 8 | ConvertFrom-Json
    switch ($case) {
        'missingDigest' { $copy.result.sha256 = $null }
        'errorAsChecked' { $copy.result.state = 'access_error'; $copy.result.accessErrors = 1 }
        'skippedAsChecked' { $copy.result.state = 'skipped_limit' }
        'checkedAsSkipped' { $copy.result.filesChecked = 0; $copy.result.filesSkipped = 1 }
        'inactiveEngine' { $copy.result.fullSignatureEngineActive = $true }
    }
    Reject $copy
}
Write-Host 'Desktop report failure-state consistency tests passed.'

$directory = @{
    mode='local_read_only_preview'; profile='custom_directory'; coverage='partial'
    result=@{bytesRead=4; filesVisited=1; filesChecked=1; filesSkipped=0; accessErrors=0
        engineFailures=0; fullSignatureEngineActive=$false; complete=$true; cancelled=$false
        limitReached=$false; entriesVisited=1; findings=@()}
}
ConvertFrom-SentinelScanReport ($directory | ConvertTo-Json -Depth 8) 'directory' | Out-Null
foreach ($case in @('cancelledComplete','limitedComplete','skippedComplete','errorComplete','visitedBeyondEntries','unclassifiedVisited','classificationBeyondEntries')) {
    $copy = $directory | ConvertTo-Json -Depth 8 | ConvertFrom-Json
    switch ($case) {
        'cancelledComplete' { $copy.result.cancelled=$true }
        'limitedComplete' { $copy.result.limitReached=$true }
        'skippedComplete' { $copy.result.filesSkipped=1 }
        'errorComplete' { $copy.result.accessErrors=1 }
        'visitedBeyondEntries' { $copy.result.filesVisited=2 }
        'unclassifiedVisited' { $copy.result.filesChecked=0 }
        'classificationBeyondEntries' { $copy.result.complete=$false; $copy.result.filesSkipped=2 }
    }
    Reject $copy 'directory'
}
foreach ($case in @('cancelled','limited','skipped','accessError','rootAccessError','rootUnsupported')) {
    $copy = $directory | ConvertTo-Json -Depth 8 | ConvertFrom-Json
    $copy.result.complete=$false
    switch ($case) {
        'cancelled' { $copy.result.cancelled=$true }
        'limited' { $copy.result.limitReached=$true }
        'skipped' { $copy.result.filesChecked=0; $copy.result.filesSkipped=1 }
        'accessError' { $copy.result.filesChecked=0; $copy.result.accessErrors=1 }
        'rootAccessError' { $copy.result.entriesVisited=0; $copy.result.filesVisited=0; $copy.result.filesChecked=0; $copy.result.accessErrors=1 }
        'rootUnsupported' { $copy.result.entriesVisited=0; $copy.result.filesVisited=0; $copy.result.filesChecked=0; $copy.result.filesSkipped=1 }
    }
    ConvertFrom-SentinelScanReport ($copy | ConvertTo-Json -Depth 8) 'directory' | Out-Null
}
Write-Host 'Desktop directory aggregate validation tests passed.'
