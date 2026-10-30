param([Parameter(Mandatory=$true)][string]$PackagePath,[string]$OutputDirectory,[ValidatePattern('^v(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$')][string]$Version='v1.0.0')
$ErrorActionPreference='Stop'
$repo=Split-Path -Parent $PSScriptRoot
$package=(Resolve-Path -LiteralPath $PackagePath).Path
if(-not $OutputDirectory){$OutputDirectory=Join-Path $repo ('artifacts\'+$Version+'-release')}
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$identity=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'release-extension-key.json') -Raw | ConvertFrom-Json
$manifestPath=Join-Path $package 'apps\extension\dist\manifest.json'
$manifest=Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$manifest | Add-Member -NotePropertyName key -NotePropertyValue $identity.key -Force
$manifest | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $manifestPath -Encoding UTF8
. (Join-Path $PSScriptRoot 'extension-identity.ps1')
$derivedId=Get-SentinelExtensionIdentity $manifestPath
if($derivedId -ne $identity.extensionId){throw 'Pinned release identity does not match its public key.'}
@{extensionId=$derivedId} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $package 'release-extension.json') -Encoding UTF8
[IO.File]::WriteAllText((Join-Path $package 'release-version.txt'),$Version,[Text.UTF8Encoding]::new($false))
$hashFile=Join-Path $package 'manifest-sha256.json'
$hashes=Get-ChildItem -LiteralPath $package -Recurse -File | Where-Object {$_.FullName -ne $hashFile} | ForEach-Object {[pscustomobject]@{path=$_.FullName.Substring($package.Length+1);sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()}}
$hashes | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath $hashFile -Encoding UTF8
$payload=Join-Path $OutputDirectory ('Sentinel-'+$Version+'-Windows-x64.zip')
if(Test-Path -LiteralPath $payload){throw 'Release archive already exists; choose a fresh output directory.'}
Add-Type -AssemblyName System.IO.Compression.FileSystem
[IO.Compression.ZipFile]::CreateFromDirectory($package,$payload,[IO.Compression.CompressionLevel]::Optimal,$false)
$compiler=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$installer=Join-Path $OutputDirectory ('Sentinel-'+$Version+'-Setup.exe')
if($Version -match '^v(?:0|[1-9][0-9]*)\.'){
 & (Join-Path $PSScriptRoot 'build-single-installer.ps1') -PayloadPath $payload -InstallerPath $installer -Version $Version
 return
}
$sources=@('ReleaseInstaller.cs','InstallerPayload.cs','InstallerWizard.cs','InstallerGlass.cs','HelloStartup.cs')|ForEach-Object{Join-Path $repo ('apps/desktop/'+$_)}
$framework=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319'
$wpfReferences=@('WindowsBase.dll','PresentationCore.dll','PresentationFramework.dll')|ForEach-Object{'/reference:'+(Join-Path $framework ('WPF/'+$_))}
& $compiler /nologo /target:winexe /platform:x64 ('/win32icon:'+(Join-Path $repo 'apps/desktop/assets/sentinel.ico')) ('/out:'+$installer) ('/resource:'+$payload+',Sentinel.Payload.zip') ('/resource:'+(Join-Path $package 'release-version.txt')+',Sentinel.Version.txt') @wpfReferences /reference:System.Xaml.dll /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Runtime.WindowsRuntime.dll /reference:System.Web.Extensions.dll /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll @sources
if($LASTEXITCODE -ne 0){throw 'Release installer compilation failed.'}
Write-Output $installer
