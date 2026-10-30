$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$csc=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
$target=Join-Path $root 'artifacts/Sentinel.UsbAdmissionTabPipeNativeTest.exe'
& $csc /nologo /target:exe /platform:x64 /main:UsbAdmissionTabPipeNativeTest ('/out:'+$target) (Join-Path $root 'apps/desktop/UsbAdmissionTabPipe.cs') (Join-Path $PSScriptRoot 'UsbAdmissionTabPipeNativeTest.cs')
if($LASTEXITCODE -ne 0){throw 'USB tab native pipe test build failed'}
& $target
if($LASTEXITCODE -ne 0){throw 'USB tab native pipe regression failed'}
