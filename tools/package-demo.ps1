param([string]$NodeLicensePath,[switch]$IncludeLegacyClamAV)
$ErrorActionPreference='Stop'
$repo=Split-Path -Parent $PSScriptRoot
$inspectionEngine=Join-Path $repo 'apps\desktop\console-build\sentinel-inspect.exe'
$inspectionReceipt=Join-Path $repo 'apps\desktop\console-build\inspection-engine.json'
if(-not(Test-Path -LiteralPath $inspectionEngine -PathType Leaf) -or -not(Test-Path -LiteralPath $inspectionReceipt -PathType Leaf)){throw 'Stage and verify the native inspection engine before packaging.'}
$engineReceipt=Get-Content -LiteralPath $inspectionReceipt -Raw | ConvertFrom-Json
if($engineReceipt.executable -ne 'sentinel-inspect.exe' -or $engineReceipt.sha256 -ne (Get-FileHash -LiteralPath $inspectionEngine -Algorithm SHA256).Hash.ToLowerInvariant()){throw 'Staged inspection engine differs from its build receipt.'}
if(-not $NodeLicensePath){$NodeLicensePath=Join-Path $repo '.local-handoff\NODE-LICENSE.txt'}
$nodeLicense=(Resolve-Path -LiteralPath $NodeLicensePath).Path
foreach($required in @('apps\ui\dist\index.html','apps\extension\dist\manifest.json','apps\desktop\console-build\Sentinel.Glass.exe','apps\desktop\console-build\Microsoft.Web.WebView2.Core.dll','apps\desktop\console-build\Microsoft.Web.WebView2.Wpf.dll','apps\desktop\console-build\WebView2Loader.dll')){
 if(-not(Test-Path -LiteralPath (Join-Path $repo $required) -PathType Leaf)){throw ('Build prerequisite missing: '+$required)}
}
$stage=Join-Path $repo ('artifacts\Sentinel-Demo-'+[DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $stage -Force | Out-Null
function Copy-DemoFile([string]$Source,[string]$Relative){
 $destination=Join-Path $stage $Relative
 New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
 Copy-Item -LiteralPath $Source -Destination $destination
}
foreach($entry in @('apps\ui\dist','apps\extension\dist','apps\demo-runtime')){
 $destination=Join-Path $stage $entry
 New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
 Copy-Item -LiteralPath (Join-Path $repo $entry) -Destination $destination -Recurse
}
foreach($file in Get-ChildItem -LiteralPath (Join-Path $repo 'apps\desktop\console-build') -File){
 if($file.Extension -in @('.exe','.dll')){Copy-DemoFile $file.FullName ('apps\desktop\console-build\'+$file.Name)}
}
Copy-DemoFile $inspectionReceipt 'apps\desktop\console-build\inspection-engine.json'
if($IncludeLegacyClamAV){
$clam=Join-Path $repo '.local-handoff\clamav-1.5.4\portable\clamav-1.5.4.win.x64'
New-Item -ItemType Directory -Path (Join-Path $stage '.local-handoff\clamav-1.5.4\portable\clamav-1.5.4.win.x64') -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $clam 'certs') -Destination (Join-Path $stage '.local-handoff\clamav-1.5.4\portable\clamav-1.5.4.win.x64\certs') -Recurse
foreach($file in Get-ChildItem -LiteralPath $clam -File){
 if($file.Extension -eq '.dll' -or $file.Name -in @('clamscan.exe','COPYING')){Copy-DemoFile $file.FullName ('.local-handoff\clamav-1.5.4\portable\clamav-1.5.4.win.x64\'+$file.Name)}
}
Copy-DemoFile (Join-Path $repo '.local-handoff\clamav-1.5.4\databases\daily.cvd') '.local-handoff\clamav-1.5.4\databases\daily.cvd'
}
Copy-DemoFile (Join-Path $repo 'tools\launch-demo.ps1') 'tools\launch-demo.ps1'
Copy-DemoFile (Join-Path $repo 'tools\install-desktop.ps1') 'tools\install-desktop.ps1'
Copy-DemoFile (Join-Path $repo 'apps\desktop\console-build\Sentinel.exe') 'Sentinel.exe'
Copy-DemoFile (Join-Path $repo 'apps\desktop\console-build\Setup.exe') 'Setup.exe'
Copy-DemoFile (Join-Path $repo 'apps\desktop\console-build\Sentinel.NativeConnect.exe') 'apps\desktop\console-build\Sentinel.NativeConnect.exe'
Copy-DemoFile (Join-Path $repo 'tools\usb\read-inventory.ps1') 'tools\usb\read-inventory.ps1'
foreach($labFile in @('README.md','duck-code.py','test-guard.ps1')){
 Copy-DemoFile (Join-Path $repo ('tools\usb\lab\'+$labFile)) ('tools\usb\lab\'+$labFile)
}
Copy-DemoFile (Join-Path $repo 'apps\extension\src\password-generator.js') 'apps\extension\src\password-generator.js'
Copy-DemoFile (Join-Path $repo 'docs\today-demo.md') 'DEMO-GUIDE.md'
New-Item -ItemType Directory -Path (Join-Path $stage 'samples') -Force | Out-Null
'Harmless Sentinel demo file. Select this file to rehearse quarantine and exact-byte restore.' | Set-Content -LiteralPath (Join-Path $stage 'samples\Safe-Rehearsal.txt') -Encoding utf8
$node=(Get-Command node.exe).Source
Copy-DemoFile $node 'tools\runtime\node.exe'
Copy-DemoFile $nodeLicense 'tools\runtime\NODE-LICENSE.txt'
@'
$ErrorActionPreference='Stop'
& (Join-Path $PSScriptRoot 'tools\launch-demo.ps1')
'@ | Set-Content -LiteralPath (Join-Path $stage 'Start-Sentinel-Demo.ps1') -Encoding utf8
@'
Sentinel desktop candidate.
Requires Windows, Windows PowerShell 5.1 or PowerShell 7, .NET Framework and installed WebView2 runtime.
Double-click Setup.exe to install for your Windows user and create a desktop shortcut.
Double-click Sentinel.exe to run directly from this complete folder.
The fixed-size window hides in the system tray when minimized or closed. Use its tray menu to Open or Quit.
Load/reload apps/extension/dist in Chrome, then rerun Setup.exe if the extension was not detected on first setup.
The registered native bridge connects the extension automatically. Manual pairing remains available as a fallback.
Dummy accounts reset on restart.
Automatic URL warnings require explicit Chrome site-access opt-in.
The launched desktop uses bounded Rust byte inspection; reports remain partial coverage.
No malware or EICAR is included. Quarantine requests are disabled pending recovery beyond native worker expiry. Visible consent and designated peer acceptance are still pending.
Legacy ClamAV is optional and is not used by the launched Rust inspection path.
Persistent encrypted vault and cloud explanations,
download scanning and automatic desktop redirect logging remain incomplete. Opted-in WhatsApp Web wording warnings are supported for bounded rendered messages. See DEMO-GUIDE.md.
V2 desktop work candidate; not a completed protection release. Refer to repository evidence for publication status.
'@ | Set-Content -LiteralPath (Join-Path $stage 'README.txt') -Encoding utf8
$hashes=Get-ChildItem -LiteralPath $stage -Recurse -File | ForEach-Object {
 [pscustomobject]@{path=$_.FullName.Substring($stage.Length+1);sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()}
}
$hashes | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $stage 'manifest-sha256.json') -Encoding utf8
Write-Output $stage


