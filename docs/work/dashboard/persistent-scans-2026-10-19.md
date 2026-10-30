# Sentinel scans and download checks — 2026-10-19

## Implemented
- Native Quick Scan (Startup + recent Downloads), Full Scan (fixed drives, E: excluded), native-picked files/folders, progress and Stop.
- Sentinel-owned persistent stdio worker, existing Sentinel advisory rules and pinned ClamAV 1.5.4 with official signed main/daily definitions. No Defender scan calls. Definitions load once per worker; automatic jobs can run between manual files.
- Downloads watcher handles rename/completion, waits for stable metadata, refuses links, retries transient incomplete reads, and reconciles recent downloads at startup/overflow/30-minute intervals. Monitoring preference persists locally. Definitions update on startup and idle 12-hour restarts.
- Only fresh official strong signature verdicts authorize automatic quarantine in Downloads, using the existing exact-object/hash association and encrypted, journaled recovery store. Heuristic, PUA, test, stale and incomplete outcomes never authorize removal. Vault inventory refreshes in the console; restore remains natively confirmed.
- Current bounds: complete signature scan <=256 MiB; automatic encrypted quarantine <=8 MiB. Larger detected threats require manual review. Full Scan reports skipped/inaccessible files; it does not claim they are clean. Automatic checks run during the signed-in Sentinel session, including tray operation; they are not a kernel pre-execution blocker.

## Actual blockers fixed
1. Native storage integrity checks rejected Windows' package-redirection alias. Resolve only the native-owned private signature directory to its final physical directory, validate private ACL/no links again, then retain exact files as before.
2. The renderer bridge rejected a healthy snapshot's `error: ""` as an exception, leaving scan buttons disabled. Reproduced with a failing bridge test; only genuine nonempty action errors now reject; structured scanner status warnings remain live and visible. Added separate failing-before-fix regressions for empty errors and nonfatal watcher warnings.
3. Preserve paused jobs while download checks interrupt them; report skipped content as incomplete; fence callbacks from retired worker generations; refresh definitions only after active jobs finish; bounded download bursts prevent manual starvation.

## Verification
- `cargo test -p sentinel-av --lib`: original 40 passed; final full verifier includes 41 passing library tests, including synthetic-verdict -> actual retained scan -> actual encrypted quarantine -> exact restore. Synthetic classification is explicitly not real malware-detection evidence.
- `tools/test-native-protection.ps1`: PASS against the final release/pinned manifest. Actual official engine loaded 3,628,111 signatures. Ordinary harmless files verified watcher partial-file exclusion, final rename/stability, selected directory, Quick Scan, download priority during manual traversal, cancellation, Full Scan start/progress/Stop, monitoring off. Private download/vault fixtures; monitoring preference restored afterward.
- Entire-drive completion was not run: Full Scan was deliberately stopped. No live malware/EICAR acceptance or detection-rate claim.
- `tools/verify.ps1` unchanged: final rerun passed after both bridge fixes, with 41 scanner-library and89 UI tests; results recorded in artifacts/persistent-full-verifier.log.
- Native build: artifacts/persistent-final-native-build.log. Official harmless engine probe: artifacts/official-signature-probe-actual.log. Native qualification: artifacts/persistent-native-acceptance.log. Bridge red regression: artifacts/scan-bridge-red.log.
- Installed update/backup: artifacts/signature-scanner-install.json. Installed native + DOM readiness recorded in console-build/protection-smoke.txt under the installed Desktop folder. Check final result rather than assuming readiness from compilation.

## Boundaries
No USB policy, Windows Hello, credential, browser extension, peer branch, published history or GitHub release changes. Defender stays enabled. Existing dirty unrelated source preserved. Independent authority/failure review completed; its concrete P2 was fixed and rechecked. Reviewer reports no remaining blocking finding in that focused review. Build/test success is not publication or production certification.
