$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$csc=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
$sources=@('UsbExactBlockState.cs','UsbExactBlockTransaction.cs','UsbExactBlockFileStore.cs','UsbExactBlockRecoveryTasks.cs','UsbExactBlockBackend.cs','UsbExactBlockWorker.cs','UsbExactBlockGpo.cs','DuckyPolicyJournal.cs','DuckyLocalGpo.cs','DuckyWorkerJob.cs')|ForEach-Object{Join-Path $root ('tools/usb/'+$_)}
& $csc /nologo /target:exe /platform:x64 /reference:Microsoft.CSharp.dll /define:SENTINEL_USB_EXACT_PRIVATE_QUALIFICATION /main:UsbExactBlockWorker ('/out:'+(Join-Path $root 'artifacts/Sentinel.UsbExactBlockWorker.Private.exe')) $sources
if($LASTEXITCODE -ne 0){throw 'Private exact backend worker build failed'}
Write-Output 'Built private exact backend worker only; no installation, registration, policy or device action'
