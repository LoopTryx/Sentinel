$ErrorActionPreference='Stop'
$repo=Split-Path -Parent $PSScriptRoot
$cargo=Join-Path $env:USERPROFILE '.cargo\bin\cargo.exe'
$target=if($env:CARGO_TARGET_DIR){$env:CARGO_TARGET_DIR}else{Join-Path $repo 'artifacts\usb-broker-target'}
$env:PATH=(Join-Path $env:USERPROFILE 'scoop\apps\mingw\current\bin')+';'+$env:PATH
& $cargo build --offline --locked --release --manifest-path (Join-Path $repo 'native\usb-broker-engine\Cargo.toml') --target-dir $target
if($LASTEXITCODE -ne 0){throw 'USB recovery engine build failed'}
$output=Join-Path $repo 'apps\desktop\console-build'
New-Item -ItemType Directory -Path $output -Force|Out-Null
Copy-Item -LiteralPath (Join-Path $target 'release\sentinel_usb_broker_engine.dll') -Destination (Join-Path $output 'Sentinel.UsbRecovery.dll') -Force
Write-Output 'Built recovery-only native USB engine. No installation, startup task or input policy activated.'
