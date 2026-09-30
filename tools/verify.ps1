$ErrorActionPreference = 'Stop'

$cargoBin = Join-Path $env:USERPROFILE '.cargo\bin'
if (Test-Path -LiteralPath $cargoBin) {
    $env:PATH = "$cargoBin;$env:PATH"
}
$cargo = (Get-Command cargo.exe -ErrorAction Stop).Source
$pnpm = (Get-Command pnpm.cmd -ErrorAction Stop).Source
$mingwBin = Join-Path $env:USERPROFILE 'scoop\apps\mingw\current\bin'
if (Test-Path -LiteralPath $mingwBin) {
    $env:PATH = "$mingwBin;$env:PATH"
}

function Invoke-Check {
    param([string]$Name, [scriptblock]$Command)
    Write-Host "==> $Name"
    & $Command
    if ($LASTEXITCODE -ne 0) { throw "$Name failed with exit code $LASTEXITCODE" }
}

Invoke-Check 'Rust formatting' { & $cargo fmt --all -- --check }
Invoke-Check 'Rust lint' { & $cargo clippy --workspace --all-targets -- -D warnings }
Invoke-Check 'Rust tests and TS generation' { & $cargo test --workspace }
Invoke-Check 'TypeScript typecheck' { & $pnpm -r typecheck }
Invoke-Check 'TypeScript tests' { & $pnpm -r test }
Invoke-Check 'UI build' { & $pnpm -r build }
Invoke-Check 'Extension syntax' { & node --check apps/extension/src/service-worker.js; if ($LASTEXITCODE -eq 0) { & node --check apps/extension/src/popup.js } }
Invoke-Check 'Extension harness tests' { & node --test apps/extension/test/harness.test.mjs }
Invoke-Check 'Extension harness build' { & node apps/extension/scripts/build.mjs }

$generatedPath = 'packages/contracts/src/generated'
git diff --quiet -- $generatedPath
if ($LASTEXITCODE -ne 0) { throw 'Generated TypeScript bindings differ from the committed Rust contracts' }
git diff --cached --quiet -- $generatedPath
if ($LASTEXITCODE -ne 0) { throw 'Staged TypeScript bindings differ from the committed Rust contracts' }
$untrackedBindings = git ls-files --others --exclude-standard -- $generatedPath
if ($LASTEXITCODE -ne 0) { throw 'Could not check untracked generated bindings' }
if ($untrackedBindings) { throw 'New generated TypeScript bindings are not committed' }
Write-Host 'All available T01 checks passed.'
