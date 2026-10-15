param([string]$OutputName='sentinel-extension-v9.zip')
$ErrorActionPreference='Stop'
if($OutputName -notmatch '^sentinel-extension-[a-zA-Z0-9.-]+\.zip$'){throw 'Use a Sentinel ZIP filename.'}
$repo=Split-Path -Parent $PSScriptRoot
$dist=Join-Path $repo 'apps/extension/dist'
$manifest=Get-Content -Raw -LiteralPath (Join-Path $dist 'manifest.json')|ConvertFrom-Json
$source=(& git -C $repo rev-parse HEAD).Trim()
if($LASTEXITCODE -ne 0){throw 'Source revision unavailable.'}
$files=@(Get-ChildItem -LiteralPath $dist -Recurse -File)
if($files.Count -gt 200 -or ($files|Measure-Object Length -Sum).Sum -gt 20MB){throw 'Unexpected package bounds.'}
$hashes=[ordered]@{}
foreach($file in $files){
 $relative=$file.FullName.Substring($dist.Length+1).Replace('\','/')
 if($relative -match '(^|/)(test|fixtures|node_modules|\.git)(/|$)' -or $file.LinkType){throw 'Unexpected package input.'}
 $hashes[$relative]=(Get-FileHash -Algorithm SHA256 -LiteralPath $file.FullName).Hash.ToLowerInvariant()
}
$outputDir=Join-Path $repo 'downloads'
New-Item -ItemType Directory -Path $outputDir -Force|Out-Null
$output=Join-Path $outputDir $OutputName
if(Test-Path -LiteralPath $output){throw 'Output already exists; choose a new filename.'}
Compress-Archive -Path (Join-Path $dist '*') -DestinationPath $output -CompressionLevel Optimal
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip=[IO.Compression.ZipFile]::Open($output,[IO.Compression.ZipArchiveMode]::Update)
try{
 $info=[ordered]@{kind='experimental-extension-test-build';version=$manifest.version;sourceRevision=$source;sha256=$hashes}|ConvertTo-Json -Depth 5
 $guide=@'
SENTINEL EXTENSION — EMAIL TEST BUILD

1. Extract this ZIP to a folder.
2. Open chrome://extensions (or edge://extensions), enable Developer mode,
   choose Load unpacked and select the folder containing manifest.json.
3. Open Sentinel > Settings. Enable Gmail or Outlook and approve only the
   provider access you intend to test. Refresh the test-email tab.

Use invented emails in a test account first. No private inbox was used for
acceptance testing. Email detection is experimental and still misses many
phishing messages; no warning is not proof of safety. It does not stop email
delivery, scan attachment bytes or automatically delete emails. Actual
Gmail/Outlook acceptance and independent review remain outstanding.

WhatsApp flow and the existing extension/native connection identity are
preserved. Loading this extension does not install or update the desktop app.
No raw email or chat is uploaded to AI. Email checks are local and opt-in.

This ZIP is a test build, not a production release or a Chrome Store package.
BUILD-INFO.json records its source revision and file hashes.
'@
 foreach($item in @(@('BUILD-INFO.json',$info),@('TEST-BUILD.txt',$guide))){$entry=$zip.CreateEntry($item[0]);$writer=[IO.StreamWriter]::new($entry.Open(),[Text.UTF8Encoding]::new($false));try{$writer.Write($item[1])}finally{$writer.Dispose()}}
}finally{$zip.Dispose()}
$zip=[IO.Compression.ZipFile]::OpenRead($output)
try{
 foreach($name in $hashes.Keys){$entry=$zip.GetEntry($name);if(!$entry){throw "Missing package entry: $name"};$stream=$entry.Open();$sha=[Security.Cryptography.SHA256]::Create();try{$actual=[Convert]::ToHexString($sha.ComputeHash($stream)).ToLowerInvariant();if($actual -ne $hashes[$name]){throw "Package hash mismatch: $name"}}finally{$stream.Dispose();$sha.Dispose()}}
 $fileEntries=@($zip.Entries|Where-Object {-not $_.FullName.EndsWith('/')})
 if(!$zip.GetEntry('manifest.json') -or $fileEntries.Count -ne $files.Count+2){throw 'Unexpected ZIP structure.'}
}finally{$zip.Dispose()}
$digest=(Get-FileHash -Algorithm SHA256 -LiteralPath $output).Hash.ToLowerInvariant()
Set-Content -LiteralPath ($output+'.sha256') -Value ($digest+'  '+$OutputName) -Encoding utf8
Write-Output "Verified $($files.Count) extension files; version $($manifest.version); SHA256 $digest"
Write-Output $output
