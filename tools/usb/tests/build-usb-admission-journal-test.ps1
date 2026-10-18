$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$csc=Join-Path $env:windir 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$sources=@('tools/usb/tests/UsbAdmissionJournalTest.cs','tools/usb/UsbAdmissionJournal.cs','tools/usb/DuckyPolicyJournal.cs')|ForEach-Object{Join-Path $root $_}
$output=Join-Path $root 'artifacts/Sentinel.AdmissionJournalQualification.exe'
& $csc /nologo /target:winexe /platform:x64 /main:UsbAdmissionJournalTest (('/out:')+$output) (('/win32manifest:')+(Join-Path $root 'apps/desktop/password-approval.manifest')) $sources
if($LASTEXITCODE -ne 0){throw 'Native admission journal qualification build failed'}
$pure=Join-Path $root 'artifacts/Sentinel.AdmissionJournalPureTest.exe'
& $csc /nologo /target:exe /platform:x64 /main:UsbAdmissionJournalPureTest (('/out:')+$pure) $sources
if($LASTEXITCODE -ne 0){throw 'Pure admission journal test build failed'}
& $pure
if($LASTEXITCODE -ne 0){throw 'Pure admission journal validation failed'}
Write-Output 'Built native protected journal qualification; native administrator test not executed'
