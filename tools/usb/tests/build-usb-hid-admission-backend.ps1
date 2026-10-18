param([switch]$UseExistingWorker,[switch]$FixtureV2)
$ErrorActionPreference='Stop'
# UseExistingWorker retains its immutable image. Runtime manifest/path authentication must still match the selected fixture.
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$out=Join-Path $root 'artifacts/hid-admission-backend'
[IO.Directory]::CreateDirectory($out)|Out-Null
& (Join-Path $PSScriptRoot 'build-usb-hid-admission-kernel.ps1') -GenerateOnly|Out-Null
function One([string]$s,[string]$a,[string]$b){if(([regex]::Matches($s,[regex]::Escape($a))).Count -ne 1){throw "Backend source shape changed: $a"};return $s.Replace($a,$b)}
function Generate([string]$file,[string]$declaration){
 $s=[IO.File]::ReadAllText((Join-Path $root ('tools/usb/'+$file+'.cs')))
 $s=One $s $declaration ('namespace SentinelHidAdmission { using UsbExactBlockState=global::UsbHidAdmissionPolicy; using UsbExactBlockGpo=global::UsbHidAdmissionGpo; '+$declaration)
 $s=$s.Replace('SENTINEL_USB_EXACT_PRIVATE_QUALIFICATION','SENTINEL_USB_HID_ADMISSION_PRIVATE_QUALIFICATION').Replace('SENTINEL_USB_EXACT_LIVE_REVIEWED','SENTINEL_USB_HID_ADMISSION_LIVE_REVIEWED')
 $s=$s.Replace('SentinelUsbExactQualification','SentinelHidAdmissionBackendQualification').Replace('SentinelUsbExact"','SentinelHidAdmission"').Replace('Sentinel-UsbExactPrivate-Recover-','Sentinel-HidAdmissionPrivate-Recover-').Replace('Sentinel-UsbExact-Recover-','Sentinel-HidAdmission-Recover-').Replace('SentinelUsbExactJob-','SentinelHidAdmissionJob-').Replace('exact-recovery-','hid-admission-recovery-').Replace('exact-worker.manifest','hid-admission-worker.manifest').Replace('SNTEXW01','SNTHIW01').Replace('ExactBlockQualification','HidAdmissionQualification')
 if($file -eq 'UsbExactBlockBackend'){
  $s=One $s 'gpupdate.exe"),"/target:computer /force /wait:30"' 'gpupdate.exe"),"/target:computer /force /wait:0"'
  $s=One $s 'Refresh();fence();provider.VerifyEffective(desired);provider.FinalizeSaved(before,candidate,desired);Refresh();fence();provider.Verify(desired);' 'Refresh();provider.WaitEffective(before,candidate,desired);provider.FinalizeSaved(before,candidate,desired);Refresh();provider.WaitEffective(before,candidate,desired);fence();provider.Verify(desired);'
  $s=One $s 'Require(process.WaitForExit(35000));output.Finish();error.Finish();Require(process.ExitCode==0);' 'if(!process.WaitForExit(35000))throw new TimeoutException("Admission gpupdate exceeded 35000ms");output.Finish();error.Finish();if(process.ExitCode!=0)throw new InvalidOperationException("Admission gpupdate exit "+process.ExitCode);'
  $s=One $s 'throw new InvalidOperationException("Exact suspended child create failed")' 'throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error(),"Admission suspended child create failed")'
  $s=One $s 'throw new InvalidOperationException("Exact suspended child assignment failed")' 'throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error(),"Admission suspended child assignment failed")'
  $s=One $s 'throw new InvalidOperationException("Exact suspended child resume failed")' 'throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error(),"Admission suspended child resume failed")'
  $s=One $s 'uint result;if(!GetExitCodeProcess(child.Process,out result)||result!=0)throw new InvalidOperationException("Exact producer failed");' 'uint result;if(!GetExitCodeProcess(child.Process,out result))throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error(),"Admission child exit query failed");if(result!=0)throw new InvalidOperationException("Admission producer exit "+result);'
  $s=One $s 'static UsbExactBlockGpo.Image Image(UsbExactBlockState.Snapshot state){return state==null?UsbExactBlockGpo.Empty():UsbExactBlockGpo.Desired(state.Generation,state.Digest,state.Blocked);}' 'static UsbExactBlockGpo.Image Image(UsbExactBlockState.Snapshot state){return state==null||!state.Active?UsbExactBlockGpo.Empty():UsbExactBlockGpo.Desired(state,UsbHidAdmissionBackendCompiler.Compile(state));}'
  $s=$s.Replace('provider.Managed(Image(expected))','Image(expected)').Replace('provider.Managed(Image(request.Before))','Image(request.Before)').Replace('provider.Managed(Image(request.After))','Image(request.After)')
 }
 if($FixtureV2){$s=$s.Replace('SentinelHidAdmissionBackendQualification"','SentinelHidAdmissionBackendQualificationV2"')}
 $path=Join-Path $out ($file+'.generated.cs');[IO.File]::WriteAllText($path,$s+"`r`n}`r`n");return $path
}
$backend=Generate 'UsbExactBlockBackend' 'internal sealed class UsbExactBlockBackend:'
$tasks=Generate 'UsbExactBlockRecoveryTasks' 'internal sealed class UsbExactBlockRecoveryTasks:'
$workerSource=Generate 'UsbExactBlockWorker' 'internal static class UsbExactBlockWorker {'
$compiler=Join-Path $root 'target/debug/sentinel-usb-policy-plan.exe'
if(!(Test-Path -LiteralPath $compiler)){throw 'Build actual Rust sentinel-usb-policy-plan before backend compilation'}
$compilerHash=(Get-FileHash -LiteralPath $compiler -Algorithm SHA256).Hash.ToLowerInvariant()
$compilerSource=Join-Path $out 'UsbHidAdmissionBackendCompiler.generated.cs'
$text=[IO.File]::ReadAllText((Join-Path $root 'tools/usb/UsbHidAdmissionBackendCompiler.cs'))
$text=One $text '@COMPILER_SHA256@' $compilerHash
[IO.File]::WriteAllText($compilerSource,$text)
$sources=@($backend,$tasks,$compilerSource,(Join-Path $root 'artifacts/hid-admission-kernel/UsbHidAdmissionTransaction.generated.cs'),(Join-Path $root 'artifacts/hid-admission-kernel/UsbHidAdmissionFileStore.generated.cs'))
$sources+=@('UsbHidAdmissionPolicy.cs','UsbExactBlockState.cs','UsbHidAdmissionGpo.cs','UsbSavedAdmissionEntry.cs','DuckyPolicyJournal.cs','DuckyLocalGpo.cs','DuckyWorkerJob.cs')|ForEach-Object{Join-Path $root ('tools/usb/'+$_)}
$csc=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
$worker=Join-Path $out 'Sentinel.HidAdmissionWorker.Private.exe'
$options=@('/nologo','/target:exe','/platform:x64','/reference:Microsoft.CSharp.dll','/define:SENTINEL_USB_HID_ADMISSION_PRIVATE_QUALIFICATION')
if(!$UseExistingWorker){& $csc @options /main:SentinelHidAdmission.UsbExactBlockWorker ('/out:'+$worker) $sources $workerSource;if($LASTEXITCODE -ne 0){throw 'Admission private worker build failed'}}
if(!(Test-Path -LiteralPath $worker)){throw 'Pinned existing private worker unavailable'}
$qualification=Join-Path $root 'tools/usb/UsbHidAdmissionBackendQualification.cs'
$target=Join-Path $out 'Sentinel.HidAdmissionBackendQualification.exe'
& $csc @options /main:SentinelHidAdmission.UsbHidAdmissionBackendQualification ('/out:'+$target) ('/resource:'+$worker+',Sentinel.HidAdmission.Worker') ('/resource:'+$compiler+',Sentinel.HidAdmission.Compiler') $sources $qualification
if($LASTEXITCODE -ne 0){throw 'Admission private backend qualification build failed'}
Write-Output ('Built private admission worker and qualification: '+$target+'; no installation, tasks, policy or device changes')
