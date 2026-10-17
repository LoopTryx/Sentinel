$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$csc=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
$target=Join-Path $root 'artifacts/Sentinel.UsbExactBlockTransactionTest.exe'
& $csc /nologo /target:exe /platform:x64 /main:UsbExactBlockTransactionTest ('/out:'+$target) (Join-Path $root 'tools/usb/UsbExactBlockState.cs') (Join-Path $root 'tools/usb/UsbExactBlockTransaction.cs') (Join-Path $PSScriptRoot 'UsbExactBlockTransactionTest.cs')
if($LASTEXITCODE -ne 0){throw 'Exact block transaction test build failed'}
& $target
if($LASTEXITCODE -ne 0){throw 'Exact block transaction regression failed'}
