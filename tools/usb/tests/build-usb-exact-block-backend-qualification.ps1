param([switch]$UseExistingWorker)
$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$csc=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
$sources=@('UsbExactBlockState.cs','UsbExactBlockTransaction.cs','UsbExactBlockFileStore.cs','UsbExactBlockRecoveryTasks.cs','UsbExactBlockBackend.cs','UsbExactBlockWorker.cs','UsbExactBlockGpo.cs','DuckyPolicyJournal.cs','DuckyLocalGpo.cs','DuckyWorkerJob.cs')|ForEach-Object{Join-Path $root ('tools/usb/'+$_)}
if(!$UseExistingWorker){& (Join-Path $PSScriptRoot 'build-usb-exact-block-worker.ps1')}
$worker=Join-Path $root 'artifacts/Sentinel.UsbExactBlockWorker.Private.exe'
$sources+=Join-Path $PSScriptRoot 'UsbExactBlockBackendQualification.cs'
& $csc /nologo /target:exe /platform:x64 /reference:Microsoft.CSharp.dll /define:SENTINEL_USB_EXACT_PRIVATE_QUALIFICATION /main:UsbExactBlockBackendQualification ('/resource:'+$worker+',Sentinel.Exact.Worker') ('/win32manifest:'+(Join-Path $root 'apps/desktop/password-approval.manifest')) ('/out:'+(Join-Path $root 'artifacts/Sentinel.UsbExactBlockBackendQualification.exe')) $sources
if($LASTEXITCODE -ne 0){throw 'Full private backend qualification build failed'}
Write-Output 'Built full private backend qualification; NOT executed'
