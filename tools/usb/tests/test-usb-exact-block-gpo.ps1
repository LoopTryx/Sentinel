$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$csc=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
$target=Join-Path $root 'artifacts/UsbExactBlockGpoTest.exe'
& $csc /nologo /target:exe /platform:x64 /main:UsbExactBlockGpoTest ('/out:'+$target) (Join-Path $root 'tools/usb/UsbExactBlockGpo.cs') (Join-Path $root 'tools/usb/DuckyLocalGpo.cs') (Join-Path $PSScriptRoot 'UsbExactBlockGpoTest.cs')
if($LASTEXITCODE -ne 0){throw 'Exact GPO test build failed'}
& $target
if($LASTEXITCODE -ne 0){throw 'Exact GPO regression failed'}
