$ErrorActionPreference='Stop'
$repo=Split-Path -Parent $PSScriptRoot
$runtime=Join-Path $repo 'apps\demo-runtime\server.mjs'
$console=Join-Path $repo 'apps\desktop\console-build\Sentinel.Glass.exe'
$config=Join-Path $repo 'apps\desktop\console-build\demo-runtime.json'
if(-not(Test-Path -LiteralPath $console)){throw 'Build the desktop console first.'}
$instanceHash=[Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($repo))).Substring(0,24)
$instanceMutex=[Threading.Mutex]::new($false,"Local\SentinelDemo_$instanceHash")
$ownsInstance=$false
try {$ownsInstance=$instanceMutex.WaitOne(0)} catch [Threading.AbandonedMutexException] {$ownsInstance=$true}
if(-not $ownsInstance){$instanceMutex.Dispose();throw 'This Sentinel demo is already running. Close its window first.'}
$worker=$null
try {
if(Test-Path -LiteralPath $config){Remove-Item -LiteralPath $config}
$worker=Start-Process -FilePath (Get-Command node.exe).Source -ArgumentList @(('"'+$runtime+'"')) -WorkingDirectory $repo -WindowStyle Hidden -PassThru
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
  if($worker){
    if(-not $worker.HasExited){
      try {
        $bootstrap=Get-Content -LiteralPath $config -Raw | ConvertFrom-Json
        Invoke-RestMethod -Uri ($bootstrap.url+'/shutdown') -Method Post -Headers @{Authorization=('Bearer '+$bootstrap.token)} -ContentType 'application/json' -Body '{}' -TimeoutSec 3 | Out-Null
      } catch {Write-Warning 'Graceful demo shutdown unavailable; stopping the owned runtime.'}
      if(-not $worker.WaitForExit(5000)){$worker.Kill();$worker.WaitForExit(5000)|Out-Null}
    }
    $worker.Dispose()
  }
  if(Test-Path -LiteralPath $config){Remove-Item -LiteralPath $config}
  if($ownsInstance){$instanceMutex.ReleaseMutex()}
  $instanceMutex.Dispose()
}
