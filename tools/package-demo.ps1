$ErrorActionPreference='Stop'
$repo=Split-Path -Parent $PSScriptRoot
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
$clam=Join-Path $repo '.local-handoff\clamav-1.5.4\portable\clamav-1.5.4.win.x64'
New-Item -ItemType Directory -Path (Join-Path $stage '.local-handoff\clamav-1.5.4\portable\clamav-1.5.4.win.x64') -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $clam 'certs') -Destination (Join-Path $stage '.local-handoff\clamav-1.5.4\portable\clamav-1.5.4.win.x64\certs') -Recurse
foreach($file in Get-ChildItem -LiteralPath $clam -File){
 if($file.Extension -eq '.dll' -or $file.Name -in @('clamscan.exe','COPYING')){Copy-DemoFile $file.FullName ('.local-handoff\clamav-1.5.4\portable\clamav-1.5.4.win.x64\'+$file.Name)}
}
Copy-DemoFile (Join-Path $repo '.local-handoff\clamav-1.5.4\databases\daily.cvd') '.local-handoff\clamav-1.5.4\databases\daily.cvd'
Copy-DemoFile (Join-Path $repo 'tools\launch-demo.ps1') 'tools\launch-demo.ps1'
Copy-DemoFile (Join-Path $repo 'apps\extension\src\password-generator.js') 'apps\extension\src\password-generator.js'
Copy-DemoFile (Join-Path $repo 'docs\today-demo.md') 'DEMO-GUIDE.md'
$node=(Get-Command node.exe).Source
Copy-DemoFile $node 'tools\runtime\node.exe'
Copy-DemoFile (Join-Path $repo '.local-handoff\NODE-LICENSE.txt') 'tools\runtime\NODE-LICENSE.txt'
@'
$ErrorActionPreference='Stop'
& (Join-Path $PSScriptRoot 'tools\launch-demo.ps1')
'@ | Set-Content -LiteralPath (Join-Path $stage 'Start-Sentinel-Demo.ps1') -Encoding utf8
@'
Sentinel school-demo candidate. This is a portable local demo, not an installer or completed S1 release.
Requires Windows, PowerShell 7, .NET Framework and installed WebView2 runtime.
Run Start-Sentinel-Demo.ps1 in PowerShell 7. Load apps/extension/dist in Chrome.
Pair through the demo connection controls. Dummy accounts reset on restart.
Automatic URL warnings require explicit Chrome site-access opt-in.
ClamAV is restricted to the included harmless samples. No malware or EICAR is included.
Persistent encrypted vault, native messaging, cloud explanations,
download scanning and automatic desktop redirect logging remain incomplete. Opted-in WhatsApp Web wording warnings are supported for bounded rendered messages. See DEMO-GUIDE.md.
v1.0.0 school demo candidate; portable build, no installer. Refer to GitHub release for publication status.
'@ | Set-Content -LiteralPath (Join-Path $stage 'README.txt') -Encoding utf8
$hashes=Get-ChildItem -LiteralPath $stage -Recurse -File | ForEach-Object {
 [pscustomobject]@{path=$_.FullName.Substring($stage.Length+1);sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()}
}
$hashes | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $stage 'manifest-sha256.json') -Encoding utf8
Write-Output $stage


