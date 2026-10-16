param([Parameter(Mandatory=$true)][string]$PackagePath,[string]$OutputDirectory)
$ErrorActionPreference='Stop'
$repo=Split-Path -Parent $PSScriptRoot
$package=(Resolve-Path -LiteralPath $PackagePath).Path
if(-not $OutputDirectory){$OutputDirectory=Join-Path $repo 'artifacts\v2-release'}
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$identity=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'release-extension-key.json') -Raw | ConvertFrom-Json
$manifestPath=Join-Path $package 'apps\extension\dist\manifest.json'
$manifest=Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$manifest | Add-Member -NotePropertyName key -NotePropertyValue $identity.key -Force
$manifest | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $manifestPath -Encoding UTF8
@{extensionId=$identity.extensionId} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $package 'release-extension.json') -Encoding UTF8
$hashFile=Join-Path $package 'manifest-sha256.json'
$hashes=Get-ChildItem -LiteralPath $package -Recurse -File | Where-Object {$_.FullName -ne $hashFile} | ForEach-Object {[pscustomobject]@{path=$_.FullName.Substring($package.Length+1);sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()}}
$hashes | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath $hashFile -Encoding UTF8
$payload=Join-Path $OutputDirectory 'Sentinel-v2-Windows-x64.zip'
if(Test-Path -LiteralPath $payload){throw 'Release archive already exists; choose a fresh output directory.'}
Add-Type -AssemblyName System.IO.Compression.FileSystem
[IO.Compression.ZipFile]::CreateFromDirectory($package,$payload,[IO.Compression.CompressionLevel]::Optimal,$false)
$compiler=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$installer=Join-Path $OutputDirectory 'Sentinel-v2-Setup.exe'
& $compiler /nologo /target:winexe /platform:x64 ('/out:'+$installer) ('/resource:'+$payload+',Sentinel.Payload.zip') /reference:System.Windows.Forms.dll /reference:System.Web.Extensions.dll /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll (Join-Path $repo 'apps\desktop\ReleaseInstaller.cs')
if($LASTEXITCODE -ne 0){throw 'Release installer compilation failed.'}
Write-Output $installer
