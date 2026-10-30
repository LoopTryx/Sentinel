$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$csc=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
$sources=@('tools/usb/UsbExactBlockState.cs','tools/usb/UsbExactBlockTransaction.cs','tools/usb/UsbExactBlockFileStore.cs','tools/usb/DuckyPolicyJournal.cs','tools/usb/UsbExactBlockGpo.cs','tools/usb/DuckyLocalGpo.cs','tools/usb/DuckyWorkerJob.cs','tools/usb/tests/UsbExactBlockPrivateQualification.cs')|ForEach-Object{Join-Path $root $_}
& $csc /nologo /target:exe /platform:x64 /main:UsbExactBlockPrivateQualification ('/out:'+(Join-Path $root 'artifacts/UsbExactBlockPrivateQualification.exe')) $sources
if($LASTEXITCODE -ne 0){throw 'Private exact qualification build failed'}
