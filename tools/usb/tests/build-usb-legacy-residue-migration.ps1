param([switch]$ReviewedMigration,[switch]$RunPrivateTests)
$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$framework=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319'
# The fixed source-history extraction builds/runs only the nonprivileged parser test.
& (Join-Path $PSScriptRoot 'build-usb-legacy-evidence-survey.ps1')
$sources=@('tools/usb/UsbLegacyResidueMigration.cs','tools/usb/DuckyPolicyJournal.cs','tools/usb/DuckyLocalGpo.cs','apps/desktop/DuckyPolicyEnrollment.cs')|ForEach-Object{Join-Path $root $_}
$options=@('/nologo','/platform:x64',('/reference:'+(Join-Path $framework 'Microsoft.CSharp.dll')),('/reference:'+(Join-Path $framework 'System.Web.Extensions.dll')),('/resource:'+(Join-Path $root 'tools/usb/DuckyPolicyEntry.cs')+',Sentinel.LegacySource.Current'))
$historical=Join-Path $root 'artifacts/LegacyDuckyEntry-d0c3349.cs';if(Test-Path -LiteralPath $historical){$options+=('/resource:'+$historical+',Sentinel.LegacySource.Historical')}
$output=Join-Path $root 'artifacts/Sentinel.UsbLegacyResidueMigration.exe'
$flags=@();if($ReviewedMigration){$flags+='/define:SENTINEL_USB_LEGACY_MIGRATION_REVIEWED'}
& (Join-Path $framework 'csc.exe') @options @flags /target:winexe /main:UsbLegacyResidueMigration ('/out:'+$output) ('/win32manifest:'+(Join-Path $root 'apps/desktop/password-approval.manifest')) $sources
if($LASTEXITCODE -ne 0){throw 'Legacy migration candidate build failed'}
$test=Join-Path $root 'artifacts/Sentinel.UsbLegacyResidueMigrationTest.exe'
& (Join-Path $framework 'csc.exe') @options /target:exe /main:UsbLegacyResidueMigrationTest ('/out:'+$test) $sources (Join-Path $PSScriptRoot 'UsbLegacyResidueMigrationTest.cs')
if($LASTEXITCODE -ne 0){throw 'Legacy migration private fixture build failed'}
if($RunPrivateTests){& $test;if($LASTEXITCODE -ne 0){throw 'Legacy migration private fixture failed'}}
Write-Output 'Built fixed native legacy migration; real policy helper was not launched'
