$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$csc=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
$target=Join-Path $root 'artifacts/UsbExactBlockOverlayTest.exe'
$sources=@('tools/usb/UsbExactBlockGpo.cs','tools/usb/DuckyLocalGpo.cs','tools/usb/tests/UsbExactBlockOverlayTest.cs')|ForEach-Object{Join-Path $root $_}
& $csc /nologo /target:exe /platform:x64 /main:UsbExactBlockOverlayTest ('/out:'+$target) $sources
if($LASTEXITCODE -ne 0){throw 'Exact overlay test build failed'}
& $target
if($LASTEXITCODE -ne 0){throw 'Exact overlay test failed'}
