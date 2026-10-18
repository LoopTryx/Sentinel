$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$csc=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
$target=Join-Path $root 'artifacts/Sentinel.UsbExactBlockRecoveryTasksTest.exe'
$sources=@('tools/usb/UsbExactBlockRecoveryTasks.cs','tools/usb/UsbExactBlockState.cs','tools/usb/UsbExactBlockTransaction.cs','tools/usb/DuckyPolicyJournal.cs','tools/usb/tests/UsbExactBlockRecoveryTasksTest.cs')|ForEach-Object{Join-Path $root $_}
& $csc /nologo /target:exe /platform:x64 /reference:Microsoft.CSharp.dll /main:UsbExactBlockRecoveryTasksTest ('/out:'+$target) $sources
if($LASTEXITCODE -ne 0){throw 'Exact recovery task contract test build failed'}
& $target
if($LASTEXITCODE -ne 0){throw 'Exact recovery task contract regression failed'}
