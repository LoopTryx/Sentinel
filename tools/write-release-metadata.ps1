param([Parameter(Mandatory=$true)][string]$OutputPath)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$version=(Get-Content -LiteralPath (Join-Path $root 'version.json') -Raw|ConvertFrom-Json).version
if($version -notmatch '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$'){throw 'Invalid release version'}
foreach($part in $version.Split('.')){if([long]$part -gt 65534){throw 'Version exceeds Windows assembly limits'}}
$source='using System.Reflection;[assembly:AssemblyVersion("'+$version+'.0")][assembly:AssemblyFileVersion("'+$version+'.0")][assembly:AssemblyProduct("Sentinel")][assembly:AssemblyTitle("Sentinel")][assembly:AssemblyInformationalVersion("'+$version+'")]'
[IO.File]::WriteAllText([IO.Path]::GetFullPath($OutputPath),$source,[Text.UTF8Encoding]::new($false))
