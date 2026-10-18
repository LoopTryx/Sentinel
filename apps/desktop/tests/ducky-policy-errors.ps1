$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$source=Join-Path $root 'artifacts/DuckyPolicyErrorsTest.cs'
@'
using System;
class VaultApproval{public static string ResolveExecutable(string path){return path;}}
class ErrorsTest{static int Main(){
 if(DuckyPolicyControl.Failure(45).IndexOf("connected",StringComparison.OrdinalIgnoreCase)<0)return 1;
 if(DuckyPolicyControl.Failure(44).IndexOf("refresh",StringComparison.OrdinalIgnoreCase)<0)return 2;
 if(DuckyPolicyControl.Failure(42).IndexOf("recovery",StringComparison.OrdinalIgnoreCase)<0)return 3;
 if(DuckyPolicyControl.Failure(43).IndexOf("rule",StringComparison.OrdinalIgnoreCase)<0)return 4;
 return 0;
}}
'@ | Set-Content -LiteralPath $source
$compiler=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
$out=Join-Path $root 'artifacts/DuckyPolicyErrorsTest.exe'
& $compiler /nologo /target:exe ('/out:'+$out) $source (Join-Path $root 'apps/desktop/DuckyPolicyControl.cs') (Join-Path $root 'apps/desktop/DuckyPolicyEnrollment.cs') (Join-Path $root 'apps/desktop/DuckyInputHealth.cs')
if($LASTEXITCODE -ne 0){throw 'Error contract compile failed'}
& $out
if($LASTEXITCODE -ne 0){throw 'Distinct preflight error contract failed'}
Write-Output 'Distinct preflight diagnostics PASS; no policy operation invoked'
