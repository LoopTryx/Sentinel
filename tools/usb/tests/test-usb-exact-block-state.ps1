$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$csc=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
$target=Join-Path $root 'artifacts/Sentinel.UsbExactBlockStateTest.exe'
& $csc /nologo /target:exe /platform:x64 /main:UsbExactBlockStateTest ('/out:'+$target) (Join-Path $root 'tools/usb/UsbExactBlockState.cs') (Join-Path $PSScriptRoot 'UsbExactBlockStateTest.cs')
if($LASTEXITCODE -ne 0){throw 'Exact block state test build failed'}
& $target
if($LASTEXITCODE -ne 0){throw 'Exact block state regression failed'}
