$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$csc=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
$sources=@('tools/usb/UsbExactBlockState.cs','tools/usb/UsbExactBlockTransaction.cs','tools/usb/UsbExactBlockFileStore.cs','tools/usb/DuckyPolicyJournal.cs','tools/usb/UsbExactBlockGpo.cs','tools/usb/DuckyLocalGpo.cs','tools/usb/DuckyWorkerJob.cs','tools/usb/tests/UsbExactBlockNativeBackendQualification.cs')|ForEach-Object{Join-Path $root $_}
$target=Join-Path $root 'artifacts/UsbExactBlockNativeBackendQualification.exe'
& $csc /nologo /target:exe /platform:x64 /main:UsbExactBlockNativeBackendQualification ('/win32manifest:'+(Join-Path $root 'apps/desktop/password-approval.manifest')) ('/out:'+$target) $sources
if($LASTEXITCODE -ne 0){throw 'Private native exact backend adapter qualification build failed'}
Write-Output 'Built manual private native adapter qualification only; NOT executed; independent recovery methods intentionally refuse'
