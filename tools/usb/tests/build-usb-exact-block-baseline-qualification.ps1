$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$csc=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
$sources=@('tools/usb/UsbExactBlockBaseline.cs','tools/usb/UsbExactBlockGpo.cs','tools/usb/UsbLegacyReleasedBaseline.cs','tools/usb/DuckyPolicyJournal.cs','tools/usb/DuckyLocalGpo.cs','apps/desktop/DuckyPolicyEnrollment.cs','tools/usb/tests/UsbExactBlockBaselineQualification.cs')|ForEach-Object{Join-Path $root $_}
$resources=@(('/resource:'+(Join-Path $root 'tools/usb/DuckyPolicyEntry.cs')+',Sentinel.LegacySource.Current'),('/resource:'+(Join-Path $root 'artifacts/LegacyDuckyEntry-d0c3349.cs')+',Sentinel.LegacySource.Historical'))
& $csc /nologo /target:exe /platform:x64 /define:SENTINEL_USB_EXACT_LIVE_REVIEWED /reference:Microsoft.CSharp.dll /reference:System.Web.Extensions.dll /main:UsbExactBlockBaselineQualification ('/out:'+(Join-Path $root 'artifacts/UsbExactBlockBaselineQualification.exe')) $resources $sources
if($LASTEXITCODE -ne 0){throw 'Readonly exact baseline qualification build failed'}
