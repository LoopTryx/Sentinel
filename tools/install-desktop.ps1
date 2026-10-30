param([string]$ExtensionId,[string]$Destination,[switch]$TestInstall)
$ErrorActionPreference='Stop'
$source=Split-Path -Parent $PSScriptRoot
if(!$TestInstall){$null=& (Join-Path $PSScriptRoot 'install-prerequisites.ps1')}
if($TestInstall -and (-not $Destination -or (Test-Path -LiteralPath $Destination))){throw 'Test install requires a new destination.'}
if(-not $Destination){$Destination=Join-Path $env:LOCALAPPDATA 'Sentinel\Desktop'}
if(-not(Test-Path -LiteralPath (Join-Path $source 'Sentinel.exe'))){throw 'Run setup from the complete Sentinel app package.'}
# Derive Chrome's identity from the shipped public key, never from profile names.
. (Join-Path $PSScriptRoot 'extension-identity.ps1')
$packagedId=Get-SentinelExtensionIdentity (Join-Path $source 'apps/extension/dist/manifest.json')
$releaseMetadata=Join-Path $source 'release-extension.json'
if(Test-Path -LiteralPath $releaseMetadata){$release=Get-Content -LiteralPath $releaseMetadata -Raw | ConvertFrom-Json;if($release.extensionId -ne $packagedId){throw 'Release metadata does not match the packaged extension public key.'}}
if($ExtensionId -and $ExtensionId -ne $packagedId){throw 'The supplied extension identity does not match this package.'}
$ExtensionId=$packagedId
$targetExe=Join-Path $destination 'apps\desktop\console-build\Sentinel.Glass.exe'
foreach($process in @(Get-Process Sentinel.Glass -ErrorAction SilentlyContinue)){
 if($process.Path -eq $targetExe){throw 'Quit Sentinel from its tray menu before updating.'}
}
$destination=[IO.Path]::GetFullPath($destination).TrimEnd('\')
$sourceFull=[IO.Path]::GetFullPath($source).TrimEnd('\')
if($destination -eq $sourceFull -or $destination.StartsWith($sourceFull+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Install destination must be outside the package source.'}
$parent=Split-Path -Parent $destination
$stamp=[Guid]::NewGuid().ToString('N')
$staging=Join-Path $parent ('.sentinel-stage-'+$stamp)
$backup=Join-Path $parent ('Desktop-backup-'+$stamp)
$extensionDestination=if($TestInstall){Join-Path $destination 'ChromeExtension'}else{Join-Path $parent 'ChromeExtension'}
$extensionStage=Join-Path $parent ('.sentinel-extension-stage-'+$stamp)
$extensionBackup=Join-Path $parent ('ChromeExtension-backup-'+$stamp)
foreach($target in @($staging,$backup,$extensionStage,$extensionBackup)){
 if(-not [IO.Path]::GetFullPath($target).StartsWith($parent+'\',[StringComparison]::OrdinalIgnoreCase)-or(Test-Path -LiteralPath $target)){throw 'Invalid installation staging path.'}
}
New-Item -ItemType Directory -Path $staging -Force | Out-Null
foreach($entry in @(Get-ChildItem -LiteralPath $source)){Copy-Item -LiteralPath $entry.FullName -Destination $staging -Recurse -Force}
if(-not(Test-Path -LiteralPath (Join-Path $staging 'apps\desktop\console-build\Sentinel.Glass.exe'))){throw 'Staged app is incomplete.'}
$releaseInstall=Test-Path -LiteralPath $releaseMetadata
if($releaseInstall -and -not $TestInstall){
 New-Item -ItemType Directory -Path $extensionStage -Force | Out-Null
 foreach($entry in @(Get-ChildItem -LiteralPath (Join-Path $source 'apps\extension\dist'))){Copy-Item -LiteralPath $entry.FullName -Destination $extensionStage -Recurse -Force}
}
$appMoved=$false;$appInstalled=$false;$extensionMoved=$false;$extensionInstalled=$false
$key='HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.looptryx.sentinel'
$hadKey=Test-Path -LiteralPath $key
$oldRegistration=if($hadKey){(Get-Item -LiteralPath $key).GetValue('')}else{$null}
try{
 if(Test-Path -LiteralPath $destination){Move-Item -LiteralPath $destination -Destination $backup;$appMoved=$true}
 Move-Item -LiteralPath $staging -Destination $destination;$appInstalled=$true
 if($releaseInstall){
  if($TestInstall){New-Item -ItemType Directory -Path $extensionDestination -Force|Out-Null;foreach($entry in @(Get-ChildItem -LiteralPath (Join-Path $destination 'apps\extension\dist'))){Copy-Item -LiteralPath $entry.FullName -Destination $extensionDestination -Recurse -Force}}
  else{if(Test-Path -LiteralPath $extensionDestination){Move-Item -LiteralPath $extensionDestination -Destination $extensionBackup;$extensionMoved=$true};Move-Item -LiteralPath $extensionStage -Destination $extensionDestination;$extensionInstalled=$true}
 }
 if($ExtensionId){
  $hostDirectory=Join-Path $destination 'apps\desktop\console-build'
  $manifestPath=Join-Path $hostDirectory 'native-host.json'
  $manifest=@{name='com.looptryx.sentinel';description='Sentinel desktop connection';path=(Join-Path $hostDirectory 'Sentinel.NativeConnect.exe');type='stdio';allowed_origins=@('chrome-extension://'+$ExtensionId+'/')}
  [IO.File]::WriteAllText($manifestPath,($manifest | ConvertTo-Json -Depth 3),[Text.UTF8Encoding]::new($false))
  if(-not $TestInstall){New-Item -Path $key -Force|Out-Null;Set-Item -LiteralPath $key -Value $manifestPath}
 }
 if(-not $TestInstall){
  $shell=New-Object -ComObject WScript.Shell
  $shortcut=$shell.CreateShortcut((Join-Path ([Environment]::GetFolderPath('DesktopDirectory')) 'Sentinel.lnk'))
  $shortcut.TargetPath=Join-Path $destination 'Sentinel.exe';$shortcut.WorkingDirectory=$destination;$shortcut.Description='Open Sentinel';$shortcut.IconLocation=(Join-Path $destination 'Sentinel.exe')+',0';$shortcut.Save()
 }
}catch{
 if($extensionInstalled){Move-Item -LiteralPath $extensionDestination -Destination $extensionStage}
 if($extensionMoved){Move-Item -LiteralPath $extensionBackup -Destination $extensionDestination}
 if($appInstalled){Move-Item -LiteralPath $destination -Destination $staging}
 if($appMoved){Move-Item -LiteralPath $backup -Destination $destination}
 if(-not $TestInstall){if($hadKey){Set-Item -LiteralPath $key -Value $oldRegistration}else{if(Test-Path -LiteralPath $key){Remove-Item -LiteralPath $key}}}
 throw
}
if($TestInstall){Write-Output ('Test files installed: '+$destination);return}
Write-Output ('Installed Sentinel: '+(Join-Path $destination 'Sentinel.exe'))
if($ExtensionId){Write-Output 'Automatic Chrome connection registered. Reload the Sentinel extension once.'}else{Write-Output 'App installed. Install/load the extension, then rerun setup to register automatic connection.'}
