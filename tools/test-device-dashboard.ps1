param([switch]$NativeAcceptance)
$ErrorActionPreference='Stop'
$repo=Split-Path -Parent $PSScriptRoot
$compiler=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
$folder=Join-Path $repo 'artifacts/device-dashboard-tests'
New-Item -ItemType Directory -Path $folder -Force | Out-Null
$policy=Join-Path $folder 'Policy.exe'
& $compiler /nologo /platform:x64 ('/out:'+$policy) (Join-Path $repo 'apps/desktop/NativeScanPolicy.cs') (Join-Path $repo 'apps/desktop/tests/NativeSecurityPolicyTest.cs')
if($LASTEXITCODE -ne 0){throw 'Scan policy test build failed.'}
& $policy
if($LASTEXITCODE -ne 0){throw 'Scan policy test failed.'}
if($NativeAcceptance){
 $test=Join-Path $folder 'DashboardAcceptance.exe'
 $sources=@('apps/desktop/DeviceHealth.cs','apps/desktop/NativeScanPolicy.cs','apps/desktop/NativeScanLease.cs','apps/desktop/WindowsEngineTrust.cs','apps/desktop/NativeSecurity.cs','apps/desktop/tests/DashboardAcceptance.cs') | ForEach-Object {Join-Path $repo $_}
 Copy-Item -LiteralPath (Join-Path $repo 'apps/desktop/console-build/sentinel-sweep.exe') -Destination $folder -Force
 $pin=Join-Path $repo 'apps/desktop/console-build/sentinel-sweep.sha256'
 & $compiler /nologo /platform:x64 /reference:System.Management.dll /reference:System.Windows.Forms.dll /reference:System.Web.Extensions.dll ('/resource:'+$pin+',Sentinel.Scan.sha256') ('/out:'+$test) $sources
 if($LASTEXITCODE -ne 0){throw 'Native acceptance build failed.'}
 Push-Location $repo
 try{& $test;if($LASTEXITCODE -ne 0){throw 'Native acceptance failed.'}}finally{Pop-Location}
}
