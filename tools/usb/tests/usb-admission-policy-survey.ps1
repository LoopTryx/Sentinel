param([switch]$Run)
$ErrorActionPreference='Stop'
$root=Split-Path (Split-Path (Split-Path $PSScriptRoot))
Add-Type -Path @((Join-Path $root 'tools/usb/DuckyLocalGpo.cs'),(Join-Path $root 'tools/usb/UsbAdmissionPolicySurvey.cs'))
function Assert($ok,$label){if(!$ok){throw $label}}
$a=[UsbAdmissionPolicySurvey+Snapshot]::new();$b=[UsbAdmissionPolicySurvey+Snapshot]::new()
Assert ([UsbAdmissionPolicySurvey]::MatchingSwitches($a,$b)) 'Absent switch snapshots match'
$b.SwitchStates[0]=1
Assert (![UsbAdmissionPolicySurvey]::MatchingSwitches($a,$b)) 'Different switch snapshots refuse'
$a.SwitchStates[0]=1
Assert ([UsbAdmissionPolicySurvey]::MatchingSwitches($a,$b)) 'Known identical switch snapshots match'
$a.InvalidSwitches=1
Assert (![UsbAdmissionPolicySurvey]::MatchingSwitches($a,$b)) 'Malformed switch snapshots refuse'
$csc=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
$target=Join-Path $root 'artifacts/Sentinel.UsbPolicySurvey.exe'
& $csc /nologo /target:exe /platform:x64 ('/out:'+$target) (Join-Path $root 'tools/usb/DuckyLocalGpo.cs') (Join-Path $root 'tools/usb/UsbAdmissionPolicySurvey.cs')
if($LASTEXITCODE -ne 0){throw 'Survey compile failed'}
Write-Output 'PASS: read-only policy survey switch comparison and native build'
if($Run){& $target;if($LASTEXITCODE -ne 0){throw 'Survey native read failed'}}
