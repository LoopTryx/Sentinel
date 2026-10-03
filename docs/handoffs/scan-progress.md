# Selected-directory progress: S1 integration handoff

Issue #9; Codex scanner/contracts, GLM views (#11), coordinator reviewed integration. This leaf emits actual progress from the existing benign read-only folder scanner. It does not implement a native command, durable job, process timeout or GUI.

## Functions and DTO

```rust
sentinel_scan::pipeline::scan_directory_with_progress(
    root: impl AsRef<Path>,
    file_limits: ScanLimits,
    directory_limits: DirectoryLimits,
    cancelled: impl FnMut() -> bool,
    progress: impl FnMut(&DirectoryScanProgress),
) -> DirectoryReport
```

Source DTO: sentinel_proto::scan_progress::{DirectoryScanProgress, DirectoryScanStage}; generated TS files of the same names under packages/contracts/src/generated. `scan_directory` retains its original signature and report; it delegates with a no-op observer. Both entry points now check cancellation before filesystem access, including an empty root.

The cancellation predicate and observer execute synchronously on the caller's scanning thread. Run on a background worker, never the UI dispatcher. Observer must be fast/nonblocking and must not panic; marshal a copy to a bounded latest-snapshot slot rather than queue every callback. The scanner stores one previous snapshot and suppresses identical callbacks. It emits initial zero counters, changed traversal counters, and exactly one `finished` snapshot on normal return. A panic, process kill or blocked filesystem call is outside that return guarantee.

Snapshots arrive at entry boundaries and after a file result, not each 8192-byte read. During one large file the UI may display elapsed/indeterminate activity, but must not fabricate byte updates. Cancellation is checked before traversal and between entries/read chunks; it cannot interrupt a blocking OS read. Parent timeout/worker termination and job ownership remain separate integration responsibilities.

## Wire example

This is callback JSON, not an accepted RPC request:

```json
{"stage":"finished","entriesVisited":"2","filesVisited":"2","filesChecked":"2","filesSkipped":"0","accessErrors":"0","engineFailures":"0","bytesRead":"6","traversalComplete":true,"cancelled":false,"limitReached":false}
```

It is produced by a selected folder containing two invented three-byte files. Rust counters are u64; JSON and generated TS use canonical unsigned decimal **strings** to avoid bigint/JSON precision mismatch. Parse to BigInt only for calculation, display as text; do not convert arbitrarily large counters to Number. Decoder rejects numeric JSON, signs, leading zeros and overflow. Deserialize only within the existing bounded transport envelope; this DTO parser is not a standalone hostile-input size gate.

A future local wrapper request might carry `{selectionRef, jobId}` referring to an authorized native picker selection. This leaf accepts an already approved Rust path, not arbitrary browser paths; no such wrapper is registered. Bind callback copies to the authenticated/local job and selected subject in the adapter. The DTO deliberately excludes paths, names, content, user identity and hashes. No GUI should associate an old reply with a newly selected folder.

## Meaning and failure states

- `running`: traversal has not returned; totals/percent are unknown. Counters are cumulative observations, not the count of all files on disk.
- `finished`: traversal returned. It is not JobState::Completed, protection, or full detection coverage. Inspect flags/counters and actual report before choosing presentation.
- `cancelled=true` or `limitReached=true`: incomplete. `traversalComplete=false` also covers skips, access errors and engine failures. Missing root returns accessErrors="1"; unsupported root returns a skip. These never count as checked.
- `filesVisited` counts regular-file scan attempts. `filesSkipped` may include directories, symlinks or unsupported entries, and `accessErrors` may include directory/metadata reads. Do not assume checked+skipped+errors equals filesVisited. `bytesRead` may include incomplete/cancelled file bytes; checked counts only completed checks.
- `traversalComplete=true` means only implemented traversal finished without those gaps. Engine coverage stays **partial**, full signature engine inactive; do not render a green protection shield. Existing byte-cap, entry/depth/pending/finding bounds and discovered-link exclusions still apply. Ancestor replacement, hostile parser isolation and broad threat detection remain unsupported.
- No timeout flag is synthesized by the library. Adapter must represent an actual deadline/termination separately and retain last known counters with incomplete coverage. No callback/report after termination is guaranteed.
- No profile or native capability becomes available from this DTO. #19 remains scanAvailable=false until real dispatch is implemented and verified. Keep unsupported actions disabled.

## Acceptance and next action

`cargo test -p sentinel-scan --test progress --test pipeline` verifies actual benign counts, intermediate updates, final parity, callback-triggered cancellation after one file, limits/skips, missing root and initial empty-directory cancellation. `cargo test -p sentinel-proto` checks regeneration and exact/full-width decimal round-trip/rejection. Run full tools/verify.ps1 after committing generated outputs.

Coordinator: serialize new proto export with other pending PRs, then peer-review/integrate. Codex next: attach these counters to the reviewed scan job/local adapter, retaining actual timeout/report semantics; single-file/chunk-level UI updates remain separate work. GLM: review decimal counters and state semantics, then consume on your branch after adapter availability. UI keyboard/cancel/repeated-selection/error journeys and event rehearsals remain pending. No E:, policy changes, live malware or EICAR files used.
## Single-file cooperative cancellation follow-up

Public Rust API: `sentinel_scan::pipeline::scan_file_with_cancel(path: impl AsRef<Path>, limits: ScanLimits, cancelled: &mut impl FnMut() -> bool) -> ScanResult`. This exposes the existing selected-file path with cancellation checked before metadata/open and between read chunks. `scan_file` keeps its original signature and delegates with false. The adapter must authorize selection and call from a worker thread; an AtomicBool-backed predicate can carry UI cancellation. Cancellation is sticky in the adapter; no reset while a request is active.

For initial cancel the report is state=cancelled, bytesRead=0, filesChecked=0, filesSkipped=1, accessErrors=0, sha256=null. A non-cancelled invalid/missing path remains access_error. The file result's filesVisited=1 represents the requested scan attempt, not proof that metadata or bytes were read. Cancellation after one read chunk retains bytesRead=8192 but no hash/checked count; interrupted bytes are not inspected coverage. The actual test's uncancelled positive control reads all 20000 benign bytes and returns one checked result.

No native/Tauri/CLI cancel endpoint, single-file progress callback, timeout state, protected service or full signature coverage is enabled here. ScanResult is the existing Rust/JSON report, not the generated DirectoryScanProgress DTO; the local adapter still needs authoritative typed result conversion/review, subject/job correlation, transport bounds and actual timeout semantics before GLM can call it. Do not use a raw browser path or shell command built from user input. Mid-read cancellation cannot interrupt a blocked filesystem read, so parent deadline/termination remains required. Tests: initial invalid-path cancellation was observed failing with AccessError; after correction it passes alongside a real benign mid-read/retry positive control. All five directory-progress tests remain passing.

## Selected-file typed report follow-up

`sentinel_scan::report::selected_file_report(result: &ScanResult, job_id: &str, selection_ref: &str) -> Result<SelectedFileReport, ReportBindingError>` converts a trusted local result without rescanning. Authoritative source: sentinel-proto/src/scan_report.rs; generated outputs: SelectedFileReport.ts, FileScanOutcome.ts, ScanReportCoverage.ts. The DTO is output-only (Serialize, no Rust Deserialize); it is not an input command or an untrusted report validator. Directory report conversion remains pending.

Both references must be 1–64 bytes of ASCII letters/digits/dash/underscore. Invalid references return the fixed error `invalid scan correlation reference`, without echoing the supplied string. The adapter allocates opaque non-secret IDs and maps selectionRef to a native picker-approved path privately. Syntax validation is not ownership, authentication or permission: resolve/authorize that selection before invoking the scanner, capture the pair for the operation, and accept a response only when BOTH IDs equal the still-active operation. Repeated selection/clicks must invalidate earlier responses. Never use a path, SID, filename or browser input as either reference. No adapter registry, authentication or late-response dropping is activated by this converter.

Example invocation (already authorized benign file; illustrative local code, not an RPC endpoint):

```rust
let result = scan_file_with_cancel(selected_path, limits, &mut || cancel.load(Ordering::Relaxed));
let report = selected_file_report(&result, "job-7", "selection_3")?;
```

Output for the test's six benign bytes:

```json
{"jobId":"job-7","selectionRef":"selection_3","state":"no_known_finding","coverage":"partial","bytesRead":"6","sha256":"56aea2f152b148a0886d27ff6b06f39b091c4f02ccb75c1aeef470e2d6c8e9c3","filesVisited":"1","filesChecked":"1","filesSkipped":"0","accessErrors":"0","engineFailures":"0","fullSignatureEngineActive":false}
```

State mappings preserve all seven scanner outcomes. NoKnownFinding means only no finding from the implemented checks. TestSignatureFound is a test-signature outcome, not live malware identification. SkippedLimit/SkippedUnsupported/AccessError/ChangedDuringScan/Cancelled remain distinct incomplete results. Counters retain the original attempt/checked/skip/error meanings and are canonical decimal strings even at u64::MAX; no floating-point conversion. Partial coverage is unconditional. The current producer keeps the full signature engine inactive; the converter copies its actual field rather than inventing engine availability.

A completed hash is local evidence, not proof of safety; do not send it or these reports to an AI/diagnostic service. No paths, names, raw bytes or content appear in the DTO. Scope/exclusions and hash/test-string capability must still be displayed. Cancellation after one 8192-byte chunk retains bytesRead="8192", sha256=null and filesChecked="0". An actual parent timeout must remain a separate incomplete terminal state with last observed evidence, not a constructed successful SelectedFileReport. Transport byte limits and bounded output validation remain adapter responsibilities; this output contract does not parse hostile input.

Acceptance: `cargo test -p sentinel-scan --test report --test progress --test pipeline` and `cargo test -p sentinel-proto`; then full verifier. Four report tests cover actual benign completion, missing file, size cap, initial and mid-read cancellation, retry with new correlation, invalid references/no echo, seven in-memory state mappings and full-width counters. The latter is wire/mapping evidence, not live outcomes. GLM should consume after coordinator-reviewed integration; no GUI operation or S1 rehearsal is claimed.

## Selected-directory typed result follow-up

API: `sentinel_scan::report::selected_directory_report(result: &DirectoryReport, job_id: &str, selection_ref: &str) -> Result<SelectedDirectoryReport, ReportBindingError>`. It converts a trusted returned report, without scanning or filesystem access. Authoritative sources: scan_report.rs and scan_progress.rs; generated SelectedDirectoryReport.ts and ScanReportFinding.ts. Both correlation references use the selected-file 1–64 ASCII syntax/fixed error; this is output-only, not an RPC request, report decoder or authority grant. Resolve a native approved selection before scanning; retain the actual source report privately and require both IDs to match the active operation before presentation.

Example output from the test's two three-byte benign files:

```json
{"jobId":"job-folder","selectionRef":"selection-folder","progress":{"stage":"finished","entriesVisited":"2","filesVisited":"2","filesChecked":"2","filesSkipped":"0","accessErrors":"0","engineFailures":"0","bytesRead":"6","traversalComplete":true,"cancelled":false,"limitReached":false},"coverage":"partial","fullSignatureEngineActive":false,"findings":[],"findingsOmitted":"0"}
```

`progress` uses the same producer as the final scanner callback; all counters and traversal/cancel/limit flags are preserved. Finished is return status, not a durable job completion or a clean verdict. Size-limited files contribute skips/incomplete traversal; a traversal entry limit additionally sets limitReached. Initial cancellation/missing roots keep the original semantics. Coverage stays partial even when traversalComplete=true; engine state is copied, not activated. Deadline/process failure remains a separate adapter terminal state, never a fabricated returned report.

Detailed output is capped at `MAX_REPORT_FINDINGS=256`. Each finding contains only `{findingRef:"finding-1",state:"test_signature_found"}` etc.; no path/name/hash/content. References are source-vector ordinal+1, local to this immutable report and BOTH correlation IDs. They are not global IDs, filesystem paths, remediation permissions or stable across a rescan. The future private adapter may resolve an ordinal into its retained source report for an explicitly permitted evidence view; no such resolver/action is registered here. Do not use these IDs as commands or open files automatically. The current scanner's detailed findings contain only test-signature matches; errors/skips remain aggregate counters, not invented per-file findings.

`findingsOmitted` is the exact decimal count of source findings outside the output cap. This is report-detail truncation, distinct from the scanner's own finding cap/limitReached. Show omitted details explicitly, preserve aggregate progress and partial coverage; an empty list never cancels skips/errors or establishes safety. The converter visits only the first 256 finding states, does not copy source paths, and has output below 32 KiB in the maximum-list test. Bounded transport, selection registry, ownership, stale-result rejection and timeouts still require reviewed adapter implementation. No capability is enabled by this DTO.

Acceptance: two new directory report tests compare actual output to the final callback for benign completion, cooperative cancellation after one check, size skips, traversal entry limit and missing root. A separate in-memory 263-finding stress report verifies 256 references, seven omitted, redaction, fixed binding failure and a <32 KiB JSON bound; that synthetic test proves conversion only and creates no test-signature file. The six report tests, six directory-progress tests, eight pipeline tests and generated parity/full verifier must pass. GLM consumes only after review/integration. Next: reviewed native picker selection/job adapter with cancellation/deadline/stale-response handling, then actual UI and rehearsal evidence.
