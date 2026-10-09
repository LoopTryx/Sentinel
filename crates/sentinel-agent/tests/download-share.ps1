# Harmless Windows sharing prerequisite; no native download capability is enabled.
$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT') { throw 'Unsupported platform: Windows sharing evidence required' }
$fixtureRoot = Join-Path ([IO.Path]::GetTempPath()) ('sentinel-download-share-' + [Guid]::NewGuid().ToString('N'))
$sourcePath = Join-Path $fixtureRoot 'harmless.txt'
$renamedPath = Join-Path $fixtureRoot 'renamed.txt'
[IO.Directory]::CreateDirectory($fixtureRoot) | Out-Null
$reader = $null
try {
    [IO.File]::WriteAllText($sourcePath, 'Sentinel harmless selected bytes')
    $reader = [IO.File]::Open($sourcePath, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
    $writeDenied = $false
    $renameDenied = $false
    try {
        $writer = [IO.File]::Open($sourcePath, [IO.FileMode]::Open, [IO.FileAccess]::Write, [IO.FileShare]::ReadWrite)
        $writer.Dispose()
    } catch [IO.IOException] { if (($_.Exception.HResult -band 65535) -ne 32) { throw }; $writeDenied = $true }
    try { [IO.File]::Move($sourcePath, $renamedPath) } catch [IO.IOException] { if (($_.Exception.HResult -band 65535) -ne 32) { throw }; $renameDenied = $true }
    if (-not ($writeDenied -and $renameDenied)) { throw 'Concurrent mutation/replacement was not rejected' }
    $memory = [IO.MemoryStream]::new()
    try { $reader.CopyTo($memory); $bytes = $memory.ToArray() } finally { $memory.Dispose() }
    $reader.Dispose()
    $reader = $null
    [IO.File]::WriteAllText($sourcePath, 'Replacement harmless bytes')
    if ([Text.Encoding]::UTF8.GetString($bytes) -ne 'Sentinel harmless selected bytes') { throw 'Retained bytes changed' }
    # A simulated cancelled acquisition must release the read handle even on error.
    try {
        $cancelledReader = [IO.File]::Open($sourcePath, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
        try { throw [OperationCanceledException]::new('synthetic cancellation') } finally { $cancelledReader.Dispose() }
    } catch [OperationCanceledException] { }
    $writer = [IO.File]::Open($sourcePath, [IO.FileMode]::Open, [IO.FileAccess]::Write, [IO.FileShare]::None)
    $writer.Dispose()
    Write-Output 'PASS: read-share mutation/rename rejection, retained bytes, cancellation handle cleanup'
} finally {
    if ($null -ne $reader) { $reader.Dispose() }
    # Delete only our two literal fixture files and the empty fresh directory.
    foreach ($fixturePath in @($sourcePath, $renamedPath)) {
        if ([IO.File]::Exists($fixturePath)) { [IO.File]::Delete($fixturePath) }
    }
    [IO.Directory]::Delete($fixtureRoot, $false)
}
