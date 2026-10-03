# Sentinel console launcher (S1 showcase path).
# Builds the UI bundle and starts the native console window.
# Fixture data only — no live protection is installed.
$ErrorActionPreference = 'Stop'

$repo = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path))
Set-Location $repo

Write-Host '==> Building console UI'
& pnpm.cmd -C apps/ui build
if ($LASTEXITCODE -ne 0) { throw 'UI build failed' }

# The space in the repo path breaks resource embedding; build outside the repo.
$env:CARGO_TARGET_DIR = 'C:\cs-target-sentinel'

$exe = Join-Path $env:CARGO_TARGET_DIR 'debug\sentinel-console.exe'
if (-not (Test-Path -LiteralPath $exe)) {
    Write-Host '==> First run: compiling the console shell (one-time, a few minutes)'
    & cargo build --manifest-path apps/desktop-tauri/Cargo.toml
    if ($LASTEXITCODE -ne 0) { throw 'Console build failed' }
}

Write-Host '==> Starting Sentinel console'
& $exe
