$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$framework=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319'
$sources=@('tools/usb/tests/UsbEnrollmentConfigTest.cs','tools/usb/UsbEnrollmentConfig.cs','tools/usb/DuckyPolicyJournal.cs')|ForEach-Object{Join-Path $root $_}
$native=Join-Path $root 'artifacts/Sentinel.EnrollmentConfigQualification.exe'
& (Join-Path $framework 'csc.exe') /nologo /target:winexe /platform:x64 /main:UsbEnrollmentConfigTest ('/out:'+$native) ('/win32manifest:'+(Join-Path $root 'apps/desktop/password-approval.manifest')) $sources
if($LASTEXITCODE -ne 0){throw 'Enrollment qualification build failed'}
$pure=Join-Path $root 'artifacts/Sentinel.EnrollmentConfigPureTest.exe'
& (Join-Path $framework 'csc.exe') /nologo /target:exe /platform:x64 /main:UsbEnrollmentConfigPureTest ('/out:'+$pure) $sources
if($LASTEXITCODE -ne 0){throw 'Enrollment pure test build failed'}
& $pure
if($LASTEXITCODE -ne 0){throw 'Enrollment pure validation failed'}
Write-Output 'Native enrollment configuration qualification built; protected native tests not launched'
