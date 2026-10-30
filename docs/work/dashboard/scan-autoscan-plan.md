# Finish Sentinel scans and automatic checks

Owner request 2026-10-19: continue until integrated manual/automatic scanning and recoverable confirmed-signature quarantine work. Defender is excluded. Existing UI and USB boundaries remain unchanged.

## Approved direction explained to owner

Use existing Sentinel Rust checks plus the already downloaded/GPG-verified ClamAV 1.5.4 package and official signed CVD signature databases. No TCP clamd server, provider uploads, arbitrary renderer paths, execution of inspected files, automatic heuristic deletion or Defender invocation.

## Work

1. [done] Bind pinned 1.5.4 libclamav ABI behind a provider; full-buffer scans, official signed databases, separate strong/PUA/test/heuristic results, bounded scans/errors/cancellation.
2. [done] Owned persistent native worker compiles signatures once, prioritizes completed download jobs between manual-scan files, uses retained original subject for any automatic quarantine. Existing authenticated encrypted vault/recovery and inventory must be reused; >8MiB automatic quarantine remains unsupported by current vault and must be reported.
3. [done] Native DLL/dependency pinning and retained leases; official Freshclam one-shot update with signed CVDs (ScriptedUpdates=no). No unsigned/custom production signatures. Stale/unavailable database state visible, not silently healthy.
4. [done] Robust watcher stability/partial rename/overflow/reconciliation/restart behavior, monitor setting persistence and native-only fixed scan roots. Manual and automatic status/events must not overwrite each other.
5. [done] UI results/actions/status from authoritative native state; selected-file/folder flow connected to same provider where possible without removing existing authorization boundaries.
6. [done] Deterministic failure/race tests, real official-signature engine acceptance using ordinary harmless text, separate simulated-decision/actual encrypted-vault test, actual harmless download and manual scan acceptance, independent review, unchanged verifier, installed build check.

## Existing evidence

Previous installed version only had a read-only bundled-rule worker. Prior download/Quick/Full-Stop checks passed; it did not implement automatic signature quarantine or comprehensive definitions. Build caches were deleted with owner authorization; rebuild using stripped debug info and no incremental duplication to control disk use.

## ABI review

Independent reviewer checked official `clamav-1.5.4/libclamav/clamav.h`. Use cl_scanmap_ex (not deprecated callback): return status0 and separate verdict2=strong,3=PUA. Windows x64 ABI uses five u32 options fields, uint64 scanned, usize fmap length. Dynamic load only fixed pinned directory with DLL_LOAD_DIR|SYSTEM32 search flags. No heuristic/test/PUA match authorizes automatic quarantine.

## Blockers / current state

Implementation, native qualification and final full verifier passed. Final installed readiness evidence is recorded separately; do not infer complete-drive or malware acceptance. No GitHub publication (account suspended). Preserve all dirty prior work and independent probe source/recovery files.

## Final evidence
See persistent-scans-2026-10-19.md and artifacts/persistent-full-verifier.log. 41 scanner library tests and89 UItests passed. Independent final authority/failure-path review found one warning-status bug; red/green regression added and reviewer confirmed the fix with no remaining blocking finding. Native release qualified with ordinary harmless files; simulated verdicts exercise actual encrypted quarantine/recovery. No live malware or complete-drive acceptance claimed.
