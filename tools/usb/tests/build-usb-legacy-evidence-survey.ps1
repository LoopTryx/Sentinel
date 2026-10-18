$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$framework=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319'
$output=Join-Path $root 'artifacts/Sentinel.UsbLegacyEvidenceSurvey.exe'
$arguments=@('/nologo','/target:winexe','/platform:x64','/main:UsbLegacyEvidenceSurvey',('/out:'+$output),('/win32manifest:'+(Join-Path $root 'apps/desktop/password-approval.manifest')),('/reference:'+(Join-Path $framework 'Microsoft.CSharp.dll')),('/reference:'+(Join-Path $framework 'System.Web.Extensions.dll')),('/resource:'+(Join-Path $root 'tools/usb/DuckyPolicyEntry.cs')+',Sentinel.LegacySource.Current'))
# Read a fixed published historical source as data only. Its protected receipt
# hash must still match before any task action receives an authenticated label.
$historical=Join-Path $root 'artifacts/LegacyDuckyEntry-d0c3349.cs'
$info=[Diagnostics.ProcessStartInfo]::new('git','show d0c3349:tools/usb/DuckyPolicyEntry.cs');$info.WorkingDirectory=$root;$info.UseShellExecute=$false;$info.RedirectStandardOutput=$true;$info.RedirectStandardError=$true;$info.CreateNoWindow=$true
$process=[Diagnostics.Process]::Start($info)
try{$bytes=[IO.MemoryStream]::new();$process.StandardOutput.BaseStream.CopyTo($bytes);$errorText=$process.StandardError.ReadToEnd();$process.WaitForExit();if($process.ExitCode -eq 0){[IO.File]::WriteAllBytes($historical,$bytes.ToArray());$arguments+=('/resource:'+$historical+',Sentinel.LegacySource.Historical')}}finally{$process.Dispose();if($bytes){$bytes.Dispose()}}
$arguments+=@('tools/usb/tests/UsbLegacyEvidenceSurvey.cs','tools/usb/DuckyPolicyJournal.cs','apps/desktop/DuckyPolicyEnrollment.cs')|ForEach-Object{Join-Path $root $_}
& (Join-Path $framework 'csc.exe') $arguments
if($LASTEXITCODE -ne 0){throw 'Native legacy evidence survey build failed'}
$pure=Join-Path $root 'artifacts/Sentinel.UsbLegacyEvidenceSurveyPureTest.exe'
$pureArguments=@('/target:exe','/main:UsbLegacyEvidenceSurveyPureTest',('/out:'+$pure))
$pureArguments+=@($arguments|Where-Object{$_ -notlike '/target:*' -and $_ -notlike '/main:*' -and $_ -notlike '/out:*' -and $_ -notlike '/win32manifest:*'})
& (Join-Path $framework 'csc.exe') $pureArguments
if($LASTEXITCODE -ne 0){throw 'Legacy evidence parser test build failed'}
& $pure
if($LASTEXITCODE -ne 0){throw 'Legacy evidence parser regression failed'}
Write-Output 'Built read-only native legacy evidence survey; no survey, task or device action executed'
