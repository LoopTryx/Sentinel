# Sentinel v3

Local-first Windows security companion, following [the v3 master plan](docs/Sentinel-Master-Plan.md). Microsoft Defender remains enabled. This repository is at the R0 feasibility stage; it does not currently provide protection.

## Delivery order

R0 establishes platform evidence, contracts, and recovery boundaries. R1 targets a protected personal alpha, including a verified USB storage and HID gate on a declared Windows 11 test configuration. R2 expands the vault, monitoring, message analysis, lessons, and signed updates. R3 completes presentation and localization.

See [STATUS.md](STATUS.md) for observed progress and remaining gates. Historical plans in `docs/` are references; the v3 master plan is authoritative.

The owner's [Phase 1-70 / Phase 1-30 checkpoints](docs/phase-1-70-30.md) set a basic functional preview before the final protection and release gates. The [Chrome extension harness](apps/extension/README.md) currently blocks one synthetic fixture domain only; it is not a general Web Shield.

## Available development commands

Run `./tools/verify.ps1` on Windows to check the Rust workspace, UI, and extension harness. The CLI supports a fixture status and an offline URL feed demo:

```powershell
cargo run -p sentinel-cli -- status --fixture
cargo run -p sentinel-cli -- intel import-local data/fixtures/feeds/urlhaus-sample.txt .local-intel-cache
cargo run -p sentinel-cli -- intel lookup-offline .local-intel-cache https://malware.test/payload.exe
```

The feed uses benign `.test` URLs. Lookup never visits the URL. A `not_listed` result means only that the URL is absent from the loaded feed; it is not a safety verdict. The cache directory is local demo data and should be removed when no longer needed.
