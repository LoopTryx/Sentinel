$ErrorActionPreference='Stop'
$source=Get-Content (Join-Path $PSScriptRoot '..\launch-demo.ps1') -Raw
$start=$source.IndexOf('$instanceHasher=')
$end=$source.IndexOf('$instanceMutex=')
if($start -lt 0 -or $end -le $start){throw 'Missing launcher identity calculation.'}
$repo='C:\Synthetic Sentinel Demo'
Invoke-Expression $source.Substring($start,$end-$start)
if($instanceHash -cne '81F9A7E3EFF89B74DDC70127'){throw "Unexpected launcher identity: $instanceHash"}
Write-Output 'Launcher instance identity compatible.'
