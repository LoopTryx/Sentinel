$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$target=Join-Path $root 'artifacts/local-ai'
New-Item -ItemType Directory -Force -Path $target | Out-Null
$assets=@(
 @{Name='runtime.zip';Url='https://github.com/ggml-org/llama.cpp/releases/download/b11718/llama-b11718-bin-win-cpu-x64.zip';Hash='92cc529b29a43f9a30e21d490cb2e95062acd0b59af6fee8b3b52b28074f838c'},
 @{Name='qwen2.5-1.5b-instruct-q4_k_m.gguf';Url='https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/91cad51170dc346986eccefdc2dd33a9da36ead9/qwen2.5-1.5b-instruct-q4_k_m.gguf';Hash='6a1a2eb6d15622bf3c96857206351ba97e1af16c30d7a74ee38970e434e9407e'},
 @{Name='SmolLM2-135M-Instruct-Q4_K_M.gguf';Url='https://huggingface.co/bartowski/SmolLM2-135M-Instruct-GGUF/resolve/09816acd5d99df7be770d85ea30822623dab342c/SmolLM2-135M-Instruct-Q4_K_M.gguf';Hash='2e8040ceae7815abe0dcb3540b9995eaa1fa0d2ca9e797d0a635ae4433c68c2d'}
)
foreach($asset in $assets){$file=Join-Path $target $asset.Name;if(-not(Test-Path -LiteralPath $file)){Invoke-WebRequest -Uri $asset.Url -OutFile $file -TimeoutSec 300};if((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() -ne $asset.Hash){throw ('Untrusted local AI asset: '+$asset.Name)}}
Add-Type -AssemblyName System.IO.Compression.FileSystem
$runtime=Join-Path $target 'runtime'
if(-not(Test-Path -LiteralPath $runtime)){
 $zip=[IO.Compression.ZipFile]::OpenRead((Join-Path $target 'runtime.zip'))
 try{foreach($entry in $zip.Entries){$resolved=[IO.Path]::GetFullPath((Join-Path $runtime $entry.FullName));if(-not $resolved.StartsWith($runtime+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Unsafe runtime archive path'}}}finally{$zip.Dispose()}
 [IO.Compression.ZipFile]::ExtractToDirectory((Join-Path $target 'runtime.zip'),$runtime)
}
# Never regenerate a trusted manifest from bytes differing from the pinned archive.
$zip=[IO.Compression.ZipFile]::OpenRead((Join-Path $target 'runtime.zip'))
try {
 foreach($entry in $zip.Entries){
  if(-not $entry.Name){continue}
  $resolved=[IO.Path]::GetFullPath((Join-Path $runtime $entry.FullName))
  if(-not $resolved.StartsWith($runtime+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Unsafe runtime archive path'}
  if(-not(Test-Path -LiteralPath $resolved -PathType Leaf)){throw 'Extracted runtime file missing'}
  $stream=$entry.Open();$sha=[Security.Cryptography.SHA256]::Create()
  try{$expected=[Convert]::ToHexString($sha.ComputeHash($stream))}finally{$stream.Dispose();$sha.Dispose()}
  if((Get-FileHash -LiteralPath $resolved).Hash -ne $expected){throw 'Extracted runtime differs from pinned archive'}
 }
}finally{$zip.Dispose()}
$server=Get-ChildItem -LiteralPath $runtime -Recurse -Filter 'llama-server.exe' | Select-Object -First 1
if(-not $server){throw 'CPU runtime server missing'}
$files=@(Get-ChildItem -LiteralPath $server.DirectoryName -File | Where-Object {$_.Extension -in '.exe','.dll'} | ForEach-Object {@{name=$_.Name;sha256=(Get-FileHash -LiteralPath $_.FullName).Hash.ToLowerInvariant()}})
@{schemaVersion=1;release='b11718';model='SmolLM2-135M-Instruct-Q4_K_M.gguf';modelSha256=$assets[2].Hash;runtimeSubdirectory=[IO.Path]::GetRelativePath($target,$server.DirectoryName);files=$files} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $target 'manifest.json')
Write-Output 'Pinned CPU runtime and 135M model ready. No provider key, cloud inference, startup task or USB change.'

$licenseDirectory=Join-Path $target 'licenses'
New-Item -ItemType Directory -Force $licenseDirectory | Out-Null
$licenses=@(
 @{Name='llama.cpp-MIT.txt';Url='https://raw.githubusercontent.com/ggml-org/llama.cpp/b11718/LICENSE';Hash='94f29bbed6a22c35b992c5c6ebf0e7c92f13b836b90f36f461c9cf2f0f1d010d'},
 @{Name='SmolLM2-Apache-2.0.txt';Url='https://www.apache.org/licenses/LICENSE-2.0.txt';Hash='cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30'}
)
foreach($license in $licenses){$path=Join-Path $licenseDirectory $license.Name;if(-not(Test-Path -LiteralPath $path)){Invoke-WebRequest $license.Url -OutFile $path};if((Get-FileHash -LiteralPath $path).Hash.ToLowerInvariant() -ne $license.Hash){throw 'License text hash mismatch'}}