# Owner delivery goal: scanning, quarantine and download inspection

Owner request: 10 October 2026. Engineer A runtime branch:
`codex/engineer-a/issue-9-scan-quarantine`, stacked on Engineer B verifier
`91e0297230af2653269ae308943a210cac03e0c5` (PR59, itself on PR41).
Main integration is required after independent review and real supported journeys.
Do not merge the inherited PR41 unresolved findings merely to deliver this leaf.

## First recovery correction

Claim: https://github.com/LoopTryx/Sentinel/issues/9#issuecomment-6095188933

Editing files: `crates/sentinel-av/src/vault.rs` and new
`crates/sentinel-av/tests/vault_recovery.rs`. Preserve B's branch and dirty legacy
checkout. B explicitly reserved the runtime corrections to A in issue11.

Existing signatures remain:

```rust
Vault::quarantine(&self, source: &Path) -> Result<QuarantineOutcome, String>
Vault::restore(&self, vault_file: &str, to_path: &Path) -> Result<(), String>
Vault::destroy(&self, vault_file: &str) -> Result<(), String>
```

Restore only reads the existing 32-byte key; missing/damaged keys require recovery.
New quarantine cannot initialize a missing key while recovery blobs exist. New
key creation is exclusive, preventing a competing creator from overwriting it.
Blob references must be exactly 32 lowercase hexadecimal characters plus `.qtn`.
Restore creates a destination exclusively, writes and flushes it before removing
the recovery blob. Occupied destinations fail without modification. Write/flush
failure retains the recovery blob and may leave a partial destination; retry must
use a fresh explicitly selected destination. Blob cleanup failure returns an error
even when the restored file exists. No operation silently reports full success.

Examples: `restore("0123456789abcdef0123456789abcdef.qtn", selected_path)`;
`../anything`, absolute paths and malformed IDs fail. Callers must retain the
record on failure and show recovery-required/occupied/partial states. This API is
not authorization: only the native authenticated, explicitly authorized caller
may select source or destination. It is not yet approved for valuable files.

Evidence: three failing-first regressions reproduced key replacement, occupied
destination overwrite and deletion outside the vault using invented temporary
files. All 15 inherited AV tests plus five new recovery tests passed using
`cargo test --offline -p sentinel-av` with pinned GNU Rust 1.98.1. A standalone
probe imported the exact vault source while YARA compiled; it is supplemental,
not a substitute for the full crate. Full verifier and independent review remain
to be recorded at the published head.

## Remaining concrete delivery work

1. Retained source identity, bounded encrypted staging, verified on-disk bytes,
   transactional journal and crash recovery; never delete a replacement pathname.
   Private Windows directory/ACL/no-follow handling and supported volume evidence.
2. Scanner bounded entry/byte/memory/time/report admission, chunk cancellation,
   progress and explicit errors/partial results. Current PR41 hashes arbitrarily
   large tails and its directory width/report count is unbounded. Existing main
   Node demo is a separate transitional route; do not mistake its 8 MiB skip for
   deep inspection or expand WPF into a competing permanent application.
3. Bounded static content inspection: exact inspected zero-byte ratio, detected
   format/header mismatch, scripted/encoded payload indicators and existing rule
   evidence. Padding/sparsity/entropy are suspicious clues, never malware proof.
   Large-file sampling must label sampled ranges and incomplete coverage; never
   call a partial digest the full-file SHA-256. No execution or unsafe archive
   extraction. Legitimate sparse disk images and compressed data need controls.
4. Actual supported Chrome download observation -> native subject-bound approval
   -> retained handle -> private bounded staged bytes -> isolated worker report.
   Desktop and extension must show the same report identity/digest/coverage.
   PR60 only prepares accounting/correlation, not this journey. Respect its
   separate platform/transport review gates and permission consent.
5. Agree Tauri/UI command ownership and generated canonical DTOs with B; native
   adapter signatures, limits, progress/cancel/errors and safe examples must ship
   with each increment. No synthetic completion, automatic remediation based on
   padding clues, or universal pre-execution protection claim.
6. Exact-head peer review, full CI, actual benign filesystem/quarantine/browser
   journeys and reviewed coordinator main integration; then verify a pinned
   usable build. All issue scopes remain open until their acceptance is met.

Defender remains enabled; E: untouched; no live malware, EICAR, real secrets,
automatic cloud upload or daily-machine device enforcement.
