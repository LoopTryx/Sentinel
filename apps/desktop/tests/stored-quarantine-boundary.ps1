$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$framework=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319'
$target=Join-Path $root 'artifacts/Sentinel.StoredQuarantineBoundaryTest.exe'
& (Join-Path $framework 'csc.exe') /nologo /target:exe /platform:x64 /main:StoredQuarantineBoundaryTest ('/out:'+$target) ('/reference:'+(Join-Path $framework 'System.Web.Extensions.dll')) ('/reference:'+(Join-Path $framework 'System.Xaml.dll')) ('/reference:'+(Join-Path $framework 'WPF/PresentationFramework.dll')) ('/reference:'+(Join-Path $framework 'WPF/PresentationCore.dll')) ('/reference:'+(Join-Path $framework 'WPF/WindowsBase.dll')) (Join-Path $root 'apps/desktop/StoredQuarantine.cs') (Join-Path $PSScriptRoot 'StoredQuarantineBoundaryTest.cs')
if($LASTEXITCODE -ne 0){throw 'Stored quarantine boundary build failed'}
& $target
if($LASTEXITCODE -ne 0){throw 'Stored quarantine boundary failed'}
