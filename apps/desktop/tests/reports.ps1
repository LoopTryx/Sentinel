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
