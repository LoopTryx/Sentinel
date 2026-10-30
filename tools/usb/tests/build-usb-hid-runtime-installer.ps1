$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'build-usb-hid-admission-backend.ps1') -ReviewedLiveLinked
$template=[IO.File]::ReadAllText((Join-Path $root 'tools/install-usb-exact-block-runtime.ps1'))
$start=$template.IndexOf("using System;")
$finish=$template.IndexOf("'@",$start)
if($start -lt 0 -or $finish -le $start){throw 'Reviewed installer source shape changed'}
$installer=$template.Substring($start,$finish-$start)
$installer=$installer.Replace('SentinelExactRuntimeInstaller','SentinelHidRuntimeInstaller').Replace('UsbExactBlockCapability','UsbHidAdmissionCapability').Replace('new UsbExactBlockFileStore(state)','new SentinelHidAdmission.UsbExactBlockFileStore(state)').Replace('committed.Blocked.Length==0','!committed.Active')
$installer=$installer.Replace('Sentinel-UsbExact-Recover-','Sentinel-HidAdmission-Recover-').Replace('exact-recovery-','hid-admission-recovery-').Replace('exact-worker.manifest','hid-admission-worker.manifest').Replace('SNTEXW01','SNTHIW01')
$installer=$installer.Replace('public static void Install(string source,bool upgradeReleasedRuntime){','public static int Main(string[] args){if(args.Length!=1)return 2;try{Install(args[0],false);SentinelHidAdmission.UsbHidAdmissionBackendCompiler.InstallPrivateFixture();return 0;}catch(Exception error){Console.WriteLine(error.GetType().Name+" "+error.HResult.ToString("X8")+" "+error.Message);return 1;}}'+"`r`n"+' public static void Install(string source,bool upgradeReleasedRuntime){')
$installer=$installer.Replace('Exact USB runtime','Linked USB runtime').Replace('exact USB runtime','linked USB runtime')
$generated=Join-Path $out 'UsbHidRuntimeInstaller.generated.cs'
[IO.File]::WriteAllText($generated,$installer)
$sources+=Join-Path $root 'apps/desktop/UsbHidAdmissionCapability.cs'
$target=Join-Path $out 'Sentinel.HidRuntimeInstaller.exe'
& $csc @options /main:SentinelHidRuntimeInstaller ('/out:'+$target) ('/resource:'+$compiler+',Sentinel.HidAdmission.Compiler') $sources $generated
if($LASTEXITCODE -ne 0){throw 'Linked HID code-only runtime installer compilation failed'}
Write-Output ('Built '+$target+'; code-only install requires explicit elevation; no installation executed')
