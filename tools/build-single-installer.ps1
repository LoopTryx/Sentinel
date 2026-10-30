param([Parameter(Mandatory=$true)][string]$PayloadPath,[Parameter(Mandatory=$true)][string]$InstallerPath,[string]$Version='v1.0.0')
$ErrorActionPreference='Stop'
if($Version -notmatch '^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$'){throw 'Expected a semantic release version, such as v1.0.0.'}
$repo=Split-Path -Parent $PSScriptRoot
$payload=(Resolve-Path -LiteralPath $PayloadPath).Path
$target=[IO.Path]::GetFullPath($InstallerPath)
if(Test-Path -LiteralPath $target){throw 'Choose a new installer output path.'}
if([IO.Path]::GetPathRoot($payload) -ne [IO.Path]::GetPathRoot($target)){throw 'Build output must be on the payload drive.'}
$work=Join-Path ([IO.Path]::GetDirectoryName($target)) ('single-build-'+[Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $work -Force|Out-Null
$sha=(Get-FileHash -LiteralPath $payload -Algorithm SHA256).Hash.ToLowerInvariant()
[IO.File]::WriteAllText((Join-Path $work 'payload.sha256'),$sha)
[IO.File]::WriteAllText((Join-Path $work 'version.txt'),$Version)
$numeric=$Version.Substring(1)+'.0'
[IO.File]::WriteAllText((Join-Path $work 'metadata.cs'),('using System.Reflection;[assembly:AssemblyVersion("'+$numeric+'")][assembly:AssemblyFileVersion("'+$numeric+'")][assembly:AssemblyProduct("Sentinel")][assembly:AssemblyTitle("Sentinel Setup")]'))
$stub=Join-Path $work 'Setup.stub.exe'
$compiler=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
$options=@('/nologo','/target:winexe','/platform:x64',('/out:'+$stub),('/win32icon:'+(Join-Path $repo 'apps/desktop/assets/sentinel.ico')),('/resource:'+(Join-Path $work 'payload.sha256')+',Sentinel.Payload.sha256'),('/resource:'+(Join-Path $work 'version.txt')+',Sentinel.Version.txt'),'/reference:System.Windows.Forms.dll','/reference:System.Drawing.dll','/reference:System.Web.Extensions.dll','/reference:System.IO.Compression.dll','/reference:System.IO.Compression.FileSystem.dll','/reference:System.Runtime.WindowsRuntime.dll')
$framework=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319'
$options+=@('WindowsBase.dll','PresentationCore.dll','PresentationFramework.dll')|ForEach-Object{'/reference:'+(Join-Path $framework ('WPF/'+$_))}
$options+='/reference:System.Xaml.dll'
$sources=@('ReleaseInstaller.cs','InstallerPayload.cs','InstallerWizard.cs','InstallerGlass.cs','HelloStartup.cs')|ForEach-Object{Join-Path $repo ('apps/desktop/'+$_)}
& $compiler @options @sources (Join-Path $work 'metadata.cs')
if($LASTEXITCODE -ne 0){throw 'Setup compilation failed; payload unchanged.'}
# Shift backwards in the existing build ZIP: no second 1.5 GB temporary copy.
# This consumes only the supplied build payload; never pass an owner data file.
$prefix=[IO.File]::ReadAllBytes($stub)
$file=[IO.File]::Open($payload,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
try{
 $length=$file.Length;$file.SetLength($length+$prefix.Length+16)
 $buffer=[byte[]]::new(8388608);$remaining=$length
 while($remaining -gt 0){$count=[int][Math]::Min($buffer.Length,$remaining);$offset=$remaining-$count;$file.Position=$offset;$read=0;while($read -lt $count){$n=$file.Read($buffer,$read,$count-$read);if($n -eq 0){throw 'Unexpected end of payload.'};$read+=$n};$file.Position=$offset+$prefix.Length;$file.Write($buffer,0,$count);$remaining=$offset}
 $file.Position=0;$file.Write($prefix,0,$prefix.Length)
 $file.Position=$prefix.Length+$length;$footer=[BitConverter]::GetBytes([long]$length);$file.Write($footer,0,8);$marker=[Text.Encoding]::ASCII.GetBytes('SNTLZIP6');$file.Write($marker,0,8);$file.Flush($true)
}finally{$file.Dispose()}
Move-Item -LiteralPath $payload -Destination $target
$process=Start-Process -FilePath $target -ArgumentList '--verify-only' -WindowStyle Hidden -PassThru -Wait
if($process.ExitCode -ne 0){throw 'Built installer failed payload verification.'}
Write-Output ('Single-file installer verified: '+$target)
