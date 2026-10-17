param([switch]$ReviewedLive)
$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$csc=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
$sources=@('UsbExactBlockState.cs','UsbExactBlockTransaction.cs','UsbExactBlockFileStore.cs','UsbExactBlockRecoveryTasks.cs','UsbExactBlockBackend.cs','UsbExactBlockWorker.cs','UsbExactBlockGpo.cs','DuckyPolicyJournal.cs','DuckyLocalGpo.cs','DuckyWorkerJob.cs')|ForEach-Object{Join-Path $root ('tools/usb/'+$_)}
$options=@('/define:SENTINEL_USB_EXACT_PRIVATE_QUALIFICATION')
$output=Join-Path $root 'artifacts/Sentinel.UsbExactBlockWorker.Private.exe'
if($ReviewedLive){
 $options=@('/define:SENTINEL_USB_EXACT_LIVE_REVIEWED','/reference:System.Web.Extensions.dll')
 $sources+=@('tools/usb/UsbExactBlockBaseline.cs','tools/usb/UsbLegacyReleasedBaseline.cs','apps/desktop/DuckyPolicyEnrollment.cs')|ForEach-Object{Join-Path $root $_}
 $options+=('/resource:'+(Join-Path $root 'tools/usb/DuckyPolicyEntry.cs')+',Sentinel.LegacySource.Current')
 $options+=('/resource:'+(Join-Path $root 'artifacts/LegacyDuckyEntry-d0c3349.cs')+',Sentinel.LegacySource.Historical')
 $output=Join-Path $root 'artifacts/Sentinel.UsbExactBlockWorker.Live.exe'
}
& $csc /nologo /target:exe /platform:x64 /reference:Microsoft.CSharp.dll @options /main:UsbExactBlockWorker ('/out:'+$output) $sources
if($LASTEXITCODE -ne 0){throw 'Private exact backend worker build failed'}
Write-Output ('Built exact backend worker: '+$output+'; no installation, registration, policy or device action')
