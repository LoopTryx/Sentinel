$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$csc=Join-Path $env:windir 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
$target=Join-Path $root 'artifacts/Sentinel.AdmissionCleanupStageTest.exe'
$sources=@('tools/usb/tests/UsbAdmissionCleanupStageTest.cs','tools/usb/UsbAdmissionCleanupStage.cs','tools/usb/UsbAdmissionJournal.cs','tools/usb/DuckyPolicyJournal.cs')|ForEach-Object{Join-Path $root $_}
& $csc /nologo /target:exe /platform:x64 /define:SENTINEL_USB_ADMISSION_TEST ('/out:'+$target) $sources
if($LASTEXITCODE -ne 0){throw 'Cleanup stage test build failed'}
Write-Output 'Built protected cleanup-stage filesystem test; administrator execution not started'
