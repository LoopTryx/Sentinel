param([string]$ExtensionId)
$ErrorActionPreference='Stop'
$source=Split-Path -Parent $PSScriptRoot
$destination=Join-Path $env:LOCALAPPDATA 'Sentinel\Desktop'
if(-not(Test-Path -LiteralPath (Join-Path $source 'Sentinel.exe'))){throw 'Run setup from the complete Sentinel app package.'}
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
New-Item -ItemType Directory -Path $destination -Force | Out-Null
if([IO.Path]::GetFullPath($source).TrimEnd('\') -ne [IO.Path]::GetFullPath($destination).TrimEnd('\')){
 foreach($entry in @(Get-ChildItem -LiteralPath $source)){Copy-Item -LiteralPath $entry.FullName -Destination $destination -Recurse -Force}
}
if($ExtensionId){
 $hostDirectory=Join-Path $destination 'apps\desktop\console-build'
 $manifestPath=Join-Path $hostDirectory 'native-host.json'
 $manifest=@{name='com.looptryx.sentinel';description='Sentinel desktop connection';path=(Join-Path $hostDirectory 'Sentinel.NativeConnect.exe');type='stdio';allowed_origins=@('chrome-extension://'+$ExtensionId+'/')}
 [IO.File]::WriteAllText($manifestPath,($manifest | ConvertTo-Json -Depth 3),[Text.UTF8Encoding]::new($false))
 $key='HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.looptryx.sentinel'
 New-Item -Path $key -Force | Out-Null
 Set-Item -LiteralPath $key -Value $manifestPath
}
$shell=New-Object -ComObject WScript.Shell
$shortcut=$shell.CreateShortcut((Join-Path ([Environment]::GetFolderPath('DesktopDirectory')) 'Sentinel.lnk'))
$shortcut.TargetPath=Join-Path $destination 'Sentinel.exe';$shortcut.WorkingDirectory=$destination;$shortcut.Description='Open Sentinel';$shortcut.Save()
Write-Output ('Installed Sentinel: '+(Join-Path $destination 'Sentinel.exe'))
if($ExtensionId){Write-Output 'Chrome native connection registered for the detected Sentinel extension. Reload the updated extension once.'}else{Write-Output 'App installed. Install/load the extension, then rerun setup to register automatic connection.'}
