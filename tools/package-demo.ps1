param([string]$NodeLicensePath,[switch]$IncludeLegacyClamAV,[switch]$AssetHardlinks,[string]$NativeDirectory,[ValidatePattern('^v(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$')][string]$Version='v1.0.0')
$ErrorActionPreference='Stop'
$repo=Split-Path -Parent $PSScriptRoot
if(!$NativeDirectory){$NativeDirectory=Join-Path $repo 'apps\desktop\console-build'}
$inspectionEngine=Join-Path $NativeDirectory 'sentinel-inspect.exe'
$inspectionReceipt=Join-Path $NativeDirectory 'inspection-engine.json'
if(-not(Test-Path -LiteralPath $inspectionEngine -PathType Leaf) -or -not(Test-Path -LiteralPath $inspectionReceipt -PathType Leaf)){throw 'Stage and verify the native inspection engine before packaging.'}
$engineReceipt=Get-Content -LiteralPath $inspectionReceipt -Raw | ConvertFrom-Json
if($engineReceipt.executable -ne 'sentinel-inspect.exe' -or $engineReceipt.sha256 -ne (Get-FileHash -LiteralPath $inspectionEngine -Algorithm SHA256).Hash.ToLowerInvariant()){throw 'Staged inspection engine differs from its build receipt.'}
if(-not $NodeLicensePath){$NodeLicensePath=Join-Path $repo '.local-handoff\NODE-LICENSE.txt'}
$nodeLicense=(Resolve-Path -LiteralPath $NodeLicensePath).Path
foreach($required in @('apps\ui\dist\index.html','apps\extension\dist\manifest.json','apps\desktop\console-build\Sentinel.Glass.exe','apps\desktop\console-build\Microsoft.Web.WebView2.Core.dll','apps\desktop\console-build\Microsoft.Web.WebView2.Wpf.dll','apps\desktop\console-build\WebView2Loader.dll')){
 if(-not(Test-Path -LiteralPath (Join-Path $repo $required) -PathType Leaf)){throw ('Build prerequisite missing: '+$required)}
}
$stage=Join-Path $repo (('artifacts\Sentinel-'+$Version+'-')+[DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $stage -Force | Out-Null
function Copy-DemoFile([string]$Source,[string]$Relative){
 $destination=Join-Path $stage $Relative
 New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
 if($AssetHardlinks -and (Get-Item -LiteralPath $Source).Length -gt 67108864){try{New-Item -ItemType HardLink -Path $destination -Value $Source -ErrorAction Stop | Out-Null}catch{Copy-Item -LiteralPath $Source -Destination $destination -Force}}else{Copy-Item -LiteralPath $Source -Destination $destination}
}
foreach($entry in @('apps\ui\dist','apps\extension\dist','apps\extension\src','apps\extension\data','apps\demo-runtime')){
 $destination=Join-Path $stage $entry
 New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
 Copy-Item -LiteralPath (Join-Path $repo $entry) -Destination $destination -Recurse
}
# Ship only pinned model/runtime assets, never ephemeral session API-key files.
$ai=Join-Path $repo 'artifacts/local-ai'
$aiStage=Join-Path $stage 'artifacts/local-ai'
New-Item -ItemType Directory -Path $aiStage -Force | Out-Null
foreach($name in @('manifest.json','SmolLM2-135M-Instruct-Q4_K_M.gguf','qwen2.5-1.5b-instruct-q4_k_m.gguf')){Copy-DemoFile (Join-Path $ai $name) ('artifacts/local-ai/'+$name)}
foreach($name in @('runtime','licenses')){Copy-Item -LiteralPath (Join-Path $ai $name) -Destination (Join-Path $aiStage $name) -Recurse}
$desktopFiles=@('Sentinel.Glass.exe','Sentinel.exe','Setup.exe','Sentinel.NativeConnect.exe','Sentinel.PasswordApproval.exe','Sentinel.UsbBootstrap.exe','Sentinel.UsbBroker.exe','Sentinel.UsbRecovery.dll','Sentinel.DuckyPolicy.exe','sentinel-inspect.exe','sentinel-sweep.exe','Microsoft.Web.WebView2.Core.dll','Microsoft.Web.WebView2.Wpf.dll','WebView2Loader.dll','signature-runtime.manifest')
foreach($name in $desktopFiles){Copy-DemoFile (Join-Path $NativeDirectory $name) ('apps/desktop/console-build/'+$name)}
$scanEngine=Join-Path $NativeDirectory 'scan-engine'
foreach($line in Get-Content (Join-Path $NativeDirectory 'signature-runtime.manifest')){
 $parts=$line.Split('|');$file=Join-Path $scanEngine $parts[0]
 if($parts.Count -ne 2 -or (Get-FileHash -LiteralPath $file).Hash -ne $parts[1]){throw 'Scanner runtime pin mismatch; package refused.'}
}
Copy-Item -LiteralPath $scanEngine -Destination (Join-Path $stage 'apps/desktop/console-build/scan-engine') -Recurse
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
Copy-DemoFile (Join-Path $repo 'tools\install-prerequisites.ps1') 'tools\install-prerequisites.ps1'
Copy-DemoFile (Join-Path $repo 'artifacts\prerequisites\MicrosoftEdgeWebview2Setup.exe') 'tools\runtime\MicrosoftEdgeWebview2Setup.exe'
Copy-DemoFile (Join-Path $repo 'tools\install-desktop.ps1') 'tools\install-desktop.ps1'
Copy-DemoFile (Join-Path $repo 'tools\extension-identity.ps1') 'tools\extension-identity.ps1'
Copy-DemoFile (Join-Path $NativeDirectory 'Sentinel.exe') 'Sentinel.exe'
Copy-DemoFile (Join-Path $NativeDirectory 'Setup.exe') 'Setup.exe'
Copy-DemoFile (Join-Path $NativeDirectory 'Sentinel.NativeConnect.exe') 'apps\desktop\console-build\Sentinel.NativeConnect.exe'
Copy-DemoFile (Join-Path $repo 'tools\usb\read-inventory.ps1') 'tools\usb\read-inventory.ps1'
foreach($labFile in @('README.md','duck-code.py','test-guard.ps1','Start-Typing-Test.ps1')){
 Copy-DemoFile (Join-Path $repo ('tools\usb\lab\'+$labFile)) ('tools\usb\lab\'+$labFile)
}
# Shared extension source is already copied above with its runtime dependencies.
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
Sentinel v1.0.0
Windows 10 (build 19041+) or Windows 11, x64, .NET Framework 4.8 and Windows Hello are required. Setup checks requirements and installs Microsoft WebView2 if absent (internet required). ARM64 and 32-bit Windows need separate engines.
Setup creates a desktop shortcut and registers the native Chrome connector.
Chrome requires one-time approval: chrome://extensions > Developer mode > Load unpacked. Select the ChromeExtension folder shown by setup.
F11 toggles fullscreen. Enter sends a chat; Shift+Enter starts a new line.
Chats are encrypted for the current Windows user. Local CPU chat needs no NVIDIA key.
NVIDIA is optional. Message warnings require site-specific enablement.
USB Guard remains off by default. This installer does not activate any USB policy or install the development machine's protected enrollment onto another laptop.
General USB enforcement and built-in-input exclusions are not yet qualified across laptops. HID plus storage is a review signal, not proof of a keystroke injector.
No guarantee of interception before first input, malware detection or instant device recovery.
'@ | Set-Content -LiteralPath (Join-Path $stage 'README.txt') -Encoding utf8
$hashes=Get-ChildItem -LiteralPath $stage -Recurse -File | ForEach-Object {
 [pscustomobject]@{path=$_.FullName.Substring($stage.Length+1);sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()}
}
$hashes | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $stage 'manifest-sha256.json') -Encoding utf8
Write-Output $stage
