$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$csc=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
$sources=@('tools/usb/UsbExactBlockState.cs','tools/usb/UsbExactBlockTransaction.cs','tools/usb/UsbExactBlockFileStore.cs','tools/usb/UsbExactBlockRecoveryTasks.cs','tools/usb/DuckyPolicyJournal.cs','tools/usb/UsbExactBlockGpo.cs','tools/usb/DuckyLocalGpo.cs','tools/usb/DuckyWorkerJob.cs','tools/usb/tests/UsbExactBlockNativeBackendQualification.cs','tools/usb/tests/UsbExactBlockSystemQualification.cs')|ForEach-Object{Join-Path $root $_}
& $csc /nologo /target:exe /platform:x64 /define:SENTINEL_USB_EXACT_PRIVATE_QUALIFICATION /reference:Microsoft.CSharp.dll /main:UsbExactBlockSystemQualification ('/out:'+(Join-Path $root 'artifacts/UsbExactBlockSystemQualification.exe')) $sources
if($LASTEXITCODE -ne 0){throw 'Private SYSTEM qualification build failed'}
