$ErrorActionPreference = 'Stop'
$output = Join-Path $PSScriptRoot '..\console-build'
$exe = Join-Path $output 'Sentinel.Glass.exe'
$evidence = Join-Path $output 'glass-smoke.txt'
if (Test-Path -LiteralPath $evidence) { Remove-Item -LiteralPath $evidence }
# WebView2 must have a visible native window to render and complete navigation.
$process = Start-Process -FilePath $exe -ArgumentList '--smoke' -PassThru -WindowStyle Normal
try {
  if (-not $process.WaitForExit(45000)) { $process.Kill(); throw 'Console smoke timed out' }
  if ($process.ExitCode -ne 0) { throw 'Console smoke failed; inspect local glass-smoke.txt' }
  $state = Get-Content -Raw -LiteralPath $evidence
  foreach ($required in @('navigation=True', 'glass=true', 'heading="Console"', 'custom_chrome=True', 'backend=unavailable')) {
    if (-not $state.Contains($required)) { throw "Missing smoke invariant: $required" }
  }
  Write-Output 'GLM glass console smoke passed: local assets, rendered Console, glass flag, custom frame, unavailable backend.'
} finally { $process.Dispose() }
