# Local scan output contract — issue #9

Output-only Rust contracts in `sentinel-proto/src/scan_dispatch.rs` generate LocalScanTicket, LocalScanReport, LocalScanSnapshot, LocalScanDispatchError and LocalScanPollResponse TypeScript. Import generated types; never recreate them. This increment registers no endpoint, accepts no UI path and enables no scan capability. Coordinator review/integration required.

## Entry points

`sentinel_scan::dispatch_wire::poll_current_response(&mut NativeScanDispatcher, &NativeSelectionRegistry, &ScanTicket) -> LocalScanPollResponse` is the preferred native observation. Host owns one dispatcher/registry and serializes picker registration/polling. Existing start/cancel/abandon/clear signatures and bounds are in local-scan-dispatch.md. This increment does not define remote requests or picker authority.

`dispatch_snapshot(&ScanTicket, &DispatchSnapshot) -> Result<LocalScanSnapshot, InvalidDispatchSnapshot>` validates correlation/bounds before cloning; `dispatch_error(DispatchError) -> LocalScanDispatchError` maps fixed errors. Tickets are correlation, not bearer authorization.

## Safe examples and semantics

```json
{"status":"snapshot","data":{"ticket":{"jobId":"job-1","selectionRef":"selection-1"},"state":"timed_out","workerReturned":false,"abandoned":false,"progress":null,"report":null}}
```

```json
{"status":"error","data":"wrong_operation"}
```

Reports use `{kind:"file",data:SelectedFileReport}` or `{kind:"directory",data:SelectedDirectoryReport}`. Counter DTOs retain canonical decimal u64 strings; never coerce them to JS Number. Null means unavailable evidence, not zero or clean. Coverage remains partial. Rust boxed snapshot storage does not change JSON.

Cancelled/timed_out can precede actual return. Retain admission and poll until workerReturned; clear only after join. Abandoned output is permanently suppressed. Selection-aware polling abandons invalidated selections; UI must invalidate previously rendered results on selection/view changes. Wrong tickets cannot mutate another job.

Fixed errors: busy, invalid_selection, invalid_deadline, wrong_operation, unavailable, worker_failed, invalid_snapshot. No raw path/panic diagnostics. Invalid snapshots provide no usable evidence: invalidate presentation and retain native cleanup ownership; never release admission or report success from an error.

Converter rejects invalid outer references, mismatched nested refs/progress, report-before-return, inconsistent running/returned flags, abandoned output, invalid 64-character hexadecimal hashes and over 256 directory details (dispatcher scanner bound is 64). Serialization alone does not enforce bounds: use converter. This validates trusted native output, not untrusted request authority or all semantic relationships of arbitrary constructed counters.

## Acceptance and remaining work

`cargo test -p sentinel-scan --test dispatch --test dispatch_wire` checks actual harmless file/folder responses and synthetic lifecycle, nulls, precision and mismatch/bounds. `cargo test -p sentinel-proto --lib` regenerates bindings. Run tools/verify.ps1 after committing bindings.

Remaining: reviewed trusted picker/command decoder, UI integration/journeys and hard process timeout/reap. Cooperative threads cannot interrupt blocked OS I/O. No hostile-file isolation, installed scan capability or event rehearsals claimed.

## Reject unsupported full-engine claims - 5 October 2026

The existing `dispatch_snapshot`/`poll_current_response` signatures and generated DTOs are unchanged. This local static benign-scan path has no full signature engine. Both file and directory report variants now reject `full_signature_engine_active=true` before cloning output, returning fixed `InvalidDispatchSnapshot`; the preferred poll adapter maps it to `{"status":"error","data":"invalid_snapshot"}`. An optional ClamAV evaluation result on another review branch does not authorize this capability flag or turn partial coverage into complete protection.

Current scan producers already emit false. This fixes a converter invariant gap demonstrated with constructed native snapshots, not a deployed exploit or observed live UI misrepresentation. Native callers still need actual command/session/selection authorization; these output checks cannot supply it. No engine state, request method or permissions were enabled.

GLM: invalidate any displayed success for invalid_snapshot, retain the host's cleanup/admission ownership and offer an explicit supported retry after cleanup. Do not rewrite an invalid claim to true/false in presentation or treat a rejected report as a clean zero-result scan. No report or progress is returned in the fixed error envelope. Existing false-flag reports preserve correlation, precise decimal u64 counters, hashes, omissions and partial coverage. Future reviewed engine activation needs a separately reviewed authoritative capability/source contract, not a UI toggle or relaxation of this guard.

Failing-first evidence: the isolated initial build shared a stale dependency artifact from an older archived branch and failed before reaching tests. With its own fresh build target, both file/directory guard assertions failed because the converter accepted true. After two narrow guard conditions, all five wire tests and the actual harmless file/folder dispatch integration test pass; strict scan lint passes. Full verifier evidence is recorded before publication. No generated binding edits are necessary because the schema is unchanged. Tests use invented native snapshots/harmless local files, never a malware sample or valuable secret.
Full tools/verify.ps1 exited0 with All available T01 checks passed after the guard: workspace formatting/strict lint/tests, generated binding parity, TypeScript typecheck/tests/build and extension checks. Offline cache setup downloaded0 packages. Source was verified in a separate archive with its own build target; preview assets/cache stayed intact.
