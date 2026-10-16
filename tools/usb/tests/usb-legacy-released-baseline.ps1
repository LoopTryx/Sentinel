param([switch]$BuildOnly)
$ErrorActionPreference='Stop'
$root=Split-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) -Parent
$baselineSource=Get-Content (Join-Path $root 'tools/usb/UsbLegacyReleasedBaseline.cs') -Raw
$leaseCheck=[regex]::Match($baselineSource,'internal void Check\(\)\{(?<body>.*?)\r?\n  public void Dispose', [Text.RegularExpressions.RegexOptions]::Singleline).Groups['body'].Value
if(!$leaseCheck -or $leaseCheck.Contains('KnownWriters')){throw 'Automatic recovery must not depend on unrelated process names'}
if(([regex]::Matches($baselineSource,'Require\(KnownWriters\(\)==0\)')).Count -ne 1 -or !$baselineSource.Contains('SNTLEG02')){throw 'Retirement proof must remain initial-capture-only and version bound'}
$framework=Join-Path $env:windir 'Microsoft.NET/Framework64/v4.0.30319'
$sources=@('tools/usb/UsbLegacyReleasedBaseline.cs','tools/usb/tests/UsbLegacyReleasedBaselineTest.cs','tools/usb/DuckyPolicyJournal.cs','apps/desktop/DuckyPolicyEnrollment.cs')|ForEach-Object{Join-Path $root $_}
$target=Join-Path $root 'artifacts/Sentinel.LegacyBaselineTest.exe'
& (Join-Path $framework 'csc.exe') /nologo /target:exe /platform:x64 /main:UsbLegacyReleasedBaselineTest /reference:Microsoft.CSharp.dll /reference:System.Web.Extensions.dll ('/out:'+$target) $sources
if($LASTEXITCODE -ne 0){throw 'Legacy baseline test compilation failed'}
if($BuildOnly){return}
& $target
if($LASTEXITCODE -ne 0){throw 'Legacy baseline regression failed'}
