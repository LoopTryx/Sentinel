$ErrorActionPreference='Stop'
$repo=Split-Path (Split-Path (Split-Path $PSScriptRoot))
$compiler=Join-Path $env:SystemRoot 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
$output=Join-Path $repo 'artifacts/DuckyFilterHold-v3.exe'
& $compiler /nologo /target:exe ('/out:'+$output) /r:System.Web.Extensions.dll (Join-Path $repo 'tools/usb/DuckyNativeBackend.cs') (Join-Path $repo 'tools/usb/DuckyFilterHold.cs')
if($LASTEXITCODE -ne 0){throw 'Filter compile failed'}
& $output --selftest
if($LASTEXITCODE -ne 0){throw 'Filter target selection failed'}
