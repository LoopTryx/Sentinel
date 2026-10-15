$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
& (Join-Path $PSScriptRoot 'ducky-worker-task.ps1') -BuildOnly
$csc=Join-Path $env:windir 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$a=@('/nologo','/target:winexe','/platform:x64','/main:DuckyWorkerQualification',('/out:'+(Join-Path $root 'artifacts/Sentinel.WorkerQualification.exe')),('/win32manifest:'+(Join-Path $root 'apps/desktop/password-approval.manifest')),('/reference:'+(Join-Path (Split-Path $csc) 'Microsoft.CSharp.dll')),('/resource:'+(Join-Path $root 'artifacts/DuckyWorkerHangFixture.exe')+',Sentinel.WorkerFixture'))
$a+=@('tools/usb/tests/DuckyWorkerQualification.cs','tools/usb/DuckyWorkerLease.cs','tools/usb/DuckyLocalGpo.cs','tools/usb/DuckyPolicyJournal.cs')|ForEach-Object{Join-Path $root $_}
& $csc $a
if($LASTEXITCODE -ne 0){throw 'Native worker qualification build failed'}
Write-Output 'Built harmless worker qualification; no task registered or device policy changed'
