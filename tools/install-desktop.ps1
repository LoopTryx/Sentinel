param([string]$ExtensionId,[string]$Destination,[switch]$TestInstall)
$ErrorActionPreference='Stop'
$source=Split-Path -Parent $PSScriptRoot
if($TestInstall -and (-not $Destination -or (Test-Path -LiteralPath $Destination))){throw 'Test install requires a new destination.'}
if(-not $Destination){$Destination=Join-Path $env:LOCALAPPDATA 'Sentinel\Desktop'}
if(-not(Test-Path -LiteralPath (Join-Path $source 'Sentinel.exe'))){throw 'Run setup from the complete Sentinel app package.'}
$releaseMetadata=Join-Path $source 'release-extension.json'
if(Test-Path -LiteralPath $releaseMetadata){$release=Get-Content -LiteralPath $releaseMetadata -Raw | ConvertFrom-Json;if($release.extensionId -notmatch '^[a-p]{32}$'){throw 'Invalid release extension identity.'};if($ExtensionId -and $ExtensionId -ne $release.extensionId){throw 'Extension ID differs from this release.'};$ExtensionId=$release.extensionId}
if(-not $ExtensionId){
 $chromeRoot=Join-Path $env:LOCALAPPDATA 'Google\Chrome\User Data'
 $ids=@()
 if(Test-Path -LiteralPath $chromeRoot){
  foreach($profile in @(Get-ChildItem -LiteralPath $chromeRoot -Directory | Where-Object {$_.Name -eq 'Default' -or $_.Name -match '^Profile \d+$'} | Select-Object -First 16)){
   foreach($name in @('Preferences','Secure Preferences')){
    $file=Join-Path $profile.FullName $name
    if(-not(Test-Path -LiteralPath $file) -or (Get-Item -LiteralPath $file).Length -gt 16777216){continue}
    try{$preferences=Get-Content -LiteralPath $file -Raw | ConvertFrom-Json;foreach($entry in $preferences.extensions.settings.PSObject.Properties){
     $sentinel=$entry.Value.manifest.name -eq 'Sentinel Browser Companion'
     $extensionPath=[string]$entry.Value.path
     if(-not $sentinel -and $extensionPath.StartsWith($env:USERPROFILE+'\',[StringComparison]::OrdinalIgnoreCase)){
      $installedManifest=Join-Path $extensionPath 'manifest.json'
      if((Test-Path -LiteralPath $installedManifest) -and (Get-Item -LiteralPath $installedManifest).Length -lt 65536){try{$sentinel=(Get-Content -LiteralPath $installedManifest -Raw | ConvertFrom-Json).name -eq 'Sentinel Browser Companion'}catch{}}
     }
     if($entry.Name -match '^[a-p]{32}$' -and $sentinel){$ids+=$entry.Name}
    }}catch{}
   }
  }
 }
 $ids=@($ids | Select-Object -Unique)
 if($ids.Count -eq 1){$ExtensionId=$ids[0]}
 elseif($ids.Count -gt 1){throw 'Multiple Sentinel extensions found. Run setup with -ExtensionId and the ID shown by Chrome.'}
}
if($ExtensionId -and $ExtensionId -notmatch '^[a-p]{32}$'){throw 'Invalid extension ID.'}
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
  $shortcut.TargetPath=Join-Path $destination 'Sentinel.exe';$shortcut.WorkingDirectory=$destination;$shortcut.Description='Open Sentinel';$shortcut.Save()
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
if($ExtensionId){Write-Output 'Chrome native connection registered for the detected Sentinel extension. Reload the updated extension once.'}else{Write-Output 'App installed. Install/load the extension, then rerun setup to register automatic connection.'}
