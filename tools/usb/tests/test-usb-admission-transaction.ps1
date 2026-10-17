$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$csc=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$sources=@('tools/usb/tests/UsbAdmissionTransactionTest.cs','tools/usb/UsbAdmissionTransaction.cs','tools/usb/UsbEnrollmentConfig.cs','tools/usb/UsbAdmissionJournal.cs','tools/usb/DuckyPolicyJournal.cs')|ForEach-Object{Join-Path $root $_}
$output=Join-Path $root 'artifacts/Sentinel.AdmissionTransactionTest.exe'
& $csc /nologo /target:exe /platform:x64 /main:UsbAdmissionTransactionTest ('/out:'+$output) $sources
if($LASTEXITCODE -ne 0){throw 'Admission transaction test build failed'}
& $output
if($LASTEXITCODE -ne 0){throw 'Admission transaction invariants failed'}
