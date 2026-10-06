$ErrorActionPreference='Stop'
$repo=Split-Path -Parent $PSScriptRoot
$runtime=Join-Path $repo 'apps\demo-runtime\server.mjs'
$console=Join-Path $repo 'apps\desktop\console-build\Sentinel.Glass.exe'
$config=Join-Path $repo 'apps\desktop\console-build\demo-runtime.json'
if(-not(Test-Path -LiteralPath $console)){throw 'Build the desktop console first.'}
if(Test-Path -LiteralPath $config){Remove-Item -LiteralPath $config}
$worker=Start-Process -FilePath (Get-Command node.exe).Source -ArgumentList @(('"'+$runtime+'"')) -WorkingDirectory $repo -WindowStyle Hidden -PassThru
try {
  for($attempt=0;$attempt -lt 100;$attempt++){
    if($worker.HasExited){throw 'Demo runtime exited before launch.'}
    if(Test-Path -LiteralPath $config){break}
    Start-Sleep -Milliseconds 100
  }
  if(-not(Test-Path -LiteralPath $config)){throw 'Demo runtime did not become ready.'}
  # Visible window is explicitly requested by the owner.
  $ui=Start-Process -FilePath $console -ArgumentList '--demo' -WorkingDirectory $repo -WindowStyle Normal -PassThru
  $ui.WaitForExit()
} finally {
  if(-not $worker.HasExited){$worker.Kill();$worker.WaitForExit(5000)|Out-Null}
  $worker.Dispose()
  if(Test-Path -LiteralPath $config){Remove-Item -LiteralPath $config}
}
