$ErrorActionPreference = 'Stop'
$script = Join-Path $PSScriptRoot '..\Sentinel.ps1'
$output = & powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -File $script -Smoke
if ($LASTEXITCODE -ne 0) { throw "Desktop smoke failed: $output" }
$result = $output | ConvertFrom-Json
if ($result.title -ne 'Sentinel') { throw 'Native window title was not Sentinel' }
if ($result.handle -le 0) { throw 'No native window handle was created' }
if ($result.coverage -ne 'unavailable') { throw 'Fixture coverage was not labeled unavailable' }
Write-Host 'Native desktop smoke passed.'
