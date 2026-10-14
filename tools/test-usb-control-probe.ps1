$ErrorActionPreference='Stop'
$repo=Split-Path -Parent $PSScriptRoot
$exe=Join-Path $repo 'artifacts\Sentinel.ControlProbe.exe'
$compiler=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
& $compiler /nologo /target:winexe /platform:x64 ('/out:'+$exe) /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Web.Extensions.dll (Join-Path $repo 'apps\desktop\UsbControlProbe.cs') (Join-Path $repo 'apps\desktop\UsbInputIdentity.cs') (Join-Path $repo 'apps\desktop\UsbConnectorEvidence.cs')
if($LASTEXITCODE -ne 0){throw 'Control probe build failed'}
$child=Start-Process -FilePath $exe -ArgumentList '--self-test' -WindowStyle Hidden -Wait -PassThru
if($child.ExitCode -ne 0){throw 'Control probe regression failed'}
Write-Output 'Control probe stage/bounds/redaction regressions PASS.'
