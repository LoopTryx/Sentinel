$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$csc=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
$target=Join-Path $root 'artifacts/Sentinel.UsbLegacyExactOverlayTest.exe'
$sources=@('tools/usb/UsbLegacyReleasedBaseline.cs','tools/usb/DuckyPolicyJournal.cs','apps/desktop/DuckyPolicyEnrollment.cs','tools/usb/tests/UsbLegacyExactOverlayTest.cs')|ForEach-Object{Join-Path $root $_}
& $csc /nologo /target:exe /platform:x64 /reference:Microsoft.CSharp.dll /reference:System.Web.Extensions.dll /main:UsbLegacyExactOverlayTest ('/out:'+$target) $sources
if($LASTEXITCODE -ne 0){throw 'Legacy exact overlay seam test build failed'}
& $target
if($LASTEXITCODE -ne 0){throw 'Legacy exact overlay seam regression failed'}
