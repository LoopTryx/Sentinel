# CyberShield v3

Local-first Windows security companion, following [the v3 master plan](docs/CyberShield-Master-Plan.md). Microsoft Defender remains enabled. This repository is at the R0 feasibility stage; it does not currently provide protection.

## Delivery order

R0 establishes platform evidence, contracts, and recovery boundaries. R1 targets a protected personal alpha, including a verified USB storage and HID gate on a declared Windows 11 test configuration. R2 expands the vault, monitoring, message analysis, lessons, and signed updates. R3 completes presentation and localization.

See [STATUS.md](STATUS.md) for observed progress and remaining gates. Historical plans in `docs/` are references; the v3 master plan is authoritative.

## Available development commands

Run `./tools/verify.ps1` on Windows to check the Rust workspace and UI. The CLI supports a fixture status and an offline URL feed demo:

```powershell
cargo run -p shield-cli -- status --fixture
cargo run -p shield-cli -- intel import-local data/fixtures/feeds/urlhaus-sample.txt .local-intel-cache
cargo run -p shield-cli -- intel lookup-offline .local-intel-cache https://malware.test/payload.exe
```

The feed uses benign `.test` URLs. Lookup never visits the URL. A `not_listed` result means only that the URL is absent from the loaded feed; it is not a safety verdict. The cache directory is local demo data and should be removed when no longer needed.
