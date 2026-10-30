$ErrorActionPreference='Stop'
$root=Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$framework=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319'
$output=Join-Path $PSScriptRoot '../../../artifacts/SentinelAiTest.exe'
& (Join-Path $framework 'csc.exe') /nologo /target:exe ('/out:'+$output) ('/reference:'+(Join-Path $framework 'System.Net.Http.dll')) ('/reference:'+(Join-Path $framework 'System.Web.Extensions.dll')) (Join-Path $PSScriptRoot 'SentinelAiTest.cs') (Join-Path $PSScriptRoot '../SentinelNim.cs')
if($LASTEXITCODE -ne 0){throw 'SentinelAI test compile failed'}
& $output
if($LASTEXITCODE -ne 0){throw 'SentinelAI tests failed'}
