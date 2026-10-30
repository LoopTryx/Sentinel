$ErrorActionPreference='Stop'
$repo=Split-Path -Parent $PSScriptRoot
$output=Join-Path $repo 'apps/desktop/console-build'
$compiler=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
$sources=@('NativeProtectionRuntime.cs','NativeProtectionCoordinator.cs','NativeScanPolicy.cs','NativeScanLease.cs','tests/ProtectionAcceptance.cs')|ForEach-Object{Join-Path $repo ('apps/desktop/'+$_)}
& $compiler /nologo /platform:x64 /define:SENTINEL_PROTECTION_QUALIFICATION /reference:System.Web.Extensions.dll /reference:System.Security.dll ('/resource:'+(Join-Path $output 'signature-runtime.manifest')+',Sentinel.Signatures.Manifest') ('/out:'+(Join-Path $output 'ProtectionAcceptance.exe')) $sources
if($LASTEXITCODE -ne 0){throw 'Qualification build failed'}
& (Join-Path $output 'ProtectionAcceptance.exe') 2>&1 | Tee-Object -FilePath (Join-Path $repo 'artifacts/persistent-native-acceptance.log')
if($LASTEXITCODE -ne 0){throw 'Protection qualification failed'}
